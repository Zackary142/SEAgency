/* Customer and engineer dashboards. Reads from SEAgency-API when SITE.apiUrl is
   set, otherwise from sample-data.js (switch views with ?preview=...). */

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const PREVIEWS = { customer: "Customer", "customer-empty": "Customer, no project", engineer: "Engineer", pending: "Engineer, pending", admin: "Admin" };
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
    addNotes: () => wait({}),
    setMember: () => wait({}),
    removeMember: () => wait({}),
    syncProject: () => wait({ github: "ok" }),
    myRequests: () => wait(data.requests || []),
    engineers: status => wait(data.engineers?.[status] || []),
    approveEngineer: () => wait({}),
    rejectEngineer: () => wait({}),
    openRequests: () => wait(data.requests || []),
    allProjects: () => wait(data.allProjects || []),
    startProject: () => wait({}),
    declineRequest: () => wait({}),
    setProjectStatus: () => wait({}),
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
  // GitHub being slow or down shouldn't break the dashboard: show no commits instead.
  updates: (...args) => API.updates(...args).catch(() => null),
  colleagues: orEmpty(API.colleagues, []),
  myRequests: orEmpty(API.myRequests, [])
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
        ${latest.points?.length ? `<span>Notes from ${esc(firstName(latest.notesBy || latest.author))} on this change</span>
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
          <span>${project.repo ? `${esc(project.repo.fullName)} <span class="dim">&middot; private</span>` : `<span class="dim">repository being set up</span>`}</span>
          <span>${project.status === "paused" ? '<span class="sec">Paused</span>' : '<span class="ok">In progress</span>'}${project.milestone ? ` &middot; milestone ${project.milestone.current} of ${project.milestone.total}` : ""}</span>
        </div>
        ${commit}
        ${earlier}
      </div>
      <div class="split-side">
        <div class="side-block"><span class="eyebrow">Your engineers</span>${engineers}</div>
        ${next ? `<div class="side-block"><span class="eyebrow">Next milestone</span><div class="person"><b>${esc(next.name)}</b><span>Due ${day(next.due)}</span></div></div>` : ""}
        <div class="side-block side-links">
          ${project.repo?.url ? `<a href="${esc(project.repo.url)}">Open the repository on GitHub</a>` : ""}
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

function requestsBlock(requests) {
  if (!requests.length) return "";
  const label = { open: "Waiting for a reply", accepted: "Starting soon", declined: "Declined" };
  return `
        <div class="side-block">
          <span class="eyebrow">Your requests</span>
          ${requests.map(r => `<div class="person"><b class="clamp">${esc(r.summary)}</b><span>${label[r.status] || esc(r.status)} &middot; sent ${when(r.createdAt)}</span></div>`).join("")}
        </div>`;
}

function customerEmptyView(me, requests = []) {
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
        ${requestsBlock(requests)}
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
      <div class="panel-head"><span>${p.repo ? esc(p.repo.fullName) : '<span class="dim">repository being set up</span>'}</span>${tag}</div>
      <div class="card-body">
        <div><h3>${esc(p.name)}</h3>${p.detail || p.stack ? `<span class="sub">${esc(p.detail || p.stack)}</span>` : ""}</div>
        ${p.lastCommit ? `<div class="last"><span>latest commit</span><span>${esc(p.lastCommit.sha)} ${esc(p.lastCommit.message)}</span></div>` : ""}
        ${(p.offers || []).map(o => offerBlock(p, o)).join("")}
        <div class="row-actions">
          ${p.repo?.url ? `<a class="btn btn-quiet btn-small" href="${esc(p.repo.url)}">Open on GitHub</a>` : ""}
          ${p.lastCommit && p.status !== "closed" ? `<button class="btn btn-quiet btn-small" type="button" data-action="show-notes">Add notes for the customer</button>` : ""}
        </div>
        ${p.lastCommit && p.status !== "closed" ? `
        <form class="start-form" data-form="notes" data-project="${esc(p.id)}" hidden novalidate>
          <div class="field"><label for="notes-${esc(p.id)}">Notes on ${esc(p.lastCommit.sha)}, one point per line</label>
            <textarea id="notes-${esc(p.id)}" name="points" rows="4" placeholder="What changed, in words the customer understands.&#10;Anything they should try or decide."></textarea></div>
          <div class="form-foot">
            <span class="form-msg" role="status"></span>
            <button class="btn btn-primary btn-small" type="submit">Post notes <span class="arrow">&rarr;</span></button>
          </div>
        </form>` : ""}
      </div>
    </div>`;
}

function colleagueRow(c) {
  const button = c.offerStatus === "pending"
    ? `<button class="btn btn-quiet btn-small" type="button" disabled>Offer sent to ${esc(firstName(c.primary || "the primary"))}</button>`
    : `<button class="btn btn-quiet btn-small" type="button" data-action="offer" data-project="${esc(c.id)}" data-primary="${esc(firstName(c.primary || "the primary"))}">Offer support</button>`;
  return `
    <div class="colleague">
      <div>
        <div class="name"><b>${esc(c.stack || "Stack not set yet")}</b></div>
        <span class="meta">Primary: ${esc(c.primary || "not assigned")} &middot; ${esc(c.helpWanted || "No help requested yet")}</span>
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
          <tbody>${closed.map(r => `<tr><td class="code">${esc(r.repo?.fullName || r.name)}</td><td>${esc(r.client)}</td><td>${roleLabel(r.myRole)}</td><td class="tag">${esc(r.releaseTag || "")}</td><td>${fullDay(r.closedAt)}</td></tr>`).join("")}</tbody>
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

/* ---------- admin ---------- */

function applicantCard(e) {
  return `
    <div class="panel" data-engineer="${esc(e.id)}">
      <div class="panel-head"><span>github.com/${esc(e.githubUsername)}</span><span class="dim">applied ${when(e.appliedAt)}</span></div>
      <div class="card-body">
        <div><h3>${esc(e.displayName)}</h3><span class="sub">${esc(e.email)}</span></div>
        ${e.application ? `<p class="application">&ldquo;${esc(e.application)}&rdquo;</p>` : `<p class="sub">No note with the application.</p>`}
        <div class="row-actions">
          <button class="btn btn-primary btn-small" type="button" data-action="approve" data-id="${esc(e.id)}">Approve</button>
          <button class="btn btn-quiet btn-small" type="button" data-action="reject" data-id="${esc(e.id)}" data-name="${esc(firstName(e.displayName))}">Reject</button>
          <a class="btn btn-quiet btn-small" href="https://github.com/${encodeURIComponent(e.githubUsername)}" target="_blank" rel="noopener">GitHub profile</a>
        </div>
      </div>
    </div>`;
}

function engineerTable(list, rejected) {
  return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Engineer</th><th>GitHub</th><th>Email</th><th>${rejected ? "Rejected" : "Approved"}</th>${rejected ? "<th></th>" : ""}</tr></thead>
          <tbody>${list.map(e => `<tr data-engineer="${esc(e.id)}"><td>${esc(e.displayName)}</td><td class="code">${esc(e.githubUsername)}</td><td>${esc(e.email)}</td><td>${fullDay(e.reviewedAt)}</td>${rejected
            ? `<td><button class="btn btn-quiet btn-small" type="button" data-action="approve" data-id="${esc(e.id)}">Approve after all</button></td>` : ""}</tr>`).join("")}</tbody>
        </table>
      </div>`;
}

const customerName = c => c.companyName ? `${c.displayName}, ${c.companyName}` : c.displayName;
const STATUS = { active: '<span class="ok">Active</span>', paused: '<span class="sec">Paused</span>', closed: '<span class="dim">Closed</span>' };

function requestCard(r, engineers) {
  const options = engineers.map(e => `<option value="${esc(e.id)}">${esc(e.displayName)} (${esc(e.githubUsername)})</option>`).join("");
  return `
    <div class="panel" data-request="${esc(r.id)}">
      <div class="panel-head"><span>${esc(customerName(r.customer))}</span><span class="dim">asked ${when(r.createdAt)}</span></div>
      <div class="card-body">
        <p class="application">&ldquo;${esc(r.summary)}&rdquo;</p>
        <div class="row-actions" data-request-actions>
          <button class="btn btn-primary btn-small" type="button" data-action="show-start">Start a project</button>
          <button class="btn btn-quiet btn-small" type="button" data-action="decline-request" data-id="${esc(r.id)}" data-name="${esc(firstName(r.customer.displayName))}">Decline</button>
        </div>
        <form class="start-form" data-form="start" data-id="${esc(r.id)}" hidden novalidate>
          <div class="field"><label for="name-${esc(r.id)}">Project name</label>
            <input id="name-${esc(r.id)}" name="name" maxlength="120" placeholder="Online booking for Northgate Dental"></div>
          <div class="field"><label for="stack-${esc(r.id)}">Stack <span class="dim">(other engineers see this, not the customer)</span></label>
            <input id="stack-${esc(r.id)}" name="stack" maxlength="120" placeholder="Node · PostgreSQL · AWS"></div>
          <div class="field"><label for="primary-${esc(r.id)}">Primary engineer</label>
            <select id="primary-${esc(r.id)}" name="primaryId">${engineers.length ? `<option value="">Choose an engineer</option>${options}` : `<option value="">Approve an engineer first</option>`}</select></div>
          <div class="form-foot">
            <span class="form-msg" role="status"></span>
            <button class="btn btn-primary btn-small" type="submit">Start project <span class="arrow">&rarr;</span></button>
          </div>
        </form>
      </div>
    </div>`;
}

function manageRow(p, engineers) {
  const onIt = new Set((p.engineers || []).map(e => e.id));
  const others = engineers.filter(e => !onIt.has(e.id));
  return `
          <tr class="manage-row" data-manage="${esc(p.id)}" hidden><td colspan="7">
            <div class="manage">
              <div class="manage-list">
                ${(p.engineers || []).map(e => `
                <div class="manage-person"><span><b>${esc(e.displayName)}</b> <span class="dim">&middot; ${roleLabel(e.role).toLowerCase()}</span></span>
                  <span class="row-actions">
                    ${e.role === "secondary" ? `<button class="btn btn-quiet btn-small" type="button" data-action="make-primary" data-project="${esc(p.id)}" data-id="${esc(e.id)}">Make primary</button>` : ""}
                    <button class="btn btn-quiet btn-small" type="button" data-action="remove-member" data-project="${esc(p.id)}" data-id="${esc(e.id)}" data-name="${esc(firstName(e.displayName))}">Remove</button>
                  </span></div>`).join("") || `<p class="dim">Nobody is on this project.</p>`}
              </div>
              <div class="row-actions">
                ${others.length ? `<select class="status-select" data-add-engineer aria-label="Engineer to add">${others.map(e => `<option value="${esc(e.id)}">${esc(e.displayName)}</option>`).join("")}</select>
                <button class="btn btn-quiet btn-small" type="button" data-action="add-member" data-project="${esc(p.id)}">Add as secondary</button>` : ""}
                <button class="btn btn-quiet btn-small" type="button" data-action="sync-project" data-project="${esc(p.id)}">Sync with GitHub</button>
              </div>
            </div>
          </td></tr>`;
}

function projectTable(projects, engineers) {
  return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Project</th><th>Customer</th><th>Primary</th><th>Secondaries</th><th>Repository</th><th>Status</th><th></th></tr></thead>
          <tbody>${projects.map(p => `<tr><td class="strong">${esc(p.name)}</td><td>${esc(customerName(p.customer))}</td><td>${esc(p.primary?.displayName || "None yet")}</td><td>${p.secondaries}</td>
            <td class="code">${p.repo ? `<a href="${esc(p.repo.url)}" target="_blank" rel="noopener">${esc(p.repo.fullName.split("/")[1])}</a>` : `<span class="dim">not created</span>`}</td><td>
            <select class="status-select" data-action="project-status" data-id="${esc(p.id)}" aria-label="Status of ${esc(p.name)}">${["active", "paused", "closed"].map(st => `<option value="${st}"${st === p.status ? " selected" : ""}>${st[0].toUpperCase() + st.slice(1)}</option>`).join("")}</select></td>
            <td><button class="linkish" type="button" data-action="manage" data-project="${esc(p.id)}">Manage</button></td></tr>${manageRow(p, engineers)}`).join("")}</tbody>
        </table>
      </div>`;
}

function adminView(me, requests, projects, pending, approved, rejected) {
  const open = projects.filter(p => p.status !== "closed");
  const closed = projects.filter(p => p.status === "closed");
  return `
    <div class="page-head"><span class="eyebrow">Admin</span><h1>Welcome back, ${esc(firstName(me.displayName))}.</h1>
      <p class="who">${requests.length} new ${requests.length === 1 ? "request" : "requests"} &middot; ${pending.length} ${pending.length === 1 ? "engineer" : "engineers"} waiting &middot; ${open.length} open ${open.length === 1 ? "project" : "projects"}</p></div>

    <section class="dash-section">
      <div class="section-head">
        <div><span class="eyebrow">Requests</span><h2>Customers asking for work</h2>
        <p>Start a project once you've had the scoping call. The customer sees it on their dashboard straight away, and the primary engineer gets access.</p></div>
        <span class="mono">${requests.length} new</span>
      </div>
      ${requests.length ? `<div class="cards">${requests.map(r => requestCard(r, approved)).join("")}</div>`
        : `<p class="empty-note">No new requests. You get an email when a customer sends one.</p>`}
    </section>

    <section class="dash-section">
      <div class="section-head">
        <div><span class="eyebrow">Engineers</span><h2>Waiting for approval</h2>
        <p>An engineer can't see any project until you approve them. They're emailed either way.</p></div>
        <span class="mono">${pending.length} waiting</span>
      </div>
      ${pending.length ? `<div class="cards">${pending.map(applicantCard).join("")}</div>`
        : `<p class="empty-note">Nobody is waiting. You get an email when an engineer signs up and confirms their address.</p>`}
    </section>

    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Projects</span><h2>Open projects</h2>
        <p>Pausing keeps everyone's access. Closing removes the engineers' access and moves it to their finished work.</p></div>
        <span class="mono">${open.length} open</span></div>
      ${open.length ? projectTable(open, approved) : `<p class="empty-note">Projects you start from a request are listed here.</p>`}
    </section>
    ${closed.length ? `
    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Closed</span><h2>Finished projects</h2></div><span class="mono">${closed.length} closed</span></div>
      ${projectTable(closed, approved)}
    </section>` : ""}

    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Team</span><h2>Approved engineers</h2></div><span class="mono">${approved.length} approved</span></div>
      ${approved.length ? engineerTable(approved, false) : `<p class="empty-note">Engineers you approve are listed here.</p>`}
    </section>
    ${rejected.length ? `
    <section class="dash-section">
      <div class="section-head"><div><span class="eyebrow">Rejected</span><h2>Not approved</h2>
        <p>Applications are deleted six months after rejection.</p></div></div>
      ${engineerTable(rejected, true)}
    </section>` : ""}`;
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
      const requests = await source.myRequests();
      app.innerHTML = previewBar() + customerEmptyView(me, requests);
      return;
    }
    const updates = await source.updates(projects[0].id);
    app.innerHTML = previewBar() + customerView(me, projects[0], updates);
    return;
  }

  if (me.role === "admin") {
    const [requests, projects, pending, approved, rejected] = await Promise.all([
      source.openRequests(), source.allProjects(), ...["pending", "approved", "rejected"].map(source.engineers)
    ]);
    app.innerHTML = previewBar() + adminView(me, requests, projects, pending, approved, rejected);
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

  if (action === "show-start") {
    const card = el.closest("[data-request]");
    card.querySelector("[data-request-actions]").hidden = true;
    const form = card.querySelector("form");
    form.hidden = false;
    form.elements.name.focus();
    return;
  }
  if (action === "decline-request" && !confirm(`Decline ${el.dataset.name}'s request? They'll get an email saying you can't take it on.`)) return;
  if (action === "project-status") return;
  if (action === "manage") {
    const row = app.querySelector(`[data-manage="${el.dataset.project}"]`);
    row.hidden = !row.hidden;
    el.textContent = row.hidden ? "Manage" : "Done";
    return;
  }
  if (action === "show-notes") {
    const form = el.closest(".card-body").querySelector('[data-form="notes"]');
    form.hidden = false;
    el.hidden = true;
    form.elements.points.focus();
    return;
  }
  if (action === "remove-member" && !confirm(`Take ${el.dataset.name} off this project? Their access to the repository is removed straight away.`)) return;

  if (action === "reject" && !confirm(`Reject ${el.dataset.name}? They'll get an email saying they weren't approved.`)) return;

  el.disabled = true;
  try {
    if (["make-primary", "add-member", "remove-member", "sync-project"].includes(action)) {
      const project = el.dataset.project;
      const result = action === "make-primary" ? await source.setMember(project, el.dataset.id, "primary")
        : action === "add-member" ? await source.setMember(project, el.closest(".row-actions").querySelector("[data-add-engineer]").value, "secondary")
        : action === "remove-member" ? await source.removeMember(project, el.dataset.id)
        : await source.syncProject(project);
      if (result?.github === "failed") alert("Saved, but GitHub didn't respond. Use \"Sync with GitHub\" to try again in a minute.");
      if (preview) { el.disabled = false; return; }
      await load();
      // Keep the project open where the admin was working.
      app.querySelector(`[data-action="manage"][data-project="${project}"]`)?.click();
      return;
    }
    if (action === "decline-request") {
      await source.declineRequest(el.dataset.id);
      if (preview) { el.closest("[data-request]").remove(); return; }
      return load();
    }
    if (action === "approve" || action === "reject") {
      await (action === "approve" ? source.approveEngineer : source.rejectEngineer)(el.dataset.id);
      if (preview) { el.closest("[data-engineer]").remove(); return; }
      return load();
    }
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

app.addEventListener("change", async e => {
  const el = e.target.closest('[data-action="project-status"]');
  if (!el) return;
  const status = el.value;
  if (status === "closed" && !confirm("Close this project? Engineers lose access to it, and it moves to finished work.")) return load();
  el.disabled = true;
  try {
    const result = await source.setProjectStatus(el.dataset.id, status);
    if (result?.github === "failed") alert("Saved, but GitHub didn't respond, so repository access may be out of date. Use \"Sync with GitHub\" under Manage to try again.");
    if (!preview) return load();
  } catch {
    alert("That didn't go through. Please try again.");
    if (!preview) return load();
  } finally {
    el.disabled = false;
  }
});

app.addEventListener("submit", async e => {
  if (e.target.dataset.form !== "notes") return;
  e.preventDefault();
  const form = e.target;
  const note = form.querySelector(".form-msg");
  const points = form.elements.points.value.split("\n").map(line => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  if (!points.length) { note.textContent = "Write at least one point."; return; }
  if (points.length > 8) { note.textContent = "Eight points at most, so it stays readable."; return; }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await source.addNotes(form.dataset.project, points);
    form.reset();
    note.textContent = preview ? "In the preview nothing is sent." : "Posted. The customer can see it now.";
  } catch {
    note.textContent = "That didn't go through. Please try again.";
  } finally {
    button.disabled = false;
  }
});

app.addEventListener("submit", async e => {
  if (e.target.dataset.form !== "start") return;
  e.preventDefault();
  const form = e.target;
  const note = form.querySelector(".form-msg");
  const name = form.elements.name.value.trim();
  const primaryId = form.elements.primaryId.value;
  if (!name) { note.textContent = "Give the project a name."; return; }
  if (!primaryId) { note.textContent = "Choose a primary engineer."; return; }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const result = await source.startProject({ requestId: form.dataset.id, name, stack: form.elements.stack.value.trim(), primaryId });
    if (result?.github === "failed") alert("The project has started, but GitHub didn't respond, so its repository isn't made yet. Use \"Sync with GitHub\" under Manage to try again.");
    if (preview) { note.textContent = "In the preview nothing is saved, but this starts the project."; return; }
    return load();
  } catch {
    note.textContent = "That didn't go through. Please try again.";
  } finally {
    button.disabled = false;
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
    if (!preview) { await load(); return; }
    note.textContent = preview ? "In the preview nothing is sent, but this is where your request goes." : "Thanks. We will reply within one working day.";
  } catch (err) {
    note.textContent = API.notBuilt(err) ? "Requests are not switched on yet. Please email us instead."
      : err.code === "invalid_body" ? "Please tell us a bit more, a sentence or two is plenty."
      : err.code === "too_many_open_requests" ? "You already have a few requests waiting. We'll reply to those first."
      : "That didn't go through. Please try again.";
  }
});

document.getElementById("sign-out").addEventListener("click", async () => {
  try { await source.logout(); } catch {}
  location.href = "signin.html";
});
