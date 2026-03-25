const logger = require('../utils/logger');

module.exports = function errorHandler(err, req, res, next) {
  let status  = err.statusCode || 500;
  let message = err.message    || 'Internal server error';

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return res.status(400).json({ success: false, message: 'Validation error', errors: err.errors });
  }

  // PostgreSQL errors
  if (err.code === '23505') { // unique violation
    status  = 409;
    message = 'This record already exists.';
    const detail = err.detail;
    if (detail?.includes('mobile'))    message = 'Mobile number already registered.';
    else if (detail?.includes('email')) message = 'Email already registered.';
    else if (detail?.includes('mci'))   message = 'MCI number already registered.';
  } else if (err.code === '23503') { // foreign key violation
    status  = 400;
    message = 'Referenced record does not exist.';
  } else if (err.code === '23502') { // not null violation
    status  = 400;
    message = `Required field missing: ${err.column || 'unknown'}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  { status = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError')  { status = 401; message = 'Token expired'; }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE')    { status = 400; message = `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 10}MB.`; }
  if (err.code === 'LIMIT_FILE_COUNT')   { status = 400; message = 'Too many files uploaded.'; }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') { status = 400; message = `Unexpected file field: ${err.field}`; }

  // Log server errors
  if (status >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} — ${status}: ${message}`, { stack: err.stack });
  }

  res.status(status).json({ success: false, message, ...(process.env.NODE_ENV === 'development' && status >= 500 ? { stack: err.stack } : {}) });
};
