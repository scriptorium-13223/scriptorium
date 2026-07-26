const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabaseClient');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

// ============================================================
// STORAGE — temporary holding for uploaded files
// Files live here only between order creation and Telegram delivery
// confirmation / order being marked delivered, at which point they're purged.
// ============================================================

async function uploadFileToStorage(buffer, originalName, mimeType) {
  const ext = originalName.split('.').pop();
  const path = `${new Date().toISOString().slice(0, 10)}/${uuidv4()}.${ext}`;

  const { error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new AppError(`File storage failed: ${error.message}`, 500, 'STORAGE_UPLOAD_FAILED');
  }
  return path;
}

async function deleteFileFromStorage(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(config.supabaseStorageBucket).remove([path]);
  if (error) {
    // Non-fatal: log but don't block order deletion on a storage cleanup failure
    console.error(`[STORAGE] Failed to delete file ${path}: ${error.message}`);
  }
}

async function getSignedFileUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    throw new AppError(`Could not generate file URL: ${error.message}`, 500, 'SIGNED_URL_FAILED');
  }
  return data.signedUrl;
}

// ============================================================
// ORDERS
// ============================================================

function generateOrderCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = Math.floor(1000 + Math.random() * 9000);
  return `SCR-${datePart}-${randPart}`;
}

async function createOrder(orderData) {
  const order_code = generateOrderCode();
  const { data, error } = await supabase
    .from('orders')
    .insert({ ...orderData, order_code, status: 'pending', payment_method: 'cod' })
    .select()
    .single();

  if (error) {
    throw new AppError(`Failed to create order: ${error.message}`, 500, 'ORDER_CREATE_FAILED');
  }
  return data;
}

async function getOrderById(id) {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
  if (error || !data) {
    throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
  }
  return data;
}

async function listOrders({ status } = {}) {
  let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    throw new AppError(`Failed to fetch orders: ${error.message}`, 500, 'ORDER_LIST_FAILED');
  }
  return data;
}

async function updateOrderStatus(id, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) {
    throw new AppError('Failed to update order status.', 500, 'ORDER_UPDATE_FAILED');
  }
  return data;
}

/**
 * Called when admin marks an order "delivered". Purges the order row AND its
 * uploaded file from Storage entirely — Telegram remains the only permanent
 * record, keeping the Supabase free-tier database near-empty at all times.
 */
async function purgeDeliveredOrder(id) {
  const order = await getOrderById(id);
  await deleteFileFromStorage(order.file_path);

  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) {
    throw new AppError(`Failed to purge order: ${error.message}`, 500, 'ORDER_PURGE_FAILED');
  }
  return order; // return the pre-deletion snapshot for the admin UI confirmation
}

// ============================================================
// COUPONS
// ============================================================

async function validateCoupon(code) {
  if (!code) return null;
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (error || !data) {
    throw new AppError('Invalid or expired coupon code.', 400, 'INVALID_COUPON');
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new AppError('This coupon has expired.', 400, 'COUPON_EXPIRED');
  }
  if (data.max_uses !== null && data.used_count >= data.max_uses) {
    throw new AppError('This coupon has reached its usage limit.', 400, 'COUPON_LIMIT_REACHED');
  }
  return data;
}

async function incrementCouponUsage(code) {
  if (!code) return;
  const { error } = await supabase.rpc('increment_coupon_usage', { coupon_code: code.toUpperCase().trim() });
  if (error) {
    // Non-fatal - order already succeeded, just log for manual reconciliation
    console.error(`[COUPON] Failed to increment usage for ${code}: ${error.message}`);
  }
}

module.exports = {
  uploadFileToStorage,
  deleteFileFromStorage,
  getSignedFileUrl,
  createOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
  purgeDeliveredOrder,
  validateCoupon,
  incrementCouponUsage,
};
