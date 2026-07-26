// ─────────────────────────────────────────────
//  orders-page.js — Orders tab (reads from IndexedDB only)
// ─────────────────────────────────────────────

function downloadInvoice(orderId) {
  getAllLocalOrders().then((orders) => {
    const order = orders.find((o) => o.orderId === orderId);
    if (!order || !order.invoiceBase64) {
      showToast("Invoice not available for this order.", "error");
      return;
    }
    const byteChars = atob(order.invoiceBase64);
    const byteNumbers = new Array(byteChars.length).fill(0).map((_, i) => byteChars.charCodeAt(i));
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${order.orderId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function renderOrdersList() {
  const listEl = document.getElementById("orders-list");
  const orders = await getAllLocalOrders();

  if (!orders.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 2h6l1 4H8l1-4z"/><path d="M4 7h16l-1.5 13a2 2 0 01-2 1.8H7.5a2 2 0 01-2-1.8L4 7z"/></svg>
        <h3>No orders yet</h3>
        <p>Tap the ink button below to place your first order.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = orders
    .map(
      (o) => `
    <div class="card" style="padding:16px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <div>
          <div style="font-weight:700; font-size:14px;">${o.orderId}</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">${new Date(o.createdAt).toLocaleString("en-IN")}</div>
        </div>
        <span class="status-pill ${o.status}">${o.status}</span>
      </div>
      <div class="summary-row"><span class="muted">File</span><span>${o.fileName}</span></div>
      <div class="summary-row"><span class="muted">Type</span><span>${o.assignmentType === "handwritten" ? "Handwritten" : "Typed"}</span></div>
      <div class="summary-row total"><span>Amount (COD)</span><span>₹${o.amount.toFixed(2)}</span></div>
      <button class="btn btn-outline btn-block" style="margin-top:12px;" onclick="downloadInvoice('${o.orderId}')">
        📄 Download Invoice
      </button>
    </div>`
    )
    .join("");
}
