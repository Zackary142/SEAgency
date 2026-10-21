const SITE = window.SITE;

document.querySelectorAll("[data-brand]").forEach(el => { el.textContent = SITE.name; });
document.querySelectorAll("[data-brand-email]").forEach(el => { el.textContent = SITE.email; });
document.title = `${SITE.name} | ${SITE.tagline}`;
document.getElementById("year").textContent = new Date().getFullYear();

/* Enquiry form is not wired up yet; it will post to SEAgency-API. */
document.getElementById("enquiry").addEventListener("submit", e => {
  e.preventDefault();
  document.getElementById("f-status").textContent = "This form is not connected yet. Please email us instead.";
});

/* Smooth scroll for in-page links, animated in JS so it behaves the same in every browser. */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function scrollToY(targetY) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (reduceMotion.matches || Math.abs(distance) < 2) { window.scrollTo(0, targetY); return; }
  const duration = Math.min(900, Math.max(450, Math.abs(distance) * 0.4));
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, startY + distance * ease(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

document.addEventListener("click", e => {
  const link = e.target.closest('a[href^="#"]');
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const id = link.getAttribute("href").slice(1);
  const target = id ? document.getElementById(id) : document.body;
  if (!target) return;
  e.preventDefault();
  const y = id ? target.getBoundingClientRect().top + window.scrollY - 24 : 0;
  scrollToY(Math.max(0, y));
  try { history.pushState(null, "", id ? `#${id}` : location.pathname); } catch {}
});
