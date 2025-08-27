/**
 * Standard API Response Handler
 * Provides consistent response format across all endpoints
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {Object} meta - Additional metadata (pagination, etc.)
 */
const sendSuccessResponse = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (meta !== null) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} message - Error message
 * @param {*} error - Error details
 */
const sendErrorResponse = (res, statusCode = 500, message = 'Internal Server Error', error = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (error !== null) {
    response.error = error;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {Array} data - Array of data items
 * @param {Object} pagination - Pagination info
 */
const sendPaginatedResponse = (res, message = 'Data retrieved successfully', data = [], pagination = {}) => {
  const { page = 1, limit = 10, total = 0, totalPages = 0 } = pagination;

  const meta = {
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };

  return sendSuccessResponse(res, 200, message, data, meta);
};

/**
 * Send created response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {*} data - Created resource data
 */
const sendCreatedResponse = (res, message = 'Resource created successfully', data = null) => {
  return sendSuccessResponse(res, 201, message, data);
};

/**
 * Send updated response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {*} data - Updated resource data
 */
const sendUpdatedResponse = (res, message = 'Resource updated successfully', data = null) => {
  return sendSuccessResponse(res, 200, message, data);
};

/**
 * Send deleted response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 */
const sendDeletedResponse = (res, message = 'Resource deleted successfully') => {
  return sendSuccessResponse(res, 200, message);
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {string} message - Validation error message
 * @param {Array} errors - Validation errors array
 */
const sendValidationError = (res, message = 'Validation failed', errors = []) => {
  return sendErrorResponse(res, 400, message, { errors });
};

/**
 * Send not found response
 * @param {Object} res - Express response object
 * @param {string} message - Not found message
 */
const sendNotFoundResponse = (res, message = 'Resource not found') => {
  return sendErrorResponse(res, 404, message);
};

/**
 * Send unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Unauthorized message
 */
const sendUnauthorizedResponse = (res, message = 'Unauthorized access') => {
  return sendErrorResponse(res, 401, message);
};

/**
 * Send forbidden response
 * @param {Object} res - Express response object
 * @param {string} message - Forbidden message
 */
const sendForbiddenResponse = (res, message = 'Access forbidden') => {
  return sendErrorResponse(res, 403, message);
};

/**
 * Send conflict response
 * @param {Object} res - Express response object
 * @param {string} message - Conflict message
 */
const sendConflictResponse = (res, message = 'Resource conflict') => {
  return sendErrorResponse(res, 409, message);
};

module.exports = {
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse,
  sendCreatedResponse,
  sendUpdatedResponse,
  sendDeletedResponse,
  sendValidationError,
  sendNotFoundResponse,
  sendUnauthorizedResponse,
  sendForbiddenResponse,
  sendConflictResponse
};
