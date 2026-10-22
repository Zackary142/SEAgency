/* Light or dark: follows the system setting until someone presses the bulb, then remembers their choice. Loaded in <head> without defer so the page never flashes the wrong theme. */
(() => {
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: light)");
  const saved = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
  const current = () => saved() || (system.matches ? "light" : "dark");

  function apply(theme) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "light" ? "#F5F7F5" : "#0F1312";
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      const next = theme === "light" ? "dark" : "light";
      btn.setAttribute("aria-label", `Switch to ${next} mode`);
      btn.title = `Switch to ${next} mode`;
    }
  }

  apply(current());
  system.addEventListener("change", () => { if (!saved()) apply(current()); });

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".top nav");
    if (!nav) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "theme-toggle";
    btn.className = "theme-toggle";
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
      + '<path class="glass" d="M12 4.5a5.5 5.5 0 0 0-3.3 9.9c.6.5.9 1.1.9 1.8v.3h4.8v-.3c0-.7.3-1.3.9-1.8A5.5 5.5 0 0 0 12 4.5z"/>'
      + '<path d="M9.8 19.5h4.4M10.6 22h2.8"/>'
      + '<path class="rays" d="M12 1v1.2M3.5 4.5l.9.9M20.5 4.5l-.9.9M1 10.5h1.2M21.8 10.5H23"/>'
      + '</svg>';
    btn.addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      // Back to following the system when the choice matches it, so a later OS switch still applies.
      try {
        if (next === (system.matches ? "light" : "dark")) localStorage.removeItem("theme");
        else localStorage.setItem("theme", next);
      } catch {}
      apply(next);
    });
    nav.append(btn);
    apply(root.dataset.theme);
  });
})();
