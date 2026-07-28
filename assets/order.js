// ─────────────────────────────────────────────
//  order.js — Create Order multi-step flow
// ─────────────────────────────────────────────

const PAPER_LABELS = {
  handwritten: {
    a4_white: "A4 White", ruled_a4: "Ruled A4", hindi_ruled: "Hindi Ruled",
    punch_ruled: "Punch Sheet Ruled", punch_blank: "Punch Sheet Blank", punch_interleaved: "Punch Sheet Interleaved",
  },
  typed: { a4: "A4", a4_hole_punch: "A4 Hole Punch" },
};

let orderState = {};
let selectedFiles = [];

function resetOrderFlow() {
  orderState = {
    assignmentType: null, paperType: null, deliveryOption: null, coverOption: "none",
    addons: [], pageCount: null, coupon: null,
  };
  selectedFiles = [];
  document.querySelectorAll(".order-step").forEach((s) => (s.style.display = "none"));
  document.querySelector('.order-step[data-step="1"]').style.display = "block";
  document.querySelectorAll(".option-card").forEach((c) => c.classList.remove("selected"));
  document.getElementById("step1-next").disabled = true;
  document.getElementById("step2-next").disabled = true;
  document.getElementById("step3-next").disabled = true;
  document.getElementById("file-preview-list").innerHTML = "";
  document.getElementById("page-count-display").innerHTML = "";
  document.getElementById("upload-progress-wrap").style.display = "none";
  document.getElementById("file-input").value = "";
  document.getElementById("customer-note").value = "";
  document.getElementById("coupon-input").value = "";
  document.getElementById("coupon-status").textContent = "";
  ["ship-name", "ship-phone", "ship-alt-phone", "ship-address", "ship-city", "ship-state", "ship-pin", "ship-landmark"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
  updateProgressBar(1);
}

function updateProgressBar(step) {
  document.querySelectorAll("#order-progress .seg").forEach((seg) => {
    seg.classList.toggle("done", parseInt(seg.dataset.step) <= step);
  });
}

function goToStep(step) {
  document.querySelectorAll(".order-step").forEach((s) => (s.style.display = "none"));
  document.querySelector(`.order-step[data-step="${step}"]`).style.display = "block";
  updateProgressBar(step);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (step === 3) renderPaperChips();
  if (step === 4) renderOrderSummary();
}

function selectAssignmentType(type) {
  orderState.assignmentType = type;
  document.querySelectorAll(".option-card").forEach((c) => c.classList.toggle("selected", c.dataset.type === type));
  document.getElementById("step1-next").disabled = false;
}

// ── Step 2: Upload ──
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const isPdf = files[0].type === "application/pdf";
  if (isPdf && files.length > 1) {
    showToast("Please upload only one PDF file.", "error");
    return;
  }
  if (!isPdf && files.some((f) => f.type === "application/pdf")) {
    showToast("Please upload either one PDF or multiple images, not both.", "error");
    return;
  }
  for (const f of files) {
    if (f.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      showToast(`${f.name} exceeds the ${MAX_UPLOAD_SIZE_MB}MB limit.`, "error");
      return;
    }
  }

  selectedFiles = files;
  renderFilePreviews();
  await attemptPageCount(0);
}

// Retries automatically multiple times with backoff (Render's free tier can take
// 30-50s to wake up from sleep, and requests during that window fail outright).
// Only after several attempts does it show a manual Retry button, so the user
// isn't forced to re-pick the file from the OS file picker on every failure.
const RETRY_DELAYS_MS = [4000, 8000, 12000, 15000]; // ~40s total coverage

async function attemptPageCount(attemptNumber) {
  const uploadZone = document.getElementById("upload-zone");
  const progressWrap = document.getElementById("upload-progress-wrap");
  const progressFill = document.getElementById("upload-progress-fill");
  const progressLabel = document.getElementById("upload-progress-label");

  uploadZone.classList.add("processing");
  progressWrap.style.display = "block";
  progressFill.style.width = "15%";
  progressLabel.textContent =
    attemptNumber === 0 ? "Uploading & analyzing pages…" : `Server is waking up, retrying… (attempt ${attemptNumber + 1})`;

  let fakeProgress = 15;
  const interval = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 6, 85);
    progressFill.style.width = `${fakeProgress}%`;
  }, 500);

  try {
    const result = await previewPageCount(selectedFiles);
    clearInterval(interval);
    progressFill.style.width = "100%";
    progressLabel.textContent = "Done!";
    orderState.pageCount = result.pageCount;

    document.getElementById("page-count-display").innerHTML = `
      <div class="page-count-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        ${result.pageCount} page${result.pageCount > 1 ? "s" : ""} detected automatically
      </div>`;
    document.getElementById("step2-next").disabled = false;
    uploadZone.classList.remove("processing");
    setTimeout(() => (progressWrap.style.display = "none"), 800);
  } catch (err) {
    clearInterval(interval);
    uploadZone.classList.remove("processing");

    if (attemptNumber < RETRY_DELAYS_MS.length) {
      const secondsLeft = Math.round(RETRY_DELAYS_MS[attemptNumber] / 1000);
      progressLabel.textContent = `Server is waking up — retrying in ${secondsLeft}s…`;
      setTimeout(() => attemptPageCount(attemptNumber + 1), RETRY_DELAYS_MS[attemptNumber]);
      return;
    }

    // All auto-retries exhausted - show a manual Retry button, don't force re-picking the file
    progressWrap.style.display = "none";
    document.getElementById("page-count-display").innerHTML = `
      <div class="callout-error" style="background:rgba(220,38,38,0.08); border:1px solid rgba(220,38,38,0.3); border-radius:12px; padding:12px 14px; font-size:12.5px; color:#dc2626;">
        Could not reach the server (${err.message || "connection issue"}) after several tries.
      </div>
      <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="attemptPageCount(0)">🔄 Retry Upload</button>`;
    document.getElementById("step2-next").disabled = true;
  }
}

function renderFilePreviews() {
  const list = document.getElementById("file-preview-list");
  list.innerHTML = "";
  selectedFiles.forEach((file, idx) => {
    const item = document.createElement("div");
    item.className = "file-preview-item card";
    const isImage = file.type.startsWith("image/");
    const thumbHtml = isImage
      ? `<img class="thumb" src="${URL.createObjectURL(file)}" alt="preview" />`
      : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;">📄</div>`;
    item.innerHTML = `
      ${thumbHtml}
      <div class="info"><div class="name">${file.name}</div><div class="size">${formatBytes(file.size)}</div></div>
      <button class="remove-btn" onclick="removeFile(${idx})">Remove</button>`;
    list.appendChild(item);
  });
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderFilePreviews();
  document.getElementById("page-count-display").innerHTML = "";
  document.getElementById("step2-next").disabled = true;
  orderState.pageCount = null;
  if (selectedFiles.length) {
    handleFileSelectRecount();
  }
}

async function handleFileSelectRecount() {
  try {
    const result = await previewPageCount(selectedFiles);
    orderState.pageCount = result.pageCount;
    document.getElementById("page-count-display").innerHTML = `
      <div class="page-count-badge">${result.pageCount} page${result.pageCount > 1 ? "s" : ""} detected automatically</div>`;
    document.getElementById("step2-next").disabled = false;
  } catch {
    document.getElementById("step2-next").disabled = true;
  }
}

// Drag & drop support
document.addEventListener("DOMContentLoaded", () => {
  const zone = document.getElementById("upload-zone");
  if (!zone) return;
  ["dragover", "dragenter"].forEach((evt) =>
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add("drag-over"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove("drag-over"); })
  );
  zone.addEventListener("drop", (e) => {
    const input = document.getElementById("file-input");
    input.files = e.dataTransfer.files;
    handleFileSelect({ target: input });
  });
});

// ── Step 3: Options ──
function renderPaperChips() {
  const container = document.getElementById("paper-type-chips");
  const labels = PAPER_LABELS[orderState.assignmentType];
  container.innerHTML = Object.entries(labels)
    .map(([value, label]) => `<button class="chip" data-value="${value}" onclick="selectChip(this,'paperType')">${label}</button>`)
    .join("");
  orderState.paperType = null;
  checkStep3Complete();
}

function selectChip(btn, field) {
  const group = btn.parentElement;
  group.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
  btn.classList.add("selected");
  orderState[field] = btn.dataset.value;
  checkStep3Complete();
  updateEstimate();
}

function toggleAddonChip(btn) {
  btn.classList.toggle("selected");
  const value = btn.dataset.value;
  if (orderState.addons.includes(value)) {
    orderState.addons = orderState.addons.filter((a) => a !== value);
  } else {
    orderState.addons.push(value);
  }
  updateEstimate();
}

function checkStep3Complete() {
  const complete = !!(orderState.paperType && orderState.deliveryOption);
  document.getElementById("step3-next").disabled = !complete;
  updateEstimate();
}

function computeEstimate() {
  const p = PRICING_ESTIMATE;
  if (!orderState.pageCount || !orderState.deliveryOption) return 0;
  const perPage = orderState.assignmentType === "handwritten" ? p.handwritten[orderState.deliveryOption] : p.typed;
  const base = perPage * orderState.pageCount;
  const material = (p.materials[orderState.paperType] || 0) * orderState.pageCount;
  const cover = p.cover[orderState.coverOption] || 0;
  const addons = orderState.addons.reduce((sum, a) => sum + (p.addons[a] || 0), 0);
  return Math.round((base + material + cover + addons) * 100) / 100;
}

function updateEstimate() {
  const total = computeEstimate();
  const el = document.getElementById("estimate-total");
  if (el) el.textContent = `₹${total.toFixed(2)}`;
}

// ── Step 4: Shipping, coupon, review, submit ──
async function applyCoupon() {
  const code = document.getElementById("coupon-input").value.trim();
  const statusEl = document.getElementById("coupon-status");
  if (!code) return;
  try {
    const subtotal = computeEstimate();
    const result = await validateCoupon(code, subtotal);
    orderState.coupon = result;
    statusEl.style.color = "#16a34a";
    statusEl.textContent = `✓ Coupon applied — ₹${result.discount.toFixed(2)} off`;
    renderOrderSummary();
  } catch (err) {
    orderState.coupon = null;
    statusEl.style.color = "#dc2626";
    statusEl.textContent = err.message;
    renderOrderSummary();
  }
}

function renderOrderSummary() {
  const subtotal = computeEstimate();
  const discount = orderState.coupon ? orderState.coupon.discount : 0;
  const final = Math.max(subtotal - discount, 0);
  const card = document.getElementById("order-summary-card");
  card.innerHTML = `
    <div class="summary-row"><span class="muted">Assignment</span><span>${orderState.assignmentType === "handwritten" ? "Handwritten" : "Typed"}</span></div>
    <div class="summary-row"><span class="muted">Pages (auto-detected)</span><span>${orderState.pageCount}</span></div>
    <div class="summary-row"><span class="muted">Paper</span><span>${PAPER_LABELS[orderState.assignmentType][orderState.paperType] || "-"}</span></div>
    <div class="summary-row"><span class="muted">Delivery</span><span>${orderState.deliveryOption} days</span></div>
    <div class="summary-row"><span class="muted">Cover</span><span>${orderState.coverOption.replace(/_/g, " ")}</span></div>
    <div class="summary-row"><span class="muted">Estimated Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
    ${discount > 0 ? `<div class="summary-row"><span class="muted">Coupon Discount</span><span>-₹${discount.toFixed(2)}</span></div>` : ""}
    <div class="summary-row total"><span>Estimated Total</span><span>₹${final.toFixed(2)}</span></div>
    <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">Exact final amount is confirmed securely by our server when you place the order.</p>
  `;
}

function validateShippingForm() {
  const name = document.getElementById("ship-name").value.trim();
  const phone = document.getElementById("ship-phone").value.trim();
  const address = document.getElementById("ship-address").value.trim();
  const city = document.getElementById("ship-city").value.trim();
  const state = document.getElementById("ship-state").value.trim();
  const pin = document.getElementById("ship-pin").value.trim();

  if (!name || !phone || !address || !city || !state || !pin) {
    showToast("Please fill all required shipping fields.", "error");
    return false;
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    showToast("Enter a valid 10-digit mobile number.", "error");
    return false;
  }
  if (!/^\d{6}$/.test(pin)) {
    showToast("Enter a valid 6-digit PIN code.", "error");
    return false;
  }
  return true;
}

async function placeOrder() {
  if (window.ORDERS_CURRENTLY_OPEN === false) {
    showToast("We're currently not accepting new orders. Please check back soon.", "error");
    return;
  }
  if (!validateShippingForm()) return;
  if (!selectedFiles.length) {
    showToast("Please upload your assignment file(s).", "error");
    return;
  }

  const btn = document.getElementById("place-order-btn");
  const label = document.getElementById("place-order-label");
  btn.disabled = true;
  label.innerHTML = `<div class="spinner" style="display:inline-block;margin-right:8px;vertical-align:middle;"></div> Placing Order…`;

  const fields = {
    assignmentType: orderState.assignmentType,
    paperType: orderState.paperType,
    deliveryOption: orderState.deliveryOption,
    coverOption: orderState.coverOption,
    addons: orderState.addons,
    customerNote: document.getElementById("customer-note").value.trim(),
    customerName: document.getElementById("ship-name").value.trim(),
    phoneNumber: document.getElementById("ship-phone").value.trim(),
    alternateNumber: document.getElementById("ship-alt-phone").value.trim(),
    addressLine: document.getElementById("ship-address").value.trim(),
    city: document.getElementById("ship-city").value.trim(),
    state: document.getElementById("ship-state").value.trim(),
    pinCode: document.getElementById("ship-pin").value.trim(),
    landmark: document.getElementById("ship-landmark").value.trim(),
  };
  if (orderState.coupon) fields.couponCode = orderState.coupon.code;

  try {
    const result = await submitOrder(fields, selectedFiles);

    await saveOrderLocally({
      orderId: result.orderCode,
      invoiceOrderId: result.orderId,
      createdAt: result.createdAt,
      status: result.status,
      amount: result.finalAmount,
      fileName: selectedFiles[0].name,
      assignmentType: orderState.assignmentType,
      priceBreakdown: result.priceBreakdown,
      invoiceBase64: result.invoiceBase64,
    });

    document.getElementById("thankyou-summary").innerHTML = `
      <div class="summary-row"><span class="muted">Order ID</span><span>${result.orderCode}</span></div>
      <div class="summary-row"><span class="muted">Pages</span><span>${result.pageCount}</span></div>
      <div class="summary-row total"><span>Amount to Pay (COD)</span><span>₹${result.finalAmount.toFixed(2)}</span></div>
    `;
    switchView("thankyou");
    showToast("Order placed successfully!", "success");
  } catch (err) {
    showToast(err.message || "Failed to place order. Please try again.", "error");
  } finally {
    btn.disabled = false;
    label.textContent = "Place Order (Cash on Delivery)";
  }
}
