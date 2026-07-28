// ─────────────────────────────────────────────
//  theme.js — Dark / Light / System theme handling
// ─────────────────────────────────────────────

const THEME_KEY = "scriptorium_theme"; // "dark" | "light" | "system"

function applyTheme(mode) {
  let effective = mode;
  if (mode === "system") {
    effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", effective);
}

function setThemePreference(mode) {
  localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
  document.querySelectorAll(".theme-toggle-group button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === mode);
  });
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(saved);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((localStorage.getItem(THEME_KEY) || "system") === "system") applyTheme("system");
  });
}

initTheme();
