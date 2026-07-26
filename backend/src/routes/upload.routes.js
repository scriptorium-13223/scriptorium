const express = require('express');
const router = express.Router();

const { multiFileUpload } = require('../middleware/upload.middleware');
const { uploadLimiter } = require('../middleware/rateLimit.middleware');
const { asyncHandler } = require('../middleware/errorHandler');
const { calculatePageCount } = require('../services/pageCounter.service');

// POST /api/upload/preview-count
// Stateless: does NOT store anything. Purely computes the automatic page count
// so the customer can see it before filling out the rest of the order form.
// The authoritative page count is always recomputed again at order submission.
router.post(
  '/preview-count',
  uploadLimiter,
  multiFileUpload('files'),
  asyncHandler(async (req, res) => {
    const { totalPages, breakdown } = await calculatePageCount(req.files);
    res.json({ success: true, data: { pageCount: totalPages, breakdown } });
  })
);

module.exports = router;
