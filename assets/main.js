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

  // Pre-warm the backend immediately on page load (fire-and-forget). Render's free
  // tier sleeps after inactivity; pinging health as soon as the site opens gives
  // the server a head start waking up while the customer is still browsing/filling
  // the form, so by the time they reach Upload it's usually already awake.
  fetch(`${API_BASE_URL}/health`).catch(() => {});
});
