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
  } catch (err) {
    showToast(err.message || "Login failed.", "error");
  } finally {
    label.textContent = "Unlock";
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
