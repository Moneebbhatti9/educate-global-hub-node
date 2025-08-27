const { sendErrorResponse } = require('../utils/responseHandler');

/**
 * Centralized Error Handler Middleware
 * Handles all errors in a consistent way
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = { message, statusCode: 400 };
  }

  // Rate limit errors
  if (err.status === 429) {
    const message = 'Too many requests';
    error = { message, statusCode: 429 };
  }

  // Custom authentication errors
  if (err.name === 'AuthenticationError') {
    error = { message: err.message, statusCode: 401 };
  }

  // Custom authorization errors
  if (err.name === 'AuthorizationError') {
    error = { message: err.message, statusCode: 403 };
  }

  // Custom validation errors
  if (err.name === 'ValidationError') {
    error = { message: err.message, statusCode: 400 };
  }

  // Custom not found errors
  if (err.name === 'NotFoundError') {
    error = { message: err.message, statusCode: 404 };
  }

  // Custom conflict errors
  if (err.name === 'ConflictError') {
    error = { message: err.message, statusCode: 409 };
  }

  // Custom unprocessable entity errors
  if (err.name === 'UnprocessableEntityError') {
    error = { message: err.message, statusCode: 422 };
  }

  // Default error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't leak error details in production
  const finalMessage = process.env.NODE_ENV === 'production' && statusCode === 500 
    ? 'Internal Server Error' 
    : message;

  return sendErrorResponse(res, statusCode, finalMessage, {
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 404 Not Found Handler
 * Handles requests to non-existent routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation Error Handler
 * Handles validation errors from Joi/Zod
 */
const validationErrorHandler = (err, req, res, next) => {
  if (err.isJoi) {
    const message = err.details.map(detail => detail.message).join(', ');
    return sendErrorResponse(res, 400, `Validation Error: ${message}`);
  }
  next(err);
};

/**
 * Database Connection Error Handler
 */
const dbErrorHandler = (err) => {
  console.error('Database connection error:', err);
  process.exit(1);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  dbErrorHandler
};
