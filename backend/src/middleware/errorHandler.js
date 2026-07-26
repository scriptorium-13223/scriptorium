// Custom application error class - use this to throw errors with known HTTP status codes
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Wrap async route handlers so thrown errors reach the error middleware
// instead of crashing the process or hanging the request.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Must be registered LAST in server.js (after all routes)
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  // Log full details server-side always
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message);

  // Never leak stack traces or internal details to the client in production
  const response = {
    success: false,
    error: {
      message: isOperational ? err.message : 'Something went wrong. Please try again.',
      code: err.code || 'INTERNAL_ERROR',
    },
  };

  if (process.env.NODE_ENV !== 'production') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

// 404 handler - registered after all routes, before errorHandler
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

module.exports = { AppError, asyncHandler, errorHandler, notFoundHandler };
    
