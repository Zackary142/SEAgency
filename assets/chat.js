/* Chat between a project's customer, its engineers and the admin. Reads from
   SEAgency-API when SITE.apiUrl is set, otherwise from sample-chats.js
   (switch views with ?preview=customer, engineer or admin).
   The open chat checks for new messages every few seconds while the page is
   visible, and the list refreshes less often. No websockets. */

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const PREVIEWS = { customer: "Customer", engineer: "Engineer", admin: "Admin" };
const preview = API.connected ? null : (PREVIEWS[params.get("preview")] ? params.get("preview") : "customer");
const POLL_MS = 4000;
const LIST_MS = 15000;

/* ---------- data: the API, or sample chats in preview ---------- */

function sampleSource(view) {
  const { me, chats: ids } = SAMPLE_CHATS.views[view];
  const unread = { ...SAMPLE_CHATS.unread[view] };
  let n = 0;
  const toMessage = ([name, role, createdAt, body]) => ({
    id: `m-${++n}`, body, createdAt,
    author: { displayName: name, role, isMe: name === me.displayName }
  });
  const store = Object.fromEntries(ids.map(id => [id, SAMPLE_CHATS.chats[id].messages.map(toMessage)]));
  const canPost = id => SAMPLE_CHATS.chats[id].status !== "closed";
  const listeners = new Set();
  const wait = value => Promise.resolve(structuredClone(value));

  // A pretend reply after you send, so the preview shows how a conversation feels.
  function replyTo(id) {
    const chat = SAMPLE_CHATS.chats[id];
    const text = me.role === "customer" ? chat.replies.customer : chat.replies.engineer;
    if (!text) return;
    const [name, role] = me.role === "customer" ? [chat.engineers[0], "engineer"] : [chat.customer.split(",")[0], "customer"];
    setTimeout(() => listeners.forEach(fn => fn(id, "typing", name)), 1200);
    setTimeout(() => {
      store[id].push(toMessage([name, role, new Date().toISOString(), text]));
      unread[id] = (unread[id] || 0) + 1;
      listeners.forEach(fn => fn(id, "message"));
    }, 3200);
  }

  return {
    onChange: fn => listeners.add(fn),
    me: () => wait(me),
    chats: () => wait(ids.map(id => {
      const chat = SAMPLE_CHATS.chats[id];
      const messages = store[id];
      return {
        projectId: id, name: chat.name, status: chat.status,
        with: me.role === "customer" ? chat.engineers : [chat.customer.split(", ")[1] || chat.customer],
        lastMessage: messages.at(-1) || null,
        unread: unread[id] || 0,
        canPost: canPost(id)
      };
    }).sort((a, b) => (b.lastMessage?.createdAt || "").localeCompare(a.lastMessage?.createdAt || ""))),
    messages: (id, query = "") => {
      const after = new URLSearchParams(query).get("after");
      const all = store[id] || [];
      const from = after ? all.findIndex(m => m.id === after) + 1 : 0;
      return wait({ messages: all.slice(from), more: false, canPost: canPost(id) });
    },
    sendMessage: (id, body) => {
      const message = toMessage([me.displayName, me.role, new Date().toISOString(), body]);
      message.author.isMe = true;
      store[id].push(message);
      replyTo(id);
      return wait(message);
    },
    markRead: id => { unread[id] = 0; return wait(null); },
    logout: () => wait({})
  };
}

const source = preview ? sampleSource(preview) : API;

/* ---------- helpers ---------- */

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const time = iso => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysAgo = iso => Math.round((startOf(new Date()) - startOf(new Date(iso))) / 86400000);

function dayLabel(iso) {
  const days = daysAgo(iso);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: days < 7 ? "long" : undefined, day: "numeric", month: "long" });
}
function shortWhen(iso) {
  const days = daysAgo(iso);
  if (days <= 0) return time(iso);
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Labels a person by what they are to the reader: customers see "Your engineer", engineers see "Client".
function roleTag(role) {
  if (role === "admin") return `<span class="chat-tag chat-tag-admin">${esc(SITE.name)} admin</span>`;
  if (role === "customer") return me?.role === "customer" ? "" : '<span class="chat-tag">Client</span>';
  return me?.role === "customer" ? '<span class="chat-tag">Your engineer</span>' : '<span class="chat-tag">Engineer</span>';
}
const statusPill = status => status === "closed" ? '<span class="pill pill-closed">Finished</span>'
  : status === "paused" ? '<span class="pill pill-paused">Paused</span>' : "";

function previewBar() {
  if (!preview) return "";
  const links = Object.entries(PREVIEWS).map(([key, label]) =>
    `<a href="?preview=${key}"${key === preview ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<div class="preview-bar"><span>Preview with example chats. Try sending a message.</span>${links}</div>`;
}

/* ---------- state ---------- */

let me = null;
let chats = [];
let openId = null;
let messages = [];
let canPost = false;
let pollTimer = null;
let listTimer = null;

/* ---------- rendering ---------- */

function listItem(c) {
  const last = c.lastMessage;
  const snippet = last ? `${last.author.isMe ? "You: " : ""}${last.body}` : "No messages yet";
  return `
      <li><a class="chat-item${c.projectId === openId ? " is-open" : ""}${c.unread ? " has-unread" : ""}" href="#${esc(c.projectId)}"${c.projectId === openId ? ' aria-current="true"' : ""}>
        <span class="chat-item-top"><b>${esc(c.name)}</b>${last ? `<time datetime="${esc(last.createdAt)}">${shortWhen(last.createdAt)}</time>` : ""}</span>
        <span class="chat-item-with">${esc(c.with.join(", "))} ${statusPill(c.status)}</span>
        <span class="chat-item-last"><span>${esc(snippet)}</span>${c.unread ? `<span class="chat-badge" aria-label="${c.unread} unread">${c.unread}</span>` : ""}</span>
      </a></li>`;
}

function renderList() {
  const list = document.getElementById("chat-list");
  if (!list) return;
  list.innerHTML = chats.length ? chats.map(listItem).join("") : "";
}

function bubble(m, prev) {
  const newDay = !prev || startOf(new Date(prev.createdAt)).getTime() !== startOf(new Date(m.createdAt)).getTime();
  // Back-to-back messages from the same person within five minutes share one name line.
  const grouped = !newDay && prev && prev.author.displayName === m.author.displayName && prev.author.role === m.author.role
    && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60000;
  return `${newDay ? `<li class="chat-day"><span>${dayLabel(m.createdAt)}</span></li>` : ""}
        <li class="msg${m.author.isMe ? " msg-me" : ""}${m.author.role === "admin" ? " msg-admin" : ""}${grouped ? " msg-grouped" : ""}" data-id="${esc(m.id)}">
          ${grouped ? "" : `<span class="msg-meta">${m.author.isMe ? "You" : `<b>${esc(m.author.displayName)}</b> ${roleTag(m.author.role)}`}</span>`}
          <p class="msg-body">${esc(m.body)}</p>
          <time class="msg-time" datetime="${esc(m.createdAt)}">${time(m.createdAt)}</time>
        </li>`;
}

function renderMessages(stick = true) {
  const box = document.getElementById("msgs");
  if (!box) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = messages.length
    ? `<ol class="msg-list">${messages.map((m, i) => bubble(m, messages[i - 1])).join("")}</ol>`
    : '<p class="chat-empty">No messages yet. Say hello and ask anything about the project.</p>';
  if (stick || nearBottom) box.scrollTop = box.scrollHeight;
}

function conversation(chat) {
  if (!chat) {
    return `<div class="chat-none"><p>${chats.length ? "Choose a conversation." : noChatsText()}</p></div>`;
  }
  const people = me.role === "customer" ? `With ${chat.with.join(" and ")}` : `${chat.with.join(", ")}`;
  const composer = canPost ? `
        <form class="chat-compose" id="compose" novalidate>
          <label class="sr-only" for="chat-text">Message</label>
          <textarea id="chat-text" name="body" rows="1" maxlength="4000" placeholder="Write a message"></textarea>
          <button class="btn btn-primary btn-small" type="submit">Send</button>
        </form>
        <p class="chat-hint" id="chat-hint">Enter to send, Shift and Enter for a new line.</p>`
    : `<p class="chat-closed">${chat.status === "closed" ? "This project has finished, so the chat is read only." : "You can read this chat but not post in it."}</p>`;
  return `
      <div class="chat-head">
        <a class="chat-back linkish" href="#" aria-label="Back to all chats">&larr;</a>
        <div><h2>${esc(chat.name)}</h2><span class="who">${esc(people)} ${statusPill(chat.status)}</span></div>
      </div>
      <div class="chat-msgs" id="msgs" tabindex="0" aria-label="Messages" aria-live="polite"></div>
      <p class="chat-typing" id="typing" hidden></p>
      ${composer}`;
}

function noChatsText() {
  if (me.role === "customer") return "Your chat with your engineers opens here once your project starts.";
  if (me.role === "admin") return "Chats appear here once projects start.";
  return "Chats appear here once you're on a project.";
}

function render() {
  const chat = chats.find(c => c.projectId === openId) || null;
  app.innerHTML = `${previewBar()}
    <div class="page-head"><h1>Chat</h1>
      <p class="who">${me.role === "customer" ? "Talk to the engineers on your project. They usually reply within a working day."
        : me.role === "admin" ? "Every project's chat. You can read and post in any of them."
        : "Talk to the clients on your projects."}</p></div>
    <div class="chat${chat ? " is-open" : ""}">
      <aside class="chat-side panel" aria-label="Conversations"><ul class="chat-list" id="chat-list"></ul></aside>
      <section class="chat-main-panel panel" aria-label="Conversation">${conversation(chat)}</section>
    </div>`;
  renderList();
  renderMessages();
}

/* ---------- loading and polling ---------- */

async function refreshList() {
  chats = await source.chats();
  renderList();
}

async function openChat(id) {
  clearTimeout(pollTimer);
  openId = chats.some(c => c.projectId === id) ? id : null;
  messages = [];
  if (!openId) { render(); return; }
  const page = await source.messages(openId);
  messages = page.messages;
  canPost = page.canPost;
  render();
  // On a phone the conversation fills the screen, so bring all of it into view.
  if (window.matchMedia("(max-width: 760px)").matches) document.querySelector(".chat")?.scrollIntoView({ block: "end" });
  await markRead();
  schedulePoll();
}

async function markRead() {
  if (!openId || document.visibilityState !== "visible") return;
  const chat = chats.find(c => c.projectId === openId);
  if (chat?.unread) { chat.unread = 0; renderList(); }
  try { await source.markRead(openId); } catch {}
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, POLL_MS);
}

async function poll() {
  if (!openId) return;
  if (document.visibilityState === "visible") {
    try {
      const last = messages.at(-1);
      const page = await source.messages(openId, last ? `?after=${encodeURIComponent(last.id)}` : "");
      const fresh = page.messages.filter(m => !messages.some(x => x.id === m.id));
      if (fresh.length) {
        messages.push(...fresh);
        hideTyping();
        renderMessages(false);
        updateListFrom(openId);
        await markRead();
      }
      if (page.more) { poll(); return; }
    } catch {}
  }
  schedulePoll();
}

function updateListFrom(id) {
  const chat = chats.find(c => c.projectId === id);
  if (chat && messages.length) chat.lastMessage = messages.at(-1);
  chats.sort((a, b) => (b.lastMessage?.createdAt || "").localeCompare(a.lastMessage?.createdAt || ""));
  renderList();
}

function hideTyping() {
  const el = document.getElementById("typing");
  if (el) el.hidden = true;
}

/* ---------- events ---------- */

app.addEventListener("submit", async e => {
  if (e.target.id !== "compose") return;
  e.preventDefault();
  const form = e.target;
  const field = form.elements.body;
  const hint = document.getElementById("chat-hint");
  const body = field.value.trim();
  if (!body) return;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const message = await source.sendMessage(openId, body);
    if (!messages.some(m => m.id === message.id)) messages.push(message);
    field.value = "";
    autosize(field);
    hint.textContent = "Enter to send, Shift and Enter for a new line.";
    renderMessages();
    updateListFrom(openId);
  } catch (err) {
    hint.textContent = err.code === "project_closed" ? "This project has finished, so the chat is read only now."
      : err.status === 429 ? "That's a lot of messages at once. Wait a moment and try again."
      : "That didn't send. Please try again.";
  } finally {
    button.disabled = false;
    field.focus();
  }
});

function autosize(field) {
  field.style.height = "auto";
  field.style.height = `${Math.min(field.scrollHeight, 180)}px`;
}

app.addEventListener("input", e => { if (e.target.id === "chat-text") autosize(e.target); });
app.addEventListener("keydown", e => {
  if (e.target.id !== "chat-text" || e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  e.target.form.requestSubmit();
});

window.addEventListener("hashchange", () => openChat(decodeURIComponent(location.hash.slice(1))));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { markRead(); poll(); refreshList().catch(() => {}); }
});

source.onChange?.((id, kind, name) => {
  if (id !== openId) { refreshList(); return; }
  const el = document.getElementById("typing");
  if (kind === "typing" && el) { el.textContent = `${name} is typing…`; el.hidden = false; }
  if (kind === "message") { poll(); refreshList(); }
});

document.getElementById("sign-out").addEventListener("click", async () => {
  try { await source.logout(); } catch {}
  location.href = "signin.html";
});

/* ---------- start ---------- */

async function start() {
  try {
    me = await source.me();
  } catch (err) {
    if (err.status === 401) { location.replace("signin.html"); return; }
    app.innerHTML = '<p class="who">Chat isn\'t available right now. Please try again later.</p>';
    return;
  }
  document.getElementById("who").textContent = me.companyName ? `${me.displayName}, ${me.companyName}`
    : me.role === "customer" ? me.displayName : `${me.displayName}, ${me.role}`;
  if (preview) document.getElementById("dash-link").href = `dashboard.html?preview=${preview}`;

  if (me.role === "engineer" && me.engineerStatus !== "approved") {
    app.innerHTML = '<div class="panel status-panel"><h2>Chat opens once you\'re approved</h2><p>When an admin approves your account and adds you to a project, you can talk to its client here.</p></div>';
    return;
  }
  try {
    await refreshList();
  } catch {
    app.innerHTML = '<p class="who">Something went wrong loading your chats. Please refresh to try again.</p>';
    return;
  }
  // Open the chat in the address, or on wider screens the most recent one.
  const wanted = decodeURIComponent(location.hash.slice(1));
  const first = window.matchMedia("(min-width: 761px)").matches ? chats[0]?.projectId : null;
  await openChat(wanted || first);
  listTimer = setInterval(() => { if (document.visibilityState === "visible") refreshList().catch(() => {}); }, LIST_MS);
}

start();
