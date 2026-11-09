/* Admin Finances page. Reads from SEAgency-API when SITE.apiUrl is set, otherwise
   from sample-finances.js. Until payments go through Stripe, every figure comes
   from what an admin records here: each project's fixed-price stages, extras
   charged on top, and the company's own expenses. Amounts are whole pence. */

const app = document.getElementById("app");
const preview = !API.connected;
const STATUSES = { planned: "Planned", invoiced: "Invoiced", paid: "Paid" };

/* ---------- helpers ---------- */

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gbp0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
const money = p => (p % 100 === 0 ? gbp0 : gbp2).format(p / 100);
const short = p => {
  const pounds = p / 100;
  if (Math.abs(pounds) >= 1000) return `£${(pounds / 1000).toFixed(pounds % 1000 === 0 ? 0 : 1).replace(/\.0$/, "")}k`;
  return gbp0.format(pounds);
};
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => isoDay(new Date());
const dayLabel = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const monthLabel = (ym, long) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-GB", long ? { month: "long", year: "numeric" } : { month: "short" });
const clientName = c => c.companyName || c.displayName;
const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

/* "1,250.50" or "£1250" to pence. Null if it isn't an amount. */
function toPence(text) {
  const clean = String(text).replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/* The date ranges people ask about. UK tax years start on 6 April. */
function rangeFor(key) {
  const now = new Date();
  if (key === "all") return {};
  if (key === "12m") return { from: isoDay(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: isoDay(now) };
  const startYear = now < new Date(now.getFullYear(), 3, 6) ? now.getFullYear() - 1 : now.getFullYear();
  return { from: `${startYear}-04-06`, to: isoDay(now) };
}
const RANGES = { tax: "This tax year", "12m": "Last 12 months", all: "All time" };
const query = r => { const q = new URLSearchParams(Object.entries(r).filter(([, v]) => v)).toString(); return q ? `?${q}` : ""; };

/* ---------- data: the API, or sample data in preview ---------- */

/* Works out the same figures as GET /admin/finances, from sample data held in the page. */
function sampleSource() {
  const data = structuredClone(window.SAMPLE_FINANCES);
  const all = () => data.projects.flatMap(p => p.charges.map(c => ({ ...c, project: p })));
  const inRange = (d, r) => d && (!r.from || d >= r.from) && (!r.to || d <= r.to);
  const find = id => all().find(c => c.id === id);
  const wait = value => Promise.resolve(structuredClone(value));

  function finances(r) {
    const charges = all();
    const paid = charges.filter(c => c.status === "paid" && inRange(c.paidOn, r));
    const spent = data.expenses.filter(e => inRange(e.spentOn, r));
    const moneyIn = sum(paid, c => c.amountPence);
    const cut = sum(paid, c => c.companyCutPence || 0);
    const expenses = sum(spent, e => e.amountPence);
    const end = r.to ? new Date(`${r.to}T12:00:00`) : new Date();
    const months = Array.from({ length: 12 }, (_, i) => isoDay(new Date(end.getFullYear(), end.getMonth() - 11 + i, 1)).slice(0, 7));
    return {
      range: { from: r.from || null, to: r.to || null },
      summary: {
        moneyInPence: moneyIn, companyCutPence: cut, engineersSharePence: moneyIn - cut,
        extrasPence: sum(paid.filter(c => c.kind === "extra"), c => c.amountPence),
        expensesPence: expenses, profitPence: cut - expenses,
        owedPence: sum(charges.filter(c => c.status === "invoiced"), c => c.amountPence),
        toBillPence: sum(charges.filter(c => c.status === "planned"), c => c.amountPence)
      },
      monthly: months.map(month => {
        const m = charges.filter(c => c.status === "paid" && c.paidOn?.startsWith(month));
        return { month, moneyInPence: sum(m, c => c.amountPence), companyCutPence: sum(m, c => c.companyCutPence || 0),
          expensesPence: sum(data.expenses.filter(e => e.spentOn.startsWith(month)), e => e.amountPence) };
      }),
      projects: data.projects.map(p => ({
        ...p,
        totals: {
          pricePence: sum(p.charges, c => c.amountPence),
          paidPence: sum(p.charges.filter(c => c.status === "paid"), c => c.amountPence),
          owedPence: sum(p.charges.filter(c => c.status === "invoiced"), c => c.amountPence)
        }
      })),
      expenses: [...data.expenses].sort((a, b) => b.spentOn.localeCompare(a.spentOn))
    };
  }

  return {
    me: () => wait(data.me),
    finances: r => wait(finances(r)),
    setCut: (id, companyCutPercent) => { data.projects.find(p => p.id === id).companyCutPercent = companyCutPercent; return wait({}); },
    addCharge: (id, body) => {
      const p = data.projects.find(x => x.id === id);
      const status = body.status || "planned";
      p.charges.push({ id: `c-new-${Date.now()}`, kind: body.kind, name: body.name, amountPence: body.amountPence, status,
        dueOn: body.dueOn || null, invoicedAt: null, paidOn: status === "paid" ? todayIso() : null,
        companyCutPence: status === "paid" ? Math.round(body.amountPence * p.companyCutPercent / 100) : null });
      return wait({});
    },
    updateCharge: (id, body) => {
      const c = find(id);
      const live = c.project.charges.find(x => x.id === id);
      if (body.status && body.status !== live.status) {
        live.status = body.status;
        live.paidOn = body.status === "paid" ? (body.paidOn || todayIso()) : null;
        live.companyCutPence = body.status === "paid" ? Math.round(live.amountPence * c.project.companyCutPercent / 100) : null;
      } else if (body.paidOn) live.paidOn = body.paidOn;
      return wait({});
    },
    removeCharge: id => { const c = find(id); c.project.charges = c.project.charges.filter(x => x.id !== id); return wait(null); },
    addExpense: body => { data.expenses.push({ id: `x-new-${Date.now()}`, ...body }); return wait({}); },
    removeExpense: id => { data.expenses = data.expenses.filter(e => e.id !== id); return wait(null); },
    logout: () => wait({})
  };
}

const source = preview ? sampleSource() : API;

/* ---------- the graph ---------- */

/* Paid money by month, stacked: the company's cut sits on the baseline and the
   engineers' share on top, so each bar's height is everything paid that month. */
function chart(monthly, width = 720) {
  const max = Math.max(...monthly.map(m => m.moneyInPence), 0);
  if (!max) return `<p class="empty-note">Nothing paid in these twelve months yet. Payments you record appear here by month.</p>`;
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const W = Math.max(280, Math.round(width)), H = W < 500 ? 220 : 260, L = 44, R = 4, T = 12, B = 28;
  const plotW = W - L - R, plotH = H - T - B;
  const col = plotW / monthly.length;
  const barW = Math.min(36, col * 0.6);
  const every = col < 34 ? 2 : 1; // every other month label when space is tight
  const y = p => T + plotH - (p / top) * plotH;

  const grid = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).map(v => `
      <line class="chart-grid${v === 0 ? " base" : ""}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="chart-tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`).join("");

  const bars = monthly.map((m, i) => {
    const x = L + col * i + (col - barW) / 2;
    const cut = m.companyCutPence, share = m.moneyInPence - m.companyCutPence;
    const cutTop = y(cut), shareTop = y(m.moneyInPence);
    const gap = cut && share ? 2 : 0;
    // The top segment gets the rounded end; the bottom one stays square on the baseline.
    const cutPath = cut ? roundedTop(x, cutTop, barW, y(0) - cutTop, share ? 0 : 4) : "";
    const sharePath = share ? roundedTop(x, shareTop, barW, Math.max(0, cutTop - shareTop - gap), 4) : "";
    const label = `${monthLabel(m.month, true)}: ${money(m.moneyInPence)} paid, ${money(cut)} company cut, ${money(share)} engineers' share, ${money(m.expensesPence)} expenses`;
    return `
      <g class="chart-col" data-i="${i}" tabindex="0" role="img" aria-label="${esc(label)}">
        <rect class="chart-hit" x="${L + col * i}" y="${T}" width="${col}" height="${plotH}"/>
        ${cutPath ? `<path class="chart-cut" d="${cutPath}"/>` : ""}
        ${sharePath ? `<path class="chart-share" d="${sharePath}"/>` : ""}
        ${(monthly.length - 1 - i) % every === 0 ? `<text class="chart-tick" x="${L + col * i + col / 2}" y="${H - 8}" text-anchor="middle">${monthLabel(m.month)}</text>` : ""}
      </g>`;
  }).join("");

  const rows = monthly.map(m => `<tr><td>${monthLabel(m.month, true)}</td><td>${money(m.moneyInPence)}</td><td>${money(m.companyCutPence)}</td><td>${money(m.moneyInPence - m.companyCutPence)}</td><td>${money(m.expensesPence)}</td></tr>`).join("");

  return `
    <div class="panel chart-panel">
      <div class="chart-top">
        <div class="chart-legend" aria-hidden="true">
          <span><i class="sw sw-cut"></i>Company's cut</span>
          <span><i class="sw sw-share"></i>Engineers' share</span>
        </div>
        <button class="linkish" type="button" data-action="toggle-table" aria-expanded="false">Show as a table</button>
      </div>
      <div class="chart-box">
        <svg class="chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="Money paid each month for the last twelve months">${grid}${bars}</svg>
        <div class="chart-tip" role="status" hidden></div>
      </div>
      <div class="table-wrap chart-table" hidden>
        <table><thead><tr><th>Month</th><th>Paid</th><th>Company's cut</th><th>Engineers' share</th><th>Expenses</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>`;
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map(n => n * pow).find(n => n >= raw) || 10 * pow;
}
function roundedTop(x, y, w, h, r) {
  if (h <= 0) return "";
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* Drawn at the width it's shown at, so text stays readable on a phone. */
const chartWidth = () => Math.min(app.clientWidth, 1160) - 42;
let lastWidth = 0;
addEventListener("resize", () => {
  const box = app.querySelector(".chart-box");
  if (!box || !current || Math.abs(chartWidth() - lastWidth) < 24) return;
  lastWidth = chartWidth();
  const fresh = new DOMParser().parseFromString(chart(current.monthly, lastWidth), "text/html").querySelector(".chart");
  if (fresh) box.querySelector(".chart").replaceWith(document.importNode(fresh, true));
});

/* ---------- the page ---------- */

function tile(label, pence, note, tone = "") {
  return `<div class="fin-tile${tone ? ` ${tone}` : ""}"><span class="eyebrow dim">${label}</span><b>${money(pence)}</b><span class="note">${note}</span></div>`;
}

function chargeRow(c) {
  const paid = c.status === "paid";
  return `
            <div class="charge" data-charge="${esc(c.id)}">
              <div class="charge-name"><b>${esc(c.name)}</b><span class="tag-${c.kind}">${c.kind === "stage" ? "Stage" : "Extra"}</span>
                ${c.dueOn && !paid ? `<span class="dim">due ${dayLabel(c.dueOn)}</span>` : ""}</div>
              <span class="charge-amount">${money(c.amountPence)}</span>
              <span class="row-actions">
                <select class="status-select" data-action="charge-status" data-id="${esc(c.id)}" aria-label="Status of ${esc(c.name)}">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}"${k === c.status ? " selected" : ""}>${v}</option>`).join("")}</select>
                ${paid ? `<input class="status-select" type="date" data-action="paid-on" data-id="${esc(c.id)}" value="${esc(c.paidOn)}" aria-label="Date ${esc(c.name)} was paid">`
                  : `<button class="btn btn-quiet btn-small" type="button" data-action="remove-charge" data-id="${esc(c.id)}" data-name="${esc(c.name)}">Remove</button>`}
              </span>
            </div>`;
}

function manageRow(p) {
  const stages = p.charges.filter(c => c.kind === "stage");
  const extras = p.charges.filter(c => c.kind === "extra");
  return `
          <tr class="manage-row" data-manage="${esc(p.id)}" hidden><td colspan="7">
            <div class="manage fin-manage">
              <div class="charges">
                ${stages.length ? stages.map(chargeRow).join("") : `<p class="dim">No stages yet. Add the stages from the written plan, with the price of each.</p>`}
                ${extras.map(chargeRow).join("")}
              </div>
              <form class="fin-form" data-form="charge" data-project="${esc(p.id)}" novalidate>
                <div class="field"><label for="kind-${esc(p.id)}">Add</label>
                  <select id="kind-${esc(p.id)}" name="kind"><option value="stage">A stage</option><option value="extra">An extra</option></select></div>
                <div class="field"><label for="cname-${esc(p.id)}">Name</label><input id="cname-${esc(p.id)}" name="name" maxlength="120" placeholder="Booking and reminders"></div>
                <div class="field"><label for="amount-${esc(p.id)}">Price (£)</label><input id="amount-${esc(p.id)}" name="amount" inputmode="decimal" placeholder="2,400"></div>
                <div class="field"><label for="due-${esc(p.id)}">Due <span class="dim">(optional)</span></label><input id="due-${esc(p.id)}" name="dueOn" type="date"></div>
                <div class="form-foot"><span class="form-msg" role="status"></span><button class="btn btn-primary btn-small" type="submit">Add</button></div>
              </form>
              <form class="fin-cut" data-form="cut" data-project="${esc(p.id)}" novalidate>
                <label for="cut-${esc(p.id)}">Company's cut on this project</label>
                <span class="cut-input"><input id="cut-${esc(p.id)}" name="cut" inputmode="numeric" value="${p.companyCutPercent}" aria-describedby="cut-note-${esc(p.id)}"><span>%</span></span>
                <button class="btn btn-quiet btn-small" type="submit">Save</button>
                <span class="note" id="cut-note-${esc(p.id)}">Only changes payments recorded from now on.</span>
              </form>
            </div>
          </td></tr>`;
}

function projectTable(projects) {
  return `
      <div class="table-wrap fin-table">
        <table>
          <thead><tr><th>Project</th><th>Client</th><th>Price</th><th>Paid</th><th>Invoiced</th><th>Cut</th><th></th></tr></thead>
          <tbody>${projects.map(p => `<tr><td class="strong fin-name">${esc(p.name)}${p.status !== "active" ? ` <span class="dim">&middot; ${p.status}</span>` : ""}</td><td class="fin-client">${esc(clientName(p.customer))}</td>
            <td class="num" data-label="Price">${money(p.totals.pricePence)}</td><td class="num" data-label="Paid">${money(p.totals.paidPence)}</td><td class="num" data-label="Invoiced">${p.totals.owedPence ? money(p.totals.owedPence) : `<span class="dim">&ndash;</span>`}</td><td class="num" data-label="Cut">${p.companyCutPercent}%</td>
            <td class="fin-go"><button class="linkish" type="button" data-action="manage" data-project="${esc(p.id)}">Manage</button></td></tr>${manageRow(p)}`).join("")}</tbody>
        </table>
      </div>`;
}

function expenseSection(expenses) {
  return `
      <form class="fin-form" data-form="expense" novalidate>
        <div class="field"><label for="ex-desc">What for</label><input id="ex-desc" name="description" maxlength="120" placeholder="Neon database, monthly"></div>
        <div class="field"><label for="ex-amount">Amount (£)</label><input id="ex-amount" name="amount" inputmode="decimal" placeholder="19"></div>
        <div class="field"><label for="ex-date">Date</label><input id="ex-date" name="spentOn" type="date" value="${todayIso()}"></div>
        <div class="form-foot"><span class="form-msg" role="status"></span><button class="btn btn-primary btn-small" type="submit">Add expense</button></div>
      </form>
      ${expenses.length ? `
      <div class="table-wrap fin-expenses">
        <table>
          <thead><tr><th>Date</th><th>What for</th><th>Amount</th><th></th></tr></thead>
          <tbody>${expenses.map(e => `<tr><td>${dayLabel(e.spentOn)}</td><td class="strong">${esc(e.description)}</td><td class="num">${money(e.amountPence)}</td>
            <td><button class="linkish" type="button" data-action="remove-expense" data-id="${esc(e.id)}" data-name="${esc(e.description)}">Remove</button></td></tr>`).join("")}</tbody>
        </table>
      </div>` : `<p class="empty-note">No expenses yet. Add what the company pays for, like hosting, the domain or the ICO fee.</p>`}`;
}

function view(me, f, rangeKey) {
  const s = f.summary;
  const open = f.projects.filter(p => p.status !== "closed");
  const closed = f.projects.filter(p => p.status === "closed");
  const period = RANGES[rangeKey].toLowerCase();
  return `
    ${preview ? `<div class="preview-bar"><span>Preview with sample data. Nothing you change here is saved.</span><a href="dashboard.html?preview=admin">Admin dashboard</a></div>` : ""}
    <div class="page-head"><span class="eyebrow">Admin</span><h1>Finances</h1>
      <p class="who">Money paid for each project's stages and extras, the company's cut, and what the company spends. Recorded by hand until payments go through Stripe.</p></div>

    <div class="fin-bar">
      <div class="segmented" role="group" aria-label="Period">${Object.entries(RANGES).map(([k, v]) =>
        `<button type="button" data-action="range" data-range="${k}" aria-pressed="${k === rangeKey}">${v}</button>`).join("")}</div>
      <button class="btn btn-quiet btn-small" type="button" data-action="export">Download CSV for the accountant</button>
    </div>

    <section class="fin-tiles" aria-label="Totals for ${esc(period)}">
      ${tile("Money in", s.moneyInPence, `Paid, ${esc(period)}`)}
      ${tile("Company's cut", s.companyCutPence, "Kept by the company")}
      ${tile("Engineers' share", s.engineersSharePence, "Paid on to engineers")}
      ${tile("Extras", s.extrasPence, "Paid on top of fixed prices")}
      ${tile("Expenses", s.expensesPence, "What the company spent")}
      ${tile("Profit", s.profitPence, "Company's cut minus expenses", s.profitPence < 0 ? "neg" : "pos")}
    </section>
    <p class="fin-pipeline"><span><b>${money(s.owedPence)}</b> invoiced and waiting to be paid</span><span><b>${money(s.toBillPence)}</b> still to bill in planned stages</span></p>

    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">By month</span><h2>Money in</h2>
        <p>The twelve months up to ${f.range.to ? dayLabel(f.range.to) : "today"}. Hover or tab to a month for its figures.</p></div></div>
      ${chart(f.monthly, chartWidth())}
    </section>

    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Projects</span><h2>Stages and extras</h2>
        <p>Add each project's stages with their fixed prices, then mark them invoiced and paid. Extras are anything charged on top. Customers see which stage they're on, never the prices.</p></div>
        <span class="mono">${open.length} open</span></div>
      ${open.length ? projectTable(open) : `<p class="empty-note">Projects you start from a request are listed here.</p>`}
    </section>
    ${closed.length ? `
    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Closed</span><h2>Finished projects</h2></div><span class="mono">${closed.length} closed</span></div>
      ${projectTable(closed)}
    </section>` : ""}

    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Expenses</span><h2>Money out</h2>
        <p>Keep receipts for six years. Profit above is the company's cut minus these.</p></div></div>
      ${expenseSection(f.expenses)}
    </section>`;
}

/* ---------- loading ---------- */

let rangeKey = (() => { try { return RANGES[sessionStorage.getItem("fin-range")] ? sessionStorage.getItem("fin-range") : "tax"; } catch { return "tax"; } })();
let current = null;

async function load(keepOpen = []) {
  let me;
  try {
    me = await source.me();
  } catch (err) {
    if (err.status === 401) { location.replace("signin.html"); return; }
    throw err;
  }
  if (me.role !== "admin") { location.replace("dashboard.html"); return; }
  document.getElementById("who").textContent = `${me.displayName}, admin`;
  current = await source.finances(rangeFor(rangeKey));
  lastWidth = chartWidth();
  app.innerHTML = view(me, current, rangeKey);
  keepOpen.forEach(id => app.querySelector(`[data-action="manage"][data-project="${id}"]`)?.click());
}

const openProjects = () => [...app.querySelectorAll(".manage-row:not([hidden])")].map(r => r.dataset.manage);

load().catch(() => {
  app.innerHTML = '<p class="who">Something went wrong loading the finances. Please refresh to try again.</p>';
});

/* ---------- graph hover ---------- */

function showTip(col) {
  const box = col.closest(".chart-box");
  const tip = box.querySelector(".chart-tip");
  const m = current.monthly[Number(col.dataset.i)];
  tip.innerHTML = `<b>${monthLabel(m.month, true)}</b>
    <span><i class="sw sw-cut"></i>Company's cut <em>${money(m.companyCutPence)}</em></span>
    <span><i class="sw sw-share"></i>Engineers' share <em>${money(m.moneyInPence - m.companyCutPence)}</em></span>
    <span class="tip-total">Paid <em>${money(m.moneyInPence)}</em></span>
    <span class="dim">Expenses <em>${money(m.expensesPence)}</em></span>`;
  tip.hidden = false;
  box.querySelectorAll(".chart-col").forEach(c => c.classList.toggle("dim", c !== col));
  const hit = col.querySelector(".chart-hit").getBoundingClientRect();
  const rect = box.getBoundingClientRect();
  const left = hit.left - rect.left + hit.width / 2;
  tip.style.left = `${Math.min(Math.max(left, tip.offsetWidth / 2 + 4), rect.width - tip.offsetWidth / 2 - 4)}px`;
}
function hideTip(box) {
  box.querySelector(".chart-tip").hidden = true;
  box.querySelectorAll(".chart-col").forEach(c => c.classList.remove("dim"));
}
app.addEventListener("pointerover", e => { const col = e.target.closest(".chart-col"); if (col) showTip(col); });
app.addEventListener("pointerleave", e => { const box = e.target.closest?.(".chart-box"); if (box) hideTip(box); }, true);
app.addEventListener("focusin", e => { const col = e.target.closest(".chart-col"); if (col) showTip(col); });
app.addEventListener("focusout", e => { const box = e.target.closest(".chart-box"); if (box) hideTip(box); });

/* ---------- actions ---------- */

function downloadSampleCsv() {
  const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const r = rangeFor(rangeKey);
  const ok = d => (!r.from || d >= r.from) && (!r.to || d <= r.to);
  const rows = [
    ...current.projects.flatMap(p => p.charges.filter(c => c.status === "paid" && ok(c.paidOn)).map(c =>
      [c.paidOn, "Money in", c.kind === "stage" ? "Stage" : "Extra", p.name, clientName(p.customer), c.name,
        (c.amountPence / 100).toFixed(2), (c.companyCutPence / 100).toFixed(2), ((c.amountPence - c.companyCutPence) / 100).toFixed(2)])),
    ...current.expenses.filter(e => ok(e.spentOn)).map(e => [e.spentOn, "Expense", "", "", "", e.description, (-e.amountPence / 100).toFixed(2), (-e.amountPence / 100).toFixed(2), "0.00"])
  ].sort((a, b) => a[0].localeCompare(b[0]));
  const csv = [["Date", "Type", "Kind", "Project", "Client", "Description", "Amount (GBP)", "Company (GBP)", "Engineers (GBP)"], ...rows].map(row => row.map(cell).join(",")).join("\r\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })), download: "finances-sample.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
}

app.addEventListener("click", async e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "range") {
    rangeKey = el.dataset.range;
    try { sessionStorage.setItem("fin-range", rangeKey); } catch {}
    return load(openProjects());
  }
  if (action === "export") {
    if (preview) return downloadSampleCsv();
    location.href = `${SITE.apiUrl}/admin/finances/export.csv${query(rangeFor(rangeKey))}`;
    return;
  }
  if (action === "toggle-table") {
    const panel = el.closest(".chart-panel");
    const table = panel.querySelector(".chart-table");
    table.hidden = !table.hidden;
    el.setAttribute("aria-expanded", String(!table.hidden));
    el.textContent = table.hidden ? "Show as a table" : "Hide the table";
    return;
  }
  if (action === "manage") {
    const row = app.querySelector(`[data-manage="${el.dataset.project}"]`);
    row.hidden = !row.hidden;
    el.textContent = row.hidden ? "Manage" : "Done";
    return;
  }
  if (action === "remove-charge" && !confirm(`Remove "${el.dataset.name}"?`)) return;
  if (action === "remove-expense" && !confirm(`Remove the expense "${el.dataset.name}"?`)) return;
  if (action !== "remove-charge" && action !== "remove-expense") return;

  el.disabled = true;
  try {
    await (action === "remove-charge" ? source.removeCharge(el.dataset.id) : source.removeExpense(el.dataset.id));
    await load(openProjects());
  } catch {
    el.disabled = false;
    alert("That didn't go through. Please try again.");
  }
});

app.addEventListener("change", async e => {
  const el = e.target.closest('[data-action="charge-status"], [data-action="paid-on"]');
  if (!el) return;
  const body = el.dataset.action === "paid-on" ? { paidOn: el.value } : { status: el.value };
  if (body.paidOn === "") return;
  el.disabled = true;
  try {
    await source.updateCharge(el.dataset.id, body);
  } catch {
    alert("That didn't go through. Please try again.");
  }
  await load(openProjects());
});

app.addEventListener("submit", async e => {
  const form = e.target;
  const kind = form.dataset.form;
  if (!["charge", "cut", "expense"].includes(kind)) return;
  e.preventDefault();
  const note = form.querySelector(".form-msg");
  const say = text => { if (note) note.textContent = text; else alert(text); };
  const button = form.querySelector("button[type=submit]");

  let call;
  if (kind === "cut") {
    const cut = Number(form.elements.cut.value);
    if (!Number.isInteger(cut) || cut < 0 || cut > 100) return say("The cut is a whole number from 0 to 100.");
    call = () => source.setCut(form.dataset.project, cut);
  } else {
    const name = (kind === "charge" ? form.elements.name : form.elements.description).value.trim();
    const amountPence = toPence(form.elements.amount.value);
    if (!name) return say(kind === "charge" ? "Give it a name, like the stage in the plan." : "Say what it was for.");
    if (amountPence === null || (kind === "expense" && amountPence === 0)) return say("Enter an amount in pounds, like 2,400 or 19.99.");
    if (kind === "charge") {
      call = () => source.addCharge(form.dataset.project, { kind: form.elements.kind.value, name, amountPence, dueOn: form.elements.dueOn.value || null });
    } else {
      if (!form.elements.spentOn.value) return say("Pick the date it was paid.");
      call = () => source.addExpense({ description: name, amountPence, spentOn: form.elements.spentOn.value });
    }
  }
  button.disabled = true;
  try {
    await call();
    await load(openProjects());
  } catch {
    say("That didn't go through. Please try again.");
    button.disabled = false;
  }
});

document.getElementById("sign-out").addEventListener("click", async () => {
  try { await source.logout(); } catch {}
  location.href = "signin.html";
});
