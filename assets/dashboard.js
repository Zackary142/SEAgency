/* Customer and engineer dashboards. Reads from SEAgency-API when SITE.apiUrl is
   set, otherwise from sample-data.js (switch views with ?preview=...). */

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const PREVIEWS = { customer: "Customer", "customer-empty": "Customer, no project", engineer: "Engineer", pending: "Engineer, pending" };
const preview = API.connected ? null : (PREVIEWS[params.get("preview")] ? params.get("preview") : "customer");

/* ---------- data: the API, or sample data in preview ---------- */

function sampleSource(data) {
  const wait = value => Promise.resolve(structuredClone(value));
  return {
    me: () => wait(data.me),
    projects: status => wait(data.me.role === "customer" ? (status === "active" ? data.projects : []) : data[status] || []),
    updates: id => wait(data.updates?.[id] || null),
    colleagues: () => wait(data.colleagues || []),
    offerSupport: () => wait({}),
    acceptOffer: () => wait({}),
    declineOffer: () => wait({}),
    requestProject: () => wait({}),
    logout: () => wait({})
  };
}

/* Project routes come in a later API step. Until then they answer 501, and the
   dashboard shows its empty states rather than an error. */
const orEmpty = (call, empty) => (...args) => call(...args).catch(err => {
  if (API.notBuilt(err)) return empty;
  throw err;
});

const source = preview ? sampleSource(SAMPLE[preview]) : {
  ...API,
  projects: orEmpty(API.projects, []),
  updates: orEmpty(API.updates, null),
  colleagues: orEmpty(API.colleagues, [])
};

/* ---------- helpers ---------- */

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function when(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return esc(iso);
  const start = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((start(new Date()) - start(date)) / 86400000);
  if (days <= 0) return `today at ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const day = iso => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const fullDay = iso => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const firstName = name => String(name).split(" ")[0];
const roleLabel = role => (role === "primary" ? "Primary" : "Secondary");

const lockIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

function previewBar() {
  if (!preview) return "";
  const links = Object.entries(PREVIEWS).map(([key, label]) =>
    `<a href="?preview=${key}"${key === preview ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<div class="preview-bar"><span>Preview with sample data.</span>${links}</div>`;
}

/* ---------- customer ---------- */

function customerView(me, project, updates) {
  const latest = updates?.latest;
  const engineers = project.engineers.map(e =>
    `<div class="person"><b>${esc(e.displayName)}</b><span>${esc(e.focus || roleLabel(e.role) + " engineer")}</span></div>`).join("");
  const primary = project.engineers.find(e => e.role === "primary");
  const next = project.milestone?.next;

  const commit = latest ? `
      <div class="commit">
        <span class="dot" aria-hidden="true"></span>
        <div>
          <span class="eyebrow dim">Latest commit</span>
          <h2>${esc(latest.message)}</h2>
          <span class="mono">${esc(latest.sha)} &middot; ${esc(latest.author)} &middot; ${when(latest.committedAt)} &middot; merged into ${esc(latest.branch)}</span>
        </div>
      </div>
      <div class="notes">
        ${latest.points?.length ? `<span>Notes from ${esc(firstName(latest.author))} on this change</span>
        <ul class="plus">${latest.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : `<span>No notes on this change yet.</span>`}
        <div class="actions">
          ${project.stagingUrl ? `<a class="btn btn-primary" href="${esc(project.stagingUrl)}">Try it on staging <span class="arrow">&rarr;</span></a>` : ""}
          ${primary ? `<a class="btn btn-quiet" href="mailto:${esc(SITE.email)}">Reply to ${esc(firstName(primary.displayName))}</a>` : ""}
        </div>
      </div>` : `
      <div class="commit"><span class="dot empty" aria-hidden="true"></span><div><h2>No commits yet</h2><p>Your engineer's first changes will show up here, with notes on what they did.</p></div></div>`;

  const earlier = updates?.earlier?.length ? `
      <div class="earlier">
        <span class="eyebrow dim">Earlier</span>
        ${updates.earlier.map(c => `<div class="row"><span>${esc(c.sha)}</span><span>${esc(c.message)}</span><span>${when(c.committedAt)}</span></div>`).join("")}
      </div>` : "";

  return `
    <div class="page-head"><span class="eyebrow">Your project</span><h1>${esc(project.name)}</h1></div>
    <div class="split">
      <div class="split-main panel">
        <div class="panel-head">
          <span>${esc(project.repo.fullName)} <span class="dim">&middot; private</span></span>
          <span><span class="ok">In progress</span>${project.milestone ? ` &middot; milestone ${project.milestone.current} of ${project.milestone.total}` : ""}</span>
        </div>
        ${commit}
        ${earlier}
      </div>
      <div class="split-side">
        <div class="side-block"><span class="eyebrow">Your engineers</span>${engineers}</div>
        ${next ? `<div class="side-block"><span class="eyebrow">Next milestone</span><div class="person"><b>${esc(next.name)}</b><span>Due ${day(next.due)}</span></div></div>` : ""}
        <div class="side-block side-links">
          ${project.repo.url ? `<a href="${esc(project.repo.url)}">Open the repository on GitHub</a>` : ""}
          <a href="#request" data-action="show-request">Request another project</a>
        </div>
        <div class="side-block" id="request" hidden>${requestForm()}</div>
      </div>
    </div>`;
}

function requestForm() {
  return `
    <form class="request-form" data-form="request" novalidate>
      <div class="field"><label for="req-summary">What do you need?</label>
        <textarea id="req-summary" name="summary" maxlength="2000" placeholder="A few sentences is plenty. What it is, who uses it, and any deadline."></textarea></div>
      <div class="form-foot">
        <span class="form-msg" role="status"></span>
        <button class="btn btn-primary" type="submit">Send request <span class="arrow">&rarr;</span></button>
      </div>
    </form>`;
}

function customerEmptyView(me) {
  const asks = [
    ["A web application", "a customer portal, booking system or internal tool"],
    ["Cloud and infrastructure", "hosting, deploys, monitoring or a cost review"],
    ["A SaaS product", "accounts, billing and admin for something you sell"],
    ["Maintenance and support", "fixes and small features on software you already have"]
  ];
  const examples = [
    "Customers should be able to get a quote for a fitted wardrobe online and pay a deposit.",
    "Our WordPress site is slow and keeps going down. Can you move it somewhere reliable?",
    "We track jobs in a spreadsheet. We want a simple app the fitters can update from their phones."
  ];
  return `
    <div class="page-head"><span class="eyebrow">Your project</span><h1>Welcome, ${esc(firstName(me.displayName))}.</h1></div>
    <div class="split">
      <div class="split-main panel">
        <div class="panel-head"><span class="dim">no repository yet</span><span class="dim">0 open projects</span></div>
        <div class="commit">
          <span class="dot empty" aria-hidden="true"></span>
          <div>
            <h2>Request a project</h2>
            <p>Tell us what you need in a few sentences. We reply within one working day with a time for a scoping call, and your private repository appears here once the work starts.</p>
          </div>
        </div>
        <div class="notes">
          <span>What you can ask for</span>
          <ul class="plus">${asks.map(([t, b]) => `<li><span><b>${t}</b><span class="who">, ${b}</span></span></li>`).join("")}</ul>
        </div>
        <div class="notes">
          <span>Example requests from other clients</span>
          <ul class="plus">${examples.map(e => `<li class="quote">&ldquo;${e}&rdquo;</li>`).join("")}</ul>
          <div class="actions">
            <a class="btn btn-primary" href="#request" data-action="show-request">Request a project <span class="arrow">&rarr;</span></a>
            <a class="btn btn-quiet" href="index.html#contact">Book a call instead</a>
          </div>
          <div id="request" hidden>${requestForm()}</div>
        </div>
      </div>
      <div class="split-side">
        <div class="side-block">
          <span class="eyebrow">What happens next</span>
          <ol class="steps-sm">
            <li><span class="mono">01</span><span>A 30 minute scoping call, free</span></li>
            <li><span class="mono">02</span><span>A fixed proposal, paid per milestone</span></li>
            <li><span class="mono">03</span><span>Your repository and engineer appear here</span></li>
          </ol>
        </div>
        <div class="side-block"><span class="eyebrow">Past projects</span><p>Finished projects stay listed here with their repository.</p></div>
      </div>
    </div>`;
}

/* ---------- engineer ---------- */

function offerBlock(project, offer) {
  return `
    <div class="offer" data-offer="${esc(offer.id)}">
      <span><b>${esc(offer.engineer.displayName)}</b> <span class="who">offered to help${offer.message ? `: <q>${esc(offer.message)}</q>` : "."}</span></span>
      <div class="row-actions">
        <button class="btn btn-primary btn-small" type="button" data-action="accept" data-project="${esc(project.id)}" data-offer-id="${esc(offer.id)}">Add as secondary</button>
        <button class="btn btn-quiet btn-small" type="button" data-action="decline" data-project="${esc(project.id)}" data-offer-id="${esc(offer.id)}">Decline</button>
      </div>
    </div>`;
}

function engineerCard(p) {
  const tag = p.myRole === "primary"
    ? '<span class="ok">Primary</span>'
    : `<span class="sec">Secondary${p.addedBy ? ` &middot; added by ${esc(p.addedBy)}` : ""}</span>`;
  return `
    <div class="panel">
      <div class="panel-head"><span>${esc(p.repo.fullName)}</span>${tag}</div>
      <div class="card-body">
        <div><h3>${esc(p.name)}</h3>${p.detail ? `<span class="sub">${esc(p.detail)}</span>` : ""}</div>
        ${p.lastCommit ? `<div class="last"><span>latest commit</span><span>${esc(p.lastCommit.sha)} ${esc(p.lastCommit.message)}</span></div>` : ""}
        ${(p.offers || []).map(o => offerBlock(p, o)).join("")}
        <div class="row-actions">
          ${p.repo.url ? `<a class="btn btn-quiet btn-small" href="${esc(p.repo.url)}">Open on GitHub</a>` : ""}
        </div>
      </div>
    </div>`;
}

function colleagueRow(c) {
  const button = c.offerStatus === "pending"
    ? `<button class="btn btn-quiet btn-small" type="button" disabled>Offer sent to ${esc(firstName(c.primary))}</button>`
    : `<button class="btn btn-quiet btn-small" type="button" data-action="offer" data-project="${esc(c.id)}" data-primary="${esc(firstName(c.primary))}">Offer support</button>`;
  return `
    <div class="colleague">
      <div>
        <div class="name"><b>${esc(c.repo)}</b><span class="mono">${esc(c.stack || "")}</span></div>
        <span class="meta">Primary: ${esc(c.primary)} &middot; ${esc(c.helpWanted || "No help requested yet")}</span>
      </div>
      <div><span class="lock">${lockIcon}no access</span>${button}</div>
    </div>`;
}

function engineerView(me, active, closed, colleagues) {
  const primaries = active.filter(p => p.myRole === "primary").length;
  return `
    <section class="dash-section">
      <div class="section-head">
        <div><span class="eyebrow">Open</span><h1>Your repositories</h1></div>
        <span class="mono">${active.length} open &middot; ${primaries} as primary</span>
      </div>
      ${active.length ? `<div class="cards">${active.map(engineerCard).join("")}</div>`
        : `<p class="empty-note">You are not on any open projects. When Zack assigns you, or a primary engineer accepts your offer of support, the repository shows up here.</p>`}
    </section>

    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Closed</span><h2>Finished work</h2></div></div>
      ${closed.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Repository</th><th>Client</th><th>Your role</th><th>Released</th><th>Closed</th></tr></thead>
          <tbody>${closed.map(r => `<tr><td class="code">${esc(r.repo.fullName)}</td><td>${esc(r.client)}</td><td>${roleLabel(r.myRole)}</td><td class="tag">${esc(r.releaseTag || "")}</td><td>${fullDay(r.closedAt)}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : `<p class="empty-note">Projects you finish will be listed here.</p>`}
    </section>

    <section class="dash-section">
      <div class="section-head"><div>
        <span class="eyebrow">Colleagues</span>
        <h2>Projects you can offer to help on</h2>
        <p>You cannot see the code on these. If you offer support, the primary engineer decides whether to add you as a secondary engineer, and access starts then.</p>
      </div></div>
      ${colleagues.length ? `<div class="colleagues">${colleagues.map(colleagueRow).join("")}</div>`
        : `<p class="empty-note">No other projects are running right now.</p>`}
    </section>`;
}

function pendingView(me) {
  const rejected = me.engineerStatus === "rejected";
  return `
    <div class="page-head"><span class="eyebrow">Engineer account</span><h1>Thanks, ${esc(firstName(me.displayName))}.</h1></div>
    <div class="panel status-panel">
      <span class="eyebrow dim">${rejected ? "Not approved" : "Pending review"}</span>
      <h2>${rejected ? "Your application was not approved." : "Your account is waiting for approval."}</h2>
      <p>${rejected
        ? `We are not taking you on at the moment. Your application details are deleted after six months. If you have questions, email ${esc(SITE.email)}.`
        : "Every engineer account is reviewed by hand before it can see any project. We will email you when it has been reviewed. Until then there is nothing else to see here."}</p>
    </div>`;
}

/* ---------- loading ---------- */

function notLive() {
  app.innerHTML = `
    <div class="page-head"><span class="eyebrow">Dashboard</span><h1>Not live yet.</h1></div>
    <p class="who">The API is connected, but the dashboard routes are not built yet.</p>`;
}

async function load() {
  let me;
  try {
    me = await source.me();
  } catch (err) {
    if (err.status === 401) { location.replace("signin.html"); return; }
    if (API.notBuilt(err)) { notLive(); return; }
    throw err;
  }
  document.getElementById("who").textContent = me.companyName ? `${me.displayName}, ${me.companyName}` : `${me.displayName}, ${me.role}`;

  if (me.role === "customer") {
    const projects = await source.projects("active");
    if (!projects.length) {
      app.innerHTML = previewBar() + customerEmptyView(me);
      return;
    }
    const updates = await source.updates(projects[0].id);
    app.innerHTML = previewBar() + customerView(me, projects[0], updates);
    return;
  }

  if (me.role === "engineer" && me.engineerStatus !== "approved") {
    app.innerHTML = previewBar() + pendingView(me);
    return;
  }

  const [active, closed, colleagues] = await Promise.all([source.projects("active"), source.projects("closed"), source.colleagues()]);
  app.innerHTML = previewBar() + engineerView(me, active, closed, colleagues);
}

load().catch(err => {
  if (API.notBuilt(err)) return notLive();
  app.innerHTML = '<p class="who">Something went wrong loading your dashboard. Please refresh to try again.</p>';
});

/* ---------- actions ---------- */

app.addEventListener("click", async e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "show-request") {
    e.preventDefault();
    const box = document.getElementById("request");
    box.hidden = false;
    box.querySelector("textarea").focus();
    return;
  }

  el.disabled = true;
  try {
    if (action === "offer") {
      await source.offerSupport(el.dataset.project, "");
      el.textContent = `Offer sent to ${el.dataset.primary}`;
      return;
    }
    const block = el.closest(".offer");
    if (action === "accept") {
      await source.acceptOffer(el.dataset.project, el.dataset.offerId);
      block.innerHTML = `<span>${block.querySelector("b").outerHTML} <span class="who">is now a secondary engineer on this project.</span></span>`;
    } else if (action === "decline") {
      await source.declineOffer(el.dataset.project, el.dataset.offerId);
      block.remove();
    }
  } catch {
    el.disabled = false;
    alert("That didn't go through. Please try again.");
  }
});

app.addEventListener("submit", async e => {
  if (e.target.dataset.form !== "request") return;
  e.preventDefault();
  const form = e.target;
  const note = form.querySelector(".form-msg");
  const summary = form.elements.summary.value.trim();
  if (!summary) { note.textContent = "Please tell us a little about what you need."; return; }
  try {
    await source.requestProject(summary);
    form.reset();
    note.textContent = preview ? "In the preview nothing is sent, but this is where your request goes." : "Thanks. We will reply within one working day.";
  } catch (err) {
    note.textContent = API.notBuilt(err) ? "Requests are not switched on yet. Please email us instead." : "That didn't go through. Please try again.";
  }
});

document.getElementById("sign-out").addEventListener("click", async () => {
  try { await source.logout(); } catch {}
  location.href = "signin.html";
});
