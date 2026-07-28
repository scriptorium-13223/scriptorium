// ─────────────────────────────────────────────
//  nav.js — View routing, bottom nav, toasts
// ─────────────────────────────────────────────

function switchView(viewName) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById(`${viewName}-view`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === viewName);
  });

  window.scrollTo({ top: 0, behavior: "instant" });

  if (viewName === "orders") renderOrdersList();
}

function openOrderFlow() {
  resetOrderFlow();
  switchView("order");
  document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
}

function toggleFaq(btn) {
  const item = btn.closest(".faq-item");
  const wasOpen = item.classList.contains("open");
  document.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
  if (!wasOpen) item.classList.add("open");
}

function showToast(message, type = "default") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
