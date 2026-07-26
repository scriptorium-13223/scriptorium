// ─────────────────────────────────────────────
//  api.js — Backend API wrapper
// ─────────────────────────────────────────────

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, options);
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("Server returned an unexpected response. Please try again.");
  }
  if (!res.ok || !json.success) {
    throw new Error((json.error && json.error.message) || "Something went wrong.");
  }
  return json.data;
}

async function previewPageCount(files) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  return apiRequest("/upload/preview-count", { method: "POST", body: formData });
}

async function validateCoupon(code, subtotal) {
  return apiRequest("/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, subtotal }),
  });
}

async function submitOrder(formFields, files) {
  const formData = new FormData();
  Object.entries(formFields).forEach(([key, value]) => {
    formData.append(key, typeof value === "object" ? JSON.stringify(value) : value);
  });
  files.forEach((f) => formData.append("files", f));
  return apiRequest("/orders", { method: "POST", body: formData });
}

// ── Admin API ──
async function adminLogin(secret) {
  return apiRequest("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  });
}

function adminAuthHeader() {
  const token = sessionStorage.getItem("scriptorium_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function adminListOrders(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest(`/admin/orders${query}`, { headers: adminAuthHeader() });
}

async function adminGetFileUrl(orderId) {
  return apiRequest(`/admin/orders/${orderId}/file-url`, { headers: adminAuthHeader() });
}

async function adminUpdateStatus(orderId, status) {
  return apiRequest(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminAuthHeader() },
    body: JSON.stringify({ status }),
  });
}

async function adminMarkDelivered(orderId) {
  return apiRequest(`/admin/orders/${orderId}`, { method: "DELETE", headers: adminAuthHeader() });
}
