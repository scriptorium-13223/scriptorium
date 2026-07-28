// ─────────────────────────────────────────────
//  admin.js — Admin panel (order management via lightweight UI)
// ─────────────────────────────────────────────

const ADMIN_TOKEN_KEY = "scriptorium_admin_token";
let currentStatusFilter = "";

function showToast(message, type = "default") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

async function handleAdminLogin() {
  const secret = document.getElementById("admin-secret-input").value;
  if (!secret) return;
  const label = document.getElementById("login-btn-label");
  label.innerHTML = `<div class="spinner" style="display:inline-block;"></div>`;
  try {
    const result = await adminLogin(secret);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-app").style.display = "block";
    loadOrders();
    loadStoreSettings();
  } catch (err) {
    showToast(err.message || "Login failed.", "error");
  } finally {
    label.textContent = "Unlock";
  }
}

// ── Tab switching ──
function setAdminTab(tab, btn) {
  document.querySelectorAll("#admin-main-tabs button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".admin-panel").forEach((p) => (p.style.display = "none"));
  document.getElementById(`admin-panel-${tab}`).style.display = "block";
  if (tab === "coupons") loadCoupons();
  if (tab === "pricing" || tab === "settings") loadStoreSettings();
}

// ── Store Settings: open/close, telegram chat id, flip text ──
let currentSettingsCache = null;

async function loadStoreSettings() {
  try {
    const settings = await adminGetSettings();
    currentSettingsCache = settings;

    const isOpen = settings.orders_open !== false;
    document.getElementById("store-status-label").textContent = isOpen ? "🟢 Open — accepting orders" : "🔴 Closed — paused";
    document.getElementById("store-toggle-btn").textContent = isOpen ? "Close Store" : "Open Store";

    document.getElementById("telegram-chat-id-input").value = settings.telegram_chat_id || "";
    document.getElementById("flip-text-input").value = settings.flip_card_text || "";

    const p = settings.pricing;
    if (p) {
      document.getElementById("price-hw-2-3").value = p.handwritten["2-3"];
      document.getElementById("price-hw-3-5").value = p.handwritten["3-5"];
      document.getElementById("price-hw-5-7").value = p.handwritten["5-7"];
      document.getElementById("price-typed").value = p.typed;
      document.getElementById("price-ruled").value = p.materials.ruledPaperPerSheet;
      document.getElementById("price-punch-ruled").value = p.materials.punchRuledPerSheet;
      document.getElementById("price-interleaved").value = p.materials.interleavedPerPage;
      document.getElementById("price-blank").value = p.materials.blankPerPage;
      document.getElementById("price-transparent").value = p.materials.transparentCover;
      document.getElementById("price-clip").value = p.materials.plasticClip;
      document.getElementById("price-hardcover").value = p.materials.hardCover;
      document.getElementById("price-colorcover").value = p.materials.blackCover;
      document.getElementById("price-sheet-protector").value = p.materials.plasticSheetProtector;
      document.getElementById("price-nameslip").value = p.materials.nameSlip;
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function toggleOrdersOpen() {
  const isCurrentlyOpen = currentSettingsCache ? currentSettingsCache.orders_open !== false : true;
  try {
    await adminSetOrdersOpen(!isCurrentlyOpen);
    showToast(!isCurrentlyOpen ? "Store is now OPEN for orders." : "Store is now CLOSED to new orders.", "success");
    loadStoreSettings();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function saveTelegramChatId() {
  const chatId = document.getElementById("telegram-chat-id-input").value.trim();
  if (!chatId) return showToast("Enter a chat ID first.", "error");
  try {
    await adminUpdateTelegramChatId(chatId);
    showToast("Telegram chat ID updated.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function saveFlipText() {
  const text = document.getElementById("flip-text-input").value.trim();
  if (!text) return showToast("Enter some text first.", "error");
  try {
    await adminUpdateFlipText(text);
    showToast("Flip-card text updated.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function savePricing() {
  const val = (id) => parseFloat(document.getElementById(id).value) || 0;
  const payload = {
    handwritten: { "2-3": val("price-hw-2-3"), "3-5": val("price-hw-3-5"), "5-7": val("price-hw-5-7") },
    typed: val("price-typed"),
    materials: {
      ruledPaperPerSheet: val("price-ruled"),
      punchRuledPerSheet: val("price-punch-ruled"),
      interleavedPerPage: val("price-interleaved"),
      blankPerPage: val("price-blank"),
      transparentCover: val("price-transparent"),
      plasticClip: val("price-clip"),
      hardCover: val("price-hardcover"),
      blackCover: val("price-colorcover"),
      brownCover: val("price-colorcover"),
      customCover: val("price-colorcover"),
      plasticSheetProtector: val("price-sheet-protector"),
      nameSlip: val("price-nameslip"),
    },
  };
  try {
    await adminUpdatePricing(payload);
    showToast("Pricing updated — live on the site immediately.", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ── Coupons ──
async function loadCoupons() {
  const listEl = document.getElementById("coupons-list");
  listEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">Loading…</p>`;
  try {
    const coupons = await adminListCoupons();
    if (!coupons.length) {
      listEl.innerHTML = `<div class="empty-state"><h3>No coupons yet</h3></div>`;
      return;
    }
    listEl.innerHTML = coupons
      .map(
        (c) => `
      <div class="card" style="padding:14px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700;">${c.code} ${c.active ? "" : '<span style="color:#dc2626;font-size:11px;">(inactive)</span>'}</div>
          <div style="font-size:12px; color:var(--text-muted);">${c.type === "flat" ? "₹" + c.value + " off" : c.value + "% off"} · used ${c.used_count}${c.max_uses ? "/" + c.max_uses : ""}</div>
        </div>
        <button class="btn btn-outline" style="padding:8px 14px; font-size:12px; color:#dc2626;" onclick="deleteCoupon('${c.code}')">Delete</button>
      </div>`
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<p style="text-align:center; color:#dc2626; padding:20px;">${err.message}</p>`;
  }
}

async function createCoupon() {
  const code = document.getElementById("new-coupon-code").value.trim().toUpperCase();
  const type = document.getElementById("new-coupon-type").value;
  const value = parseFloat(document.getElementById("new-coupon-value").value);
  if (!code || !value) return showToast("Enter a code and value.", "error");
  try {
    await adminCreateCoupon({ code, type, value });
    showToast(`Coupon ${code} saved.`, "success");
    document.getElementById("new-coupon-code").value = "";
    document.getElementById("new-coupon-value").value = "";
    loadCoupons();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteCoupon(code) {
  if (!confirm(`Delete coupon ${code}?`)) return;
  try {
    await adminDeleteCoupon(code);
    showToast(`Coupon ${code} deleted.`, "success");
    loadCoupons();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function adminLogout() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  document.getElementById("admin-app").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
}

function setStatusFilter(status, btn) {
  currentStatusFilter = status;
  document.querySelectorAll(".filter-tabs button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  loadOrders();
}

async function loadOrders() {
  const listEl = document.getElementById("admin-orders-list");
  listEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">Loading orders…</p>`;
  try {
    const orders = await adminListOrders(currentStatusFilter);
    if (!orders.length) {
      listEl.innerHTML = `<div class="empty-state"><h3>No orders</h3><p>You're all caught up.</p></div>`;
      return;
    }
    listEl.innerHTML = orders.map(renderOrderCard).join("");
  } catch (err) {
    listEl.innerHTML = `<p style="text-align:center; color:#dc2626; padding:30px;">${err.message}</p>`;
  }
}

function renderOrderCard(o) {
  const pb = o.price_breakdown;
  return `
  <div class="card order-card" id="order-${o.id}">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-weight:700;">${o.order_code}</div>
        <div style="font-size:11.5px; color:var(--text-muted);">${new Date(o.created_at).toLocaleString("en-IN")}</div>
      </div>
      <span class="status-pill ${o.status}">${o.status}</span>
    </div>
    <div style="margin-top:10px; font-size:13px;">
      <div class="summary-row"><span class="muted">Customer</span><span>${o.customer_name}</span></div>
      <div class="summary-row"><span class="muted">Phone</span><span>${o.phone_number}</span></div>
      <div class="summary-row"><span class="muted">Address</span><span style="text-align:right; max-width:60%;">${o.address_line}, ${o.city}, ${o.state} - ${o.pin_code}</span></div>
      <div class="summary-row"><span class="muted">Type</span><span>${o.assignment_type} · ${o.paper_type.replace(/_/g," ")}</span></div>
      <div class="summary-row"><span class="muted">Pages</span><span>${o.page_count}</span></div>
      <div class="summary-row"><span class="muted">Delivery</span><span>${o.delivery_option} days</span></div>
      ${o.customer_note ? `<div class="summary-row"><span class="muted">Note</span><span style="text-align:right; max-width:60%;">${o.customer_note}</span></div>` : ""}
      <div class="summary-row total"><span>Amount (COD)</span><span>₹${Number(o.final_amount).toFixed(2)}</span></div>
    </div>
    <div class="order-actions">
      <button class="btn btn-outline" onclick="viewFile('${o.id}')">📎 View File</button>
      ${o.status === "pending" ? `<button class="btn btn-outline" onclick="markProcessing('${o.id}')">Mark Processing</button>` : ""}
      <button class="btn btn-primary" onclick="markDelivered('${o.id}','${o.order_code}')">Mark Delivered</button>
    </div>
  </div>`;
}

async function viewFile(orderId) {
  try {
    const { url } = await adminGetFileUrl(orderId);
    window.open(url, "_blank");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function markProcessing(orderId) {
  try {
    await adminUpdateStatus(orderId, "processing");
    showToast("Order marked as processing.", "success");
    loadOrders();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function markDelivered(orderId, orderCode) {
  if (!confirm(`Mark ${orderCode} as delivered? This will permanently delete it from the database (Telegram record remains).`)) return;
  try {
    await adminMarkDelivered(orderId);
    showToast(`${orderCode} delivered & removed from database.`, "success");
    document.getElementById(`order-${orderId}`).remove();
  } catch (err) {
    showToast(err.message, "error");
  }
}
