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
