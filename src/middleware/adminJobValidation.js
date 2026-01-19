const Joi = require("joi");
const mongoose = require("mongoose");

// Validation schemas
const validationSchemas = {
  // Job status update validation
  jobStatusUpdate: Joi.object({
    status: Joi.string()
      .valid("draft", "published", "closed", "expired")
      .required()
      .messages({
        "any.only":
          "Invalid job status. Must be one of: draft, published, closed, expired",
        "any.required": "Status is required",
      }),
    reason: Joi.string().optional().min(3).max(500).trim().messages({
      "string.min": "Reason must be at least 3 characters long",
      "string.max": "Reason cannot exceed 500 characters",
    }),
  }),

  // Job deletion validation
  jobDeletion: Joi.object({
    reason: Joi.string().optional().min(3).max(500).trim().messages({
      "string.min": "Deletion reason must be at least 3 characters long",
      "string.max": "Deletion reason cannot exceed 500 characters",
    }),
  }),

  // Bulk status update validation
  bulkStatusUpdate: Joi.object({
    jobIds: Joi.array()
      .items(
        Joi.string().custom((value, helpers) => {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return helpers.error("any.invalid");
          }
          return value;
        }, "ObjectId validation")
      )
      .min(1)
      .max(100)
      .required()
      .messages({
        "array.min": "At least one job ID is required",
        "array.max": "Cannot update more than 100 jobs at once",
        "any.required": "Job IDs are required",
        "any.invalid": "Invalid job ID format",
      }),
    status: Joi.string()
      .valid("draft", "published", "closed", "expired")
      .required()
      .messages({
        "any.only":
          "Invalid job status. Must be one of: draft, published, closed, expired",
        "any.required": "Status is required",
      }),
    reason: Joi.string().optional().min(3).max(500).trim().messages({
      "string.min": "Reason must be at least 3 characters long",
      "string.max": "Reason cannot exceed 500 characters",
    }),
  }),

  // Job query parameters validation
  jobQueryParams: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
    search: Joi.string().optional().allow("").trim().max(100).messages({
      "string.max": "Search term cannot exceed 100 characters",
    }),
    status: Joi.string()
      .valid("draft", "published", "closed", "expired")
      .optional()
      .messages({
        "any.only":
          "Invalid status filter. Must be one of: draft, published, closed, expired",
      }),
    jobType: Joi.string().optional().trim().max(50).messages({
      "string.max": "Job type filter cannot exceed 50 characters",
    }),
    country: Joi.string().optional().trim().max(100).messages({
      "string.max": "Country filter cannot exceed 100 characters",
    }),
    sortBy: Joi.string()
      .valid(
        "createdAt",
        "publishedAt",
        "title",
        "organization",
        "status",
        "applicantsCount",
        "viewsCount"
      )
      .default("createdAt")
      .messages({
        "any.only":
          "Invalid sort field. Must be one of: createdAt, publishedAt, title, organization, status, applicantsCount, viewsCount",
      }),
    sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
      "any.only": "Sort order must be either 'asc' or 'desc'",
    }),
  }),

  // Export query parameters validation
  exportQueryParams: Joi.object({
    format: Joi.string().valid("csv", "json").default("csv").messages({
      "any.only": "Export format must be either 'csv' or 'json'",
    }),
    status: Joi.string()
      .valid("draft", "published", "closed", "expired")
      .optional()
      .messages({
        "any.only":
          "Invalid status filter. Must be one of: draft, published, closed, expired",
      }),
    jobType: Joi.string().optional().trim().max(50).messages({
      "string.max": "Job type filter cannot exceed 50 characters",
    }),
    country: Joi.string().optional().trim().max(100).messages({
      "string.max": "Country filter cannot exceed 100 characters",
    }),
    startDate: Joi.date().iso().optional().messages({
      "date.base": "Start date must be a valid date",
      "date.format": "Start date must be in ISO format",
    }),
    endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().messages({
      "date.base": "End date must be a valid date",
      "date.format": "End date must be in ISO format",
      "date.min": "End date must be after start date",
    }),
  }),

  // Job applications query parameters validation
  jobApplicationsQueryParams: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
    status: Joi.string()
      .valid("pending", "reviewed", "shortlisted", "rejected", "accepted")
      .optional()
      .messages({
        "any.only":
          "Invalid application status filter. Must be one of: pending, reviewed, shortlisted, rejected, accepted",
      }),
    sortBy: Joi.string()
      .valid(
        "createdAt",
        "updatedAt",
        "status",
        "teacherName",
        "appliedAt",
        "expectedSalary",
        "availableFrom"
      )
      .default("createdAt")
      .messages({
        "any.only":
          "Invalid sort field. Must be one of: createdAt, updatedAt, status, teacherName, appliedAt, expectedSalary, availableFrom",
      }),
    sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
      "any.only": "Sort order must be either 'asc' or 'desc'",
    }),
  }),

  // Analytics query parameters validation
  analyticsQueryParams: Joi.object({
    period: Joi.string()
      .valid("7d", "30d", "90d", "1y")
      .default("30d")
      .messages({
        "any.only": "Period must be one of: 7d, 30d, 90d, 1y",
      }),
    startDate: Joi.date().iso().optional().messages({
      "date.base": "Start date must be a valid date",
      "date.format": "Start date must be in ISO format",
    }),
    endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().messages({
      "date.base": "End date must be a valid date",
      "date.format": "End date must be in ISO format",
      "date.min": "End date must be after start date",
    }),
  }),
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];

    if (!schema) {
      return res.status(500).json({
        success: false,
        message: `Validation schema '${schemaName}' not found`,
      });
    }

    // Determine which part of the request to validate
    let dataToValidate;
    let validationOptions = { abortEarly: false, stripUnknown: true };

    if (
      schemaName === "jobStatusUpdate" ||
      schemaName === "jobDeletion" ||
      schemaName === "bulkStatusUpdate"
    ) {
      dataToValidate = req.body;
    } else {
      dataToValidate = req.query;
      validationOptions.allowUnknown = true; // Allow additional query params
    }

    const { error, value } = schema.validate(dataToValidate, validationOptions);

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errorMessages,
      });
    }

    // Replace the validated data
    if (
      schemaName === "jobStatusUpdate" ||
      schemaName === "jobDeletion" ||
      schemaName === "bulkStatusUpdate"
    ) {
      req.body = value;
    } else {
      req.query = value;
    }

    next();
  };
};

// ObjectId validation middleware for path parameters
const validateObjectId = (req, res, next) => {
  const { id, jobId } = req.params;
  const objectId = id || jobId;

  if (!mongoose.Types.ObjectId.isValid(objectId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  next();
};

// Export validation middleware functions
const validateJobStatusUpdate = [validateObjectId, validate("jobStatusUpdate")];

const validateJobDeletion = [validateObjectId, validate("jobDeletion")];

const validateBulkStatusUpdate = [validate("bulkStatusUpdate")];

const validateJobQueryParams = [validate("jobQueryParams")];

const validateExportQueryParams = [validate("exportQueryParams")];

const validateJobApplicationsQueryParams = [
  validateObjectId,
  validate("jobApplicationsQueryParams"),
];

const validateAnalyticsQueryParams = [validate("analyticsQueryParams")];

module.exports = {
  validateJobStatusUpdate,
  validateJobDeletion,
  validateBulkStatusUpdate,
  validateJobQueryParams,
  validateExportQueryParams,
  validateJobApplicationsQueryParams,
  validateAnalyticsQueryParams,
};
