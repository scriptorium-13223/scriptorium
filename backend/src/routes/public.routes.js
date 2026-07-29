const express = require('express');
const router = express.Router();

const { asyncHandler } = require('../middleware/errorHandler');
const settingsService = require('../services/settings.service');

// GET /api/public/settings
// No admin auth needed - this only exposes non-sensitive display/estimate data.
// Telegram token, chat id (raw), and admin secret are NEVER included here.
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const [pricing, ordersOpen, flipCardText] = await Promise.all([
      settingsService.getPricingRates(),
      settingsService.areOrdersOpen(),
      settingsService.getFlipCardText(),
    ]);
    res.json({ success: true, data: { pricing, ordersOpen, flipCardText } });
  })
);

module.exports = router;
