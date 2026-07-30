const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const { AppError } = require('../middleware/errorHandler');

/**
 * Counts pages in a PDF buffer. Tries pdf-lib first (fast, reliable for page count),
 * falls back to pdf-parse if the PDF is malformed/encrypted in a way pdf-lib rejects.
 */
async function countPdfPages(buffer) {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch (primaryErr) {
    try {
      const parsed = await pdfParse(buffer);
      return parsed.numpages;
    } catch (fallbackErr) {
      throw new AppError(
        'Unable to read PDF file. It may be corrupted or password-protected.',
        400,
        'INVALID_PDF'
      );
    }
  }
}

/**
 * Main entry point: given req.files (from multiFileUpload), returns the total
 * automatic page count plus a per-file breakdown. Customer never sees an editable
 * page count field - this is the sole source of truth used by the pricing engine.
 *
 * Images: one page per uploaded image file (each photo = one assignment page).
 * PDFs: actual page count read from the file itself.
 *
 * Note: an earlier version ran OCR (Tesseract.js) on each image as a soft content
 * check. It was removed - it never affected the page count or blocked orders
 * (purely informational), while being memory/CPU-heavy enough to risk crashing
 * on free-tier hosting (512MB RAM). Removing it makes the service lighter and
 * more reliable with zero change to what the customer is charged or sees.
 */
async function calculatePageCount(files) {
  if (!files || files.length === 0) {
    throw new AppError('No files provided for page counting.', 400, 'NO_FILES');
  }

  const isPdf = files[0].mimetype === 'application/pdf';
  const breakdown = [];
  let totalPages = 0;

  if (isPdf) {
    const file = files[0];
    const pages = await countPdfPages(file.buffer);
    if (pages < 1) {
      throw new AppError('PDF appears to have no pages.', 400, 'EMPTY_PDF');
    }
    totalPages = pages;
    breakdown.push({ fileName: file.originalname, type: 'pdf', pages });
  } else {
    // Multiple images - one page per image
    for (const file of files) {
      breakdown.push({ fileName: file.originalname, type: 'image', pages: 1 });
      totalPages += 1;
    }
  }

  return { totalPages, breakdown };
}

module.exports = { calculatePageCount, countPdfPages };
