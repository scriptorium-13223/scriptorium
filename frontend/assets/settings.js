// ─────────────────────────────────────────────
//  settings.js — Settings page interactions
// ─────────────────────────────────────────────

const INFO_CONTENT = {
  about: {
    title: "About Scriptorium",
    body: `Scriptorium is a premium assignment writing service offering both handwritten and typed assignments on quality paper stock, with flexible delivery timelines and professional finishing (covers, protectors, and more). No account or login is required — place your order directly and pay cash on delivery.`,
  },
  faq: {
    title: "Frequently Asked Questions",
    body: `<strong>Do I need an account?</strong><br/>No — order instantly, no signup.<br/><br/><strong>How is page count decided?</strong><br/>Automatically from your uploaded file — it cannot be edited manually.<br/><br/><strong>What payment methods are accepted?</strong><br/>Cash on Delivery only.`,
  },
  support: {
    title: "Support",
    body: `Need help with an existing order or have a question before ordering? Reach out to us via the contact details shared in your order confirmation, or message us directly on Telegram/WhatsApp using the number provided on our storefront.`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `We collect only the information required to fulfil your order — your name, phone number, delivery address, and the assignment file you upload. This data is used solely for processing and delivering your order and is not shared with third parties beyond what's needed for delivery. Orders are automatically removed from our systems once marked delivered.`,
  },
  terms: {
    title: "Terms & Conditions",
    body: `By placing an order on Scriptorium, you agree to pay the final invoiced amount in cash upon delivery. Page counts are determined automatically and are final. Delivery timelines are estimates and may occasionally vary due to unforeseen circumstances. Content submitted for handwriting/typing must not violate any academic integrity policies applicable to you — Scriptorium is a formatting and writing service only.`,
  },
};

function openInfoModal(key) {
  const content = INFO_CONTENT[key];
  if (!content) return;
  document.getElementById("info-modal-title").textContent = content.title;
  document.getElementById("info-modal-body").innerHTML = content.body;
  document.getElementById("info-modal").classList.add("open");
}

function closeInfoModal() {
  document.getElementById("info-modal").classList.remove("open");
}

async function shareWebsite() {
  const shareData = { title: "Scriptorium", text: "Check out Scriptorium — premium assignment writing service!", url: window.location.href };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch { /* user cancelled */ }
  } else {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Link copied to clipboard!", "success");
  }
}

function rateWebsite() {
  showToast("Thank you! We'd love your feedback — please share it with us on Telegram.", "success");
}

function confirmClearData() {
  document.getElementById("info-modal-title").textContent = "Clear Local Data?";
  document.getElementById("info-modal-body").innerHTML =
    "This will permanently delete your locally stored order history and preferences from this device. This cannot be undone.";
  const modalSheet = document.querySelector("#info-modal .modal-sheet");
  const oldBtn = modalSheet.querySelector(".confirm-clear-btn");
  if (oldBtn) oldBtn.remove();
  const btn = document.createElement("button");
  btn.className = "btn btn-primary btn-block confirm-clear-btn";
  btn.style.marginTop = "10px";
  btn.style.background = "#dc2626";
  btn.textContent = "Yes, Clear Everything";
  btn.onclick = async () => {
    await clearAllLocalData();
    localStorage.removeItem(THEME_KEY);
    closeInfoModal();
    btn.remove();
    showToast("Local data cleared.", "success");
    if (document.getElementById("orders-view").classList.contains("active")) renderOrdersList();
  };
  modalSheet.insertBefore(btn, modalSheet.querySelector(".btn-outline"));
  document.getElementById("info-modal").classList.add("open");
}
