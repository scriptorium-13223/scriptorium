const express = require('express');
const router = express.Router();

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { adminLoginLimiter } = require('../middleware/rateLimit.middleware');
const { issueTokenForValidSecret, requireAdmin } = require('../middleware/adminAuth.middleware');
const supabaseService = require('../services/supabase.service');

// POST /api/admin/login  { secret }
// No user table - single shared secret from env, issues a stateless signed token.
router.post(
  '/login',
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { secret } = req.body;
    const token = issueTokenForValidSecret(secret);
    if (!token) {
      throw new AppError('Incorrect admin password.', 401, 'INVALID_ADMIN_SECRET');
    }
    res.json({ success: true, data: { token, expiresInHours: 12 } });
  })
);

// All routes below require a valid admin token
router.use(requireAdmin);

// GET /api/admin/orders?status=pending
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const orders = await supabaseService.listOrders({ status: req.query.status });
    res.json({ success: true, data: orders });
  })
);

// GET /api/admin/orders/:id/file-url - signed temporary URL to view the uploaded file
router.get(
  '/orders/:id/file-url',
  asyncHandler(async (req, res) => {
    const order = await supabaseService.getOrderById(req.params.id);
    const url = await supabaseService.getSignedFileUrl(order.file_path);
    res.json({ success: true, data: { url } });
  })
);

// PATCH /api/admin/orders/:id/status  { status: 'processing' }
router.patch(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['pending', 'processing'].includes(status)) {
      throw new AppError('Invalid status. Use PATCH for pending/processing only; use DELETE to mark delivered.', 400, 'INVALID_STATUS');
    }
    const order = await supabaseService.updateOrderStatus(req.params.id, status);
    res.json({ success: true, data: order });
  })
);

// DELETE /api/admin/orders/:id  -> marks delivered AND purges order + file entirely
// This is the "free database space" mechanism: nothing about a delivered order
// remains in Supabase. Telegram retains the permanent record.
router.delete(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const purgedOrder = await supabaseService.purgeDeliveredOrder(req.params.id);
    res.json({ success: true, data: { message: 'Order marked delivered and purged.', orderCode: purgedOrder.order_code } });
  })
);

module.exports = router;
