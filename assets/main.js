// ─────────────────────────────────────────────
//  main.js — App bootstrap
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("app-version").textContent = APP_VERSION;
  document.getElementById("max-upload-label").textContent = MAX_UPLOAD_SIZE_MB;
  const savedTheme = localStorage.getItem(THEME_KEY) || "system";
  document.querySelectorAll(".theme-toggle-group button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === savedTheme);
  });
  document.getElementById("info-modal").addEventListener("click", (e) => {
    if (e.target.id === "info-modal") closeInfoModal();
  });
});
