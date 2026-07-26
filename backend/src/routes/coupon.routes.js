const express = require('express');
const router = express.Router();

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const supabaseService = require('../services/supabase.service');

// POST /api/coupons/validate  { code, subtotal }
// Used for a live discount preview at checkout. The final discount is always
// re-validated and re-applied authoritatively inside POST /api/orders.
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code) throw new AppError('Coupon code is required.', 400, 'MISSING_COUPON_CODE');
    if (typeof subtotal !== 'number' || subtotal < 0) {
      throw new AppError('Invalid subtotal.', 400, 'INVALID_SUBTOTAL');
    }

    const coupon = await supabaseService.validateCoupon(code);
    const discount =
      coupon.type === 'flat' ? Math.min(coupon.value, subtotal) : Math.round(((subtotal * coupon.value) / 100) * 100) / 100;

    res.json({
      success: true,
      data: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount,
        estimatedFinal: Math.max(subtotal - discount, 0),
      },
    });
  })
);

module.exports = router;
