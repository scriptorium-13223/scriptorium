const rateLimit = require('express-rate-limit');
const config = require('../config');

// General API rate limiter - applied globally
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
  },
});

// Stricter limiter for upload endpoint (file uploads are expensive - CPU for OCR, bandwidth)
const uploadLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.uploadMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many upload attempts. Please try again later.', code: 'UPLOAD_RATE_LIMITED' },
  },
});

// Strict limiter for admin login attempts (brute-force protection on the single shared secret)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many login attempts. Try again in 15 minutes.', code: 'ADMIN_RATE_LIMITED' },
  },
});

module.exports = { generalLimiter, uploadLimiter, adminLoginLimiter };
