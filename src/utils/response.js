// Success response helper
const successResponse = (
  res,
  data = null,
  message = "Success",
  statusCode = 200
) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

// Error response helper
const errorResponse = (
  res,
  message = "Error occurred",
  statusCode = 500,
  errors = null
) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

// Validation error response
const validationErrorResponse = (res, errors) => {
  return errorResponse(res, "Validation failed", 400, errors);
};

// Not found response
const notFoundResponse = (res, message = "Resource not found") => {
  return errorResponse(res, message, 404);
};

// Unauthorized response
const unauthorizedResponse = (res, message = "Unauthorized") => {
  return errorResponse(res, message, 401);
};

// Forbidden response
const forbiddenResponse = (res, message = "Forbidden") => {
  return errorResponse(res, message, 403);
};

// Conflict response
const conflictResponse = (res, message = "Resource already exists") => {
  return errorResponse(res, message, 409);
};

// Rate limit response
const rateLimitResponse = (res, message = "Too many requests") => {
  return errorResponse(res, message, 429);
};

// Created response
const createdResponse = (
  res,
  data,
  message = "Resource created successfully"
) => {
  return successResponse(res, data, message, 201);
};

// Updated response
const updatedResponse = (
  res,
  data,
  message = "Resource updated successfully"
) => {
  return successResponse(res, data, message, 200);
};

// Deleted response
const deletedResponse = (res, message = "Resource deleted successfully") => {
  return successResponse(res, null, message, 200);
};

// Paginated response
const paginatedResponse = (res, data, pagination, message = "Success") => {
  return successResponse(
    res,
    {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext:
          pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    },
    message
  );
};

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse,
  rateLimitResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  paginatedResponse,
};
