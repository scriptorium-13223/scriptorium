const multer = require('multer');
const config = require('../config');
const { AppError } = require('./errorHandler');

// Files are held in memory only (never written to local disk) since the backend
// runs on ephemeral hosting (Render free tier). From memory they go straight to
// Supabase Storage and/or Telegram as a buffer.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new AppError(
        `Unsupported file type: ${file.mimetype}. Allowed: PDF, PNG, JPG, JPEG.`,
        400,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxUploadSizeMB * 1024 * 1024,
    files: 1,
  },
});

// Wraps multer's single-file upload to convert its errors into our AppError format
function singleFileUpload(fieldName) {
  return (req, res, next) => {
    const handler = upload.single(fieldName);
    handler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              `File too large. Maximum allowed size is ${config.maxUploadSizeMB}MB.`,
              400,
              'FILE_TOO_LARGE'
            )
          );
        }
        return next(new AppError(err.message, 400, 'UPLOAD_ERROR'));
      }
      if (err) return next(err);
      if (!req.file) {
        return next(new AppError('No file uploaded.', 400, 'NO_FILE'));
      }
      next();
    });
  };
}

// Supports multiple files: one PDF, OR multiple images (one photo per page).
// Mixed PDF+image in the same order is rejected in the route handler (ambiguous page count).
const MAX_FILES = 50;

function multiFileUpload(fieldName) {
  return (req, res, next) => {
    const handler = upload.array(fieldName, MAX_FILES);
    handler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(`File too large. Maximum allowed size per file is ${config.maxUploadSizeMB}MB.`, 400, 'FILE_TOO_LARGE')
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError(`Too many files. Maximum is ${MAX_FILES}.`, 400, 'TOO_MANY_FILES'));
        }
        return next(new AppError(err.message, 400, 'UPLOAD_ERROR'));
      }
      if (err) return next(err);
      if (!req.files || req.files.length === 0) {
        return next(new AppError('No files uploaded.', 400, 'NO_FILE'));
      }

      const pdfCount = req.files.filter((f) => f.mimetype === 'application/pdf').length;
      const imageCount = req.files.length - pdfCount;
      if (pdfCount > 0 && imageCount > 0) {
        return next(new AppError('Please upload either one PDF or multiple images, not both.', 400, 'MIXED_FILE_TYPES'));
      }
      if (pdfCount > 1) {
        return next(new AppError('Please upload only one PDF file.', 400, 'MULTIPLE_PDFS'));
      }
      next();
    });
  };
}

module.exports = { singleFileUpload, multiFileUpload };
