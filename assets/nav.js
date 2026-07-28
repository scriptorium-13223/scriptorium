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

// ── Auto-hide app bar + bottom nav on scroll (professional feel) ──
let lastScrollY = window.scrollY;
let scrollTicking = false;

window.addEventListener("scroll", () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(() => {
      const current = window.scrollY;
      const appBar = document.querySelector(".app-bar");
      const bottomNav = document.querySelector(".bottom-nav");
      const scrolledDown = current > lastScrollY && current > 80;
      const scrolledUp = current < lastScrollY;

      if (scrolledDown) {
        appBar.classList.add("nav-hidden");
        bottomNav.classList.add("nav-hidden");
      } else if (scrolledUp || current < 80) {
        appBar.classList.remove("nav-hidden");
        bottomNav.classList.remove("nav-hidden");
      }
      lastScrollY = current;
      scrollTicking = false;
    });
    scrollTicking = true;
  }
});

// ── Logo Flip Card (click -> confetti burst -> coin-flip -> admin-set text) ──
function handleLogoFlip() {
  const inner = document.getElementById("flip-card-inner");
  const wasFlipped = inner.classList.contains("flipped");
  if (!wasFlipped) fireConfetti();
  inner.classList.toggle("flipped");
}

function fireConfetti() {
  const colors = ["#ff4103", "#ff6a3d", "#c9a15a", "#001621", "#faf7f2"];
  const card = document.getElementById("logo-flip-card");
  const rect = card.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  for (let i = 0; i < 26; i++) {
    const piece = document.createElement("div");
    const size = 6 + Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 120;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40;

    piece.style.cssText = `
      position: fixed; left: ${originX}px; top: ${originY}px;
      width: ${size}px; height: ${size}px; background: ${colors[i % colors.length]};
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
      z-index: 200; pointer-events: none;
      transition: transform 0.9s cubic-bezier(0.2,0.8,0.3,1), opacity 0.9s ease;
      opacity: 1;
    `;
    document.body.appendChild(piece);
    requestAnimationFrame(() => {
      piece.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`;
      piece.style.opacity = "0";
    });
    setTimeout(() => piece.remove(), 950);
  }
}

// ── Fetch public settings (live pricing, orders-open status, flip-card text) ──
async function loadPublicSettings() {
  try {
    const data = await fetchPublicSettings();

    // Update live estimate rates to match whatever admin has configured
    if (data.pricing) {
      PRICING_ESTIMATE.handwritten = data.pricing.handwritten;
      PRICING_ESTIMATE.typed = data.pricing.typed;
      const m = data.pricing.materials;
      PRICING_ESTIMATE.materials = {
        ruled_a4: m.ruledPaperPerSheet, hindi_ruled: m.ruledPaperPerSheet, punch_ruled: m.punchRuledPerSheet,
        punch_blank: m.blankPerPage, punch_interleaved: m.interleavedPerPage, a4_white: 0, a4: 0, a4_hole_punch: 0,
      };
      PRICING_ESTIMATE.cover = { none: 0, transparent_plastic: m.transparentCover, plastic_clip: m.plasticClip, hard_cover: m.hardCover };
      PRICING_ESTIMATE.addons = {
        black_cover: m.blackCover, brown_cover: m.brownCover, custom_cover: m.customCover,
        plastic_sheet_protector: m.plasticSheetProtector, name_slip: m.nameSlip,
      };
    }

    if (data.flipCardText) {
      document.getElementById("flip-card-text").textContent = data.flipCardText;
    }

    const banner = document.getElementById("orders-closed-banner");
    if (data.ordersOpen === false) {
      banner.style.display = "block";
      window.ORDERS_CURRENTLY_OPEN = false;
    } else {
      banner.style.display = "none";
      window.ORDERS_CURRENTLY_OPEN = true;
    }
  } catch {
    // Silent fail - site still works with default hardcoded estimate rates
    window.ORDERS_CURRENTLY_OPEN = true;
  }
}
document.addEventListener("DOMContentLoaded", loadPublicSettings);
