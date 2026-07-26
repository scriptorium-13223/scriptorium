const express = require('express');
const router = express.Router();

const { multiFileUpload } = require('../middleware/upload.middleware');
const { uploadLimiter } = require('../middleware/rateLimit.middleware');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { calculatePageCount } = require('../services/pageCounter.service');
const { calculateOrderPrice } = require('../services/pricing.service');
const { generateInvoicePDF } = require('../services/invoice.service');
const { sendOrderNotification } = require('../services/telegram.service');
const supabaseService = require('../services/supabase.service');

const REQUIRED_FIELDS = [
  'assignmentType',
  'paperType',
  'deliveryOption',
  'coverOption',
  'customerName',
  'phoneNumber',
  'addressLine',
  'city',
  'state',
  'pinCode',
];

const PHONE_REGEX = /^[6-9]\d{9}$/; // Indian 10-digit mobile numbers
const PIN_REGEX = /^\d{6}$/;

function validateShipping(body) {
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || String(body[field]).trim() === '') {
      throw new AppError(`Missing required field: ${field}`, 400, 'MISSING_FIELD');
    }
  }
  if (!PHONE_REGEX.test(body.phoneNumber)) {
    throw new AppError('Invalid phone number. Enter a valid 10-digit Indian mobile number.', 400, 'INVALID_PHONE');
  }
  if (body.alternateNumber && !PHONE_REGEX.test(body.alternateNumber)) {
    throw new AppError('Invalid alternate phone number.', 400, 'INVALID_ALT_PHONE');
  }
  if (!PIN_REGEX.test(body.pinCode)) {
    throw new AppError('Invalid PIN code. Must be 6 digits.', 400, 'INVALID_PIN');
  }
}

// POST /api/orders  (multipart/form-data: files[] + all order/shipping fields)
router.post(
  '/',
  uploadLimiter,
  multiFileUpload('files'),
  asyncHandler(async (req, res) => {
    const body = req.body;
    validateShipping(body);

    let addons = [];
    if (body.addons) {
      try {
        addons = JSON.parse(body.addons);
        if (!Array.isArray(addons)) throw new Error();
      } catch {
        throw new AppError('Invalid add-ons format.', 400, 'INVALID_ADDONS');
      }
    }

    // 1. Authoritative page count - always recomputed server-side, never trusts client input
    const { totalPages } = await calculatePageCount(req.files);

    // 2. Coupon validation (if provided)
    const coupon = body.couponCode ? await supabaseService.validateCoupon(body.couponCode) : null;

    // 3. Backend-only pricing
    const priceBreakdown = calculateOrderPrice(
      {
        assignmentType: body.assignmentType,
        paperType: body.paperType,
        deliveryOption: body.deliveryOption,
        coverOption: body.coverOption,
        addons,
        pageCount: totalPages,
      },
      coupon
    );

    // 4. Upload the (single) representative file to Storage.
    // For multi-image orders we store the first image; all images are sent to Telegram individually,
    // and only the first is referenced on the order row (kept minimal per "avoid unnecessary DB usage").
    const primaryFile = req.files[0];
    const filePath = await supabaseService.uploadFileToStorage(
      primaryFile.buffer,
      primaryFile.originalname,
      primaryFile.mimetype
    );

    // 5. Persist order (minimal operational data only)
    const order = await supabaseService.createOrder({
      assignment_type: body.assignmentType,
      paper_type: body.paperType,
      delivery_option: body.deliveryOption,
      cover_option: body.coverOption,
      addons,
      customer_note: body.customerNote || '',
      file_path: filePath,
      file_name: primaryFile.originalname,
      file_mime: primaryFile.mimetype,
      page_count: totalPages,
      price_breakdown: priceBreakdown,
      coupon_code: coupon ? coupon.code : null,
      final_amount: priceBreakdown.finalAmount,
      customer_name: body.customerName,
      phone_number: body.phoneNumber,
      alternate_number: body.alternateNumber || null,
      address_line: body.addressLine,
      city: body.city,
      state: body.state,
      pin_code: body.pinCode,
      landmark: body.landmark || null,
    });

    // 6. Generate invoice PDF
    const invoiceBuffer = await generateInvoicePDF(order);

    // 7. Send everything to Telegram (order details + uploaded files + invoice)
    // Non-fatal: if Telegram fails, the order still succeeds for the customer;
    // we log loudly so it can be manually reconciled.
    try {
      await sendOrderNotification(order, req.files, invoiceBuffer);
    } catch (telegramErr) {
      console.error(`[TELEGRAM] Failed to notify for order ${order.order_code}:`, telegramErr.message);
    }

    // 8. Increment coupon usage (non-fatal)
    if (coupon) await supabaseService.incrementCouponUsage(coupon.code);

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.order_code,
        pageCount: totalPages,
        priceBreakdown,
        finalAmount: priceBreakdown.finalAmount,
        createdAt: order.created_at,
        status: order.status,
        paymentMethod: 'cod',
        invoiceBase64: invoiceBuffer.toString('base64'),
      },
    });
  })
);

module.exports = router;
  
