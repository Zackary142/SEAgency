/* Sign in and create account, on one page. #register opens the create account
   tab, and #engineer opens it with the engineer option picked. */

/* Must match the "Last updated" version on privacy.html. The API stores which
   version each person saw when they signed up. */
const PRIVACY_NOTICE_VERSION = "2026-10-21";

const form = document.getElementById("auth-form");
const msg = document.getElementById("auth-msg");
const tabs = { signin: document.getElementById("tab-signin"), register: document.getElementById("tab-register") };
let mode = "signin";

document.getElementById("forgot").href = `mailto:${SITE.email}?subject=Password%20reset`;

const copy = {
  signin: {
    title: "Sign in to your workspace.",
    intro: "Clients and engineers sign in here. You will land on the dashboard for your account type."
  },
  register: {
    title: "Create your account.",
    intro: "One account type for clients and one for engineers. Pick the one that fits and we will set up the right dashboard."
  }
};

function role() {
  return form.elements.role.value;
}

function render() {
  const reg = mode === "register";
  const eng = reg && role() === "engineer";
  tabs.signin.setAttribute("aria-selected", String(!reg));
  tabs.register.setAttribute("aria-selected", String(reg));
  form.querySelectorAll("[data-register]").forEach(el => { el.hidden = !reg; });
  form.querySelectorAll("[data-signin]").forEach(el => { el.hidden = reg; });
  form.querySelectorAll("[data-engineer]").forEach(el => { el.hidden = !eng; });
  form.querySelectorAll("[data-customer]").forEach(el => { el.hidden = !reg || eng; });
  form.elements.password.autocomplete = reg ? "new-password" : "current-password";
  document.getElementById("auth-title").textContent = copy[mode].title;
  document.getElementById("auth-intro").textContent = copy[mode].intro;
  document.getElementById("auth-submit").textContent = reg ? (eng ? "Apply as an engineer" : "Create account") : "Sign in";
  msg.textContent = "";
  msg.classList.remove("err");
}

function setMode(next) {
  mode = next;
  render();
}

function fromHash() {
  if (location.hash.startsWith("#verify=")) {
    setMode("signin");
    verify(location.hash.slice("#verify=".length));
  } else if (location.hash === "#engineer") {
    form.elements.role.value = "engineer";
    setMode("register");
  } else {
    setMode(location.hash === "#register" ? "register" : "signin");
  }
}

tabs.signin.addEventListener("click", () => setMode("signin"));
tabs.register.addEventListener("click", () => setMode("register"));
form.addEventListener("change", e => { if (e.target.name === "role") render(); });
window.addEventListener("hashchange", fromHash);
fromHash();

function problem() {
  const f = form.elements;
  if (mode === "register" && !f.displayName.value.trim()) return "Please add your name.";
  if (!f.email.validity.valid || !f.email.value) return "Please enter a valid email address.";
  if (mode === "register" && f.password.value.length < 12) return "Your password needs at least 12 characters.";
  if (mode === "signin" && !f.password.value) return "Please enter your password.";
  if (mode === "register" && role() === "engineer" && !f.githubUsername.value.trim()) return "Please add your GitHub username.";
  return "";
}

function body() {
  const f = form.elements;
  if (mode === "signin") return { email: f.email.value.trim(), password: f.password.value };
  const eng = role() === "engineer";
  return {
    role: role(),
    displayName: f.displayName.value.trim(),
    email: f.email.value.trim(),
    password: f.password.value,
    companyName: eng ? undefined : f.companyName.value.trim() || undefined,
    githubUsername: eng ? f.githubUsername.value.trim() : undefined,
    application: eng ? f.application.value.trim() || undefined : undefined,
    marketingOptIn: f.marketingOptIn.checked,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION
  };
}

function say(text, isError) {
  msg.textContent = text;
  msg.classList.toggle("err", Boolean(isError));
}

function previewLink() {
  const view = mode === "register" && role() === "engineer" ? "pending" : role() === "engineer" ? "engineer" : "customer";
  return `dashboard.html?preview=${view}`;
}

function notLiveYet() {
  msg.classList.remove("err");
  msg.innerHTML = "";
  msg.append("Accounts are not switched on yet. ");
  const a = document.createElement("a");
  a.href = previewLink();
  a.textContent = "Preview the dashboard";
  msg.append(a);
}

const ERRORS = {
  wrong_email_or_password: "That email and password don't match an account.",
  email_not_verified: "Please confirm your email first. We've sent you a new link.",
  password_breached: "That password has appeared in a known data breach. Please choose a different one.",
  github_username_taken: "That GitHub username is already linked to an account.",
  too_many_attempts: "Too many attempts. Please wait 15 minutes and try again.",
  invalid_body: "Please check the form and try again.",
  database_not_configured: "Accounts are not switched on yet.",
  429: "Too many attempts. Please wait a minute and try again."
};

/* The link in the confirmation email lands here as #verify=<token>. */
async function verify(token) {
  history.replaceState(null, "", location.pathname);
  if (!API.connected) return notLiveYet();
  say("Confirming your email\u2026");
  try {
    await API.verifyEmail(token);
    location.href = "dashboard.html";
  } catch (err) {
    say(err.code === "link_expired"
      ? "That link has expired or was already used. Sign in and we'll send you a new one."
      : "We couldn't confirm your email. Please try the link again.", true);
  }
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const issue = problem();
  if (issue) return say(issue, true);
  if (!API.connected) return notLiveYet();

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  say(mode === "signin" ? "Signing in…" : "Creating your account…");
  try {
    if (mode === "signin") {
      await API.login(body());
      location.href = "dashboard.html";
    } else {
      await API.signup(body());
      form.reset();
      render();
      say("Account created. Check your email for a link to confirm your address.");
    }
  } catch (err) {
    if (API.notBuilt(err)) notLiveYet();
    else say(ERRORS[err.code] || ERRORS[err.status] || "Something went wrong. Please try again.", true);
  } finally {
    button.disabled = false;
  }
});
