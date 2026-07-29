const express = require('express');
const router = express.Router();

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { adminLoginLimiter } = require('../middleware/rateLimit.middleware');
const { issueTokenForValidSecret, requireAdmin } = require('../middleware/adminAuth.middleware');
const supabaseService = require('../services/supabase.service');
const settingsService = require('../services/settings.service');
const supabase = require('../config/supabaseClient');

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

// ============================================================
// SETTINGS (pricing, telegram chat id, orders open/closed, flip-card text)
// ============================================================

// GET /api/admin/settings
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await settingsService.getAllSettings();
    res.json({ success: true, data: settings });
  })
);

// PUT /api/admin/settings/pricing  { handwritten, typed, materials }
router.put(
  '/settings/pricing',
  asyncHandler(async (req, res) => {
    const { handwritten, typed, materials } = req.body;
    if (!handwritten || typeof typed !== 'number' || !materials) {
      throw new AppError('Pricing payload must include handwritten, typed, and materials.', 400, 'INVALID_PRICING_PAYLOAD');
    }
    const value = await settingsService.setSetting('pricing', { handwritten, typed, materials });
    res.json({ success: true, data: value });
  })
);

// PUT /api/admin/settings/telegram-chat-id  { chatId }
router.put(
  '/settings/telegram-chat-id',
  asyncHandler(async (req, res) => {
    const { chatId } = req.body;
    if (!chatId || String(chatId).trim() === '') {
      throw new AppError('chatId is required.', 400, 'MISSING_CHAT_ID');
    }
    const value = await settingsService.setSetting('telegram_chat_id', String(chatId).trim());
    res.json({ success: true, data: { telegramChatId: value } });
  })
);

// PUT /api/admin/settings/orders-open  { open: true|false }
router.put(
  '/settings/orders-open',
  asyncHandler(async (req, res) => {
    const { open } = req.body;
    if (typeof open !== 'boolean') {
      throw new AppError('open must be true or false.', 400, 'INVALID_OPEN_VALUE');
    }
    const value = await settingsService.setSetting('orders_open', open);
    res.json({ success: true, data: { ordersOpen: value } });
  })
);

// PUT /api/admin/settings/flip-card-text  { text }
router.put(
  '/settings/flip-card-text',
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text || String(text).trim() === '') {
      throw new AppError('text is required.', 400, 'MISSING_TEXT');
    }
    const value = await settingsService.setSetting('flip_card_text', String(text).trim());
    res.json({ success: true, data: { flipCardText: value } });
  })
);

// ============================================================
// COUPONS (create / list / delete)
// ============================================================

// GET /api/admin/coupons
router.get(
  '/coupons',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw new AppError(`Failed to fetch coupons: ${error.message}`, 500, 'COUPON_LIST_FAILED');
    res.json({ success: true, data });
  })
);

// POST /api/admin/coupons  { code, type, value, maxUses, expiresAt }
router.post(
  '/coupons',
  asyncHandler(async (req, res) => {
    const { code, type, value, maxUses, expiresAt } = req.body;
    if (!code || !['flat', 'percentage'].includes(type) || typeof value !== 'number') {
      throw new AppError('Coupon requires code, type (flat/percentage), and numeric value.', 400, 'INVALID_COUPON_PAYLOAD');
    }
    const { data, error } = await supabase
      .from('coupons')
      .upsert(
        {
          code: code.toUpperCase().trim(),
          type,
          value,
          active: true,
          max_uses: maxUses || null,
          expires_at: expiresAt || null,
        },
        { onConflict: 'code' }
      )
      .select()
      .single();
    if (error) throw new AppError(`Failed to create coupon: ${error.message}`, 500, 'COUPON_CREATE_FAILED');
    res.status(201).json({ success: true, data });
  })
);

// PATCH /api/admin/coupons/:code/toggle  - enable/disable without deleting
router.patch(
  '/coupons/:code/toggle',
  asyncHandler(async (req, res) => {
    const { active } = req.body;
    const { data, error } = await supabase
      .from('coupons')
      .update({ active: !!active })
      .eq('code', req.params.code.toUpperCase())
      .select()
      .single();
    if (error) throw new AppError(`Failed to update coupon: ${error.message}`, 500, 'COUPON_UPDATE_FAILED');
    res.json({ success: true, data });
  })
);

// DELETE /api/admin/coupons/:code
router.delete(
  '/coupons/:code',
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from('coupons').delete().eq('code', req.params.code.toUpperCase());
    if (error) throw new AppError(`Failed to delete coupon: ${error.message}`, 500, 'COUPON_DELETE_FAILED');
    res.json({ success: true, data: { deleted: req.params.code.toUpperCase() } });
  })
);

module.exports = router;
