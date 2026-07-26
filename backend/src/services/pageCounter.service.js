const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
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
 * Runs OCR on an image buffer purely as a content-detection sanity check
 * (confirms the image actually contains a written/typed page, catches accidental
 * blank photos or non-assignment images). Does NOT affect the page count itself —
 * each image file always counts as exactly 1 page, per spec ("automatic detection"
 * here means detecting readable content, not miscounting pages).
 */
async function detectImageContent(buffer) {
  try {
    const { data } = await Tesseract.recognize(buffer, 'eng', { logger: () => {} });
    const textLength = (data.text || '').trim().length;
    const confidence = data.confidence || 0;
    return {
      hasDetectableContent: textLength > 3 || confidence > 30,
      confidence,
      extractedChars: textLength,
    };
  } catch (err) {
    // OCR failure should never block an order - it's a soft signal, not a hard gate
    return { hasDetectableContent: true, confidence: 0, extractedChars: 0, ocrSkipped: true };
  }
}

/**
 * Main entry point: given req.files (from multiFileUpload), returns the total
 * automatic page count plus a per-file breakdown. Customer never sees an editable
 * page count field - this is the sole source of truth used by the pricing engine.
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
    // Multiple images - one page per image, each lightly OCR-scanned for a content flag
    let flaggedCount = 0;
    for (const file of files) {
      const detection = await detectImageContent(file.buffer);
      if (!detection.hasDetectableContent && !detection.ocrSkipped) flaggedCount++;
      breakdown.push({
        fileName: file.originalname,
        type: 'image',
        pages: 1,
        contentDetected: detection.hasDetectableContent,
      });
      totalPages += 1;
    }
    // Informational only - we don't reject the order, just surface a warning flag
    // the frontend/Telegram message can display so staff can double check.
    if (flaggedCount > 0) {
      breakdown.push({ warning: `${flaggedCount} image(s) had low/no detectable content.` });
    }
  }

  return { totalPages, breakdown };
}

module.exports = { calculatePageCount, countPdfPages, detectImageContent };
