const Joi = require("joi");

// Validation schemas for job operations
const jobValidationSchemas = {
  // Create job schema
  createJob: Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
      "string.min": "Job title must be at least 3 characters long",
      "string.max": "Job title cannot exceed 255 characters",
      "any.required": "Job title is required",
    }),
    description: Joi.string().min(50).max(5000).required().messages({
      "string.min": "Job description must be at least 50 characters long",
      "string.max": "Job description cannot exceed 5000 characters",
      "any.required": "Job description is required",
    }),
    requirements: Joi.array()
      .items(Joi.string().min(1).max(200))
      .min(1)
      .max(20)
      .required()
      .messages({
        "array.min": "At least one requirement is required",
        "array.max": "Cannot exceed 20 requirements",
        "any.required": "Job requirements are required",
      }),
    benefits: Joi.array()
      .items(Joi.string().min(1).max(200))
      .max(20)
      .optional()
      .messages({
        "array.max": "Cannot exceed 20 benefits",
      }),
    subjects: Joi.array()
      .items(Joi.string().min(1).max(100))
      .min(1)
      .max(10)
      .required()
      .messages({
        "array.min": "At least one subject is required",
        "array.max": "Cannot exceed 10 subjects",
        "any.required": "Subjects are required",
      }),
    educationLevel: Joi.string()
      .valid(
        "early_years",
        "primary",
        "secondary",
        "high_school",
        "foundation",
        "higher_education"
      )
      .required()
      .messages({
        "any.only":
          "Education level must be one of: early_years, primary, secondary, high_school, foundation, higher_education",
        "any.required": "Education level is required",
      }),
    positionCategory: Joi.string().min(1).max(100).required().messages({
      "string.min": "Position category must be at least 1 character long",
      "string.max": "Position category cannot exceed 100 characters",
      "any.required": "Position category is required",
    }),
    positionSubcategory: Joi.string().min(1).max(100).required().messages({
      "string.min": "Position subcategory must be at least 1 character long",
      "string.max": "Position subcategory cannot exceed 100 characters",
      "any.required": "Position subcategory is required",
    }),
    country: Joi.string().min(2).max(100).required().messages({
      "string.min": "Country must be at least 2 characters long",
      "string.max": "Country cannot exceed 100 characters",
      "any.required": "Country is required",
    }),
    city: Joi.string().min(2).max(100).required().messages({
      "string.min": "City must be at least 2 characters long",
      "string.max": "City cannot exceed 100 characters",
      "any.required": "City is required",
    }),
    salaryMin: Joi.number().positive().optional().messages({
      "number.base": "Minimum salary must be a number",
      "number.positive": "Minimum salary must be positive",
    }),
    salaryMax: Joi.number().positive().optional().messages({
      "number.base": "Maximum salary must be a number",
      "number.positive": "Maximum salary must be positive",
    }),
    currency: Joi.string().length(3).default("USD").messages({
      "string.length": "Currency must be exactly 3 characters",
    }),
    salaryDisclose: Joi.boolean().default(true).messages({
      "boolean.base": "Salary disclose must be a boolean",
    }),
    minExperience: Joi.number().min(0).max(50).optional().messages({
      "number.base": "Minimum experience must be a number",
      "number.min": "Minimum experience cannot be negative",
      "number.max": "Minimum experience cannot exceed 50 years",
    }),
    qualification: Joi.string().min(1).max(100).required().messages({
      "string.min": "Qualification must be at least 1 character long",
      "string.max": "Qualification cannot exceed 100 characters",
      "any.required": "Qualification is required",
    }),
    jobType: Joi.string()
      .valid("full_time", "part_time", "contract", "substitute")
      .required()
      .messages({
        "any.only":
          "Job type must be one of: full_time, part_time, contract, substitute",
        "any.required": "Job type is required",
      }),
    visaSponsorship: Joi.boolean().default(false).messages({
      "boolean.base": "Visa sponsorship must be a boolean",
    }),
    quickApply: Joi.boolean().default(false).messages({
      "boolean.base": "Quick apply must be a boolean",
    }),
    externalLink: Joi.string().uri().optional().messages({
      "string.uri": "External link must be a valid URL",
    }),
    applicationDeadline: Joi.date().min(new Date()).required().messages({
      "date.min": "Application deadline must be in the future",
      "any.required": "Application deadline is required",
    }),
    applicantEmail: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Applicant email is required",
    }),
    screeningQuestions: Joi.array()
      .items(Joi.string().min(1).max(200))
      .max(10)
      .optional()
      .messages({
        "array.max": "Cannot exceed 10 screening questions",
      }),
    tags: Joi.array()
      .items(Joi.string().min(1).max(50))
      .max(10)
      .optional()
      .messages({
        "array.max": "Cannot exceed 10 tags",
      }),
    isUrgent: Joi.boolean().default(false).messages({
      "boolean.base": "Urgent flag must be a boolean",
    }),
    isFeatured: Joi.boolean().default(false).messages({
      "boolean.base": "Featured flag must be a boolean",
    }),
  }).custom((value, helpers) => {
    // Custom validation for salary range
    if (
      value.salaryMin &&
      value.salaryMax &&
      value.salaryMin > value.salaryMax
    ) {
      return helpers.error("any.invalid", {
        message: "Maximum salary must be greater than minimum salary",
      });
    }
    return value;
  }),

  // Update job schema (all fields optional)
  updateJob: Joi.object({
    title: Joi.string().min(3).max(255).optional().messages({
      "string.min": "Job title must be at least 3 characters long",
      "string.max": "Job title cannot exceed 255 characters",
    }),
    description: Joi.string().min(50).max(5000).optional().messages({
      "string.min": "Job description must be at least 50 characters long",
      "string.max": "Job description cannot exceed 5000 characters",
    }),
    requirements: Joi.array()
      .items(Joi.string().min(1).max(200))
      .min(1)
      .max(20)
      .optional()
      .messages({
        "array.min": "At least one requirement is required",
        "array.max": "Cannot exceed 20 requirements",
      }),
    benefits: Joi.array()
      .items(Joi.string().min(1).max(200))
      .max(20)
      .optional()
      .messages({
        "array.max": "Cannot exceed 20 benefits",
      }),
    subjects: Joi.array()
      .items(Joi.string().min(1).max(100))
      .min(1)
      .max(10)
      .optional()
      .messages({
        "array.min": "At least one subject is required",
        "array.max": "Cannot exceed 10 subjects",
      }),
    educationLevel: Joi.string()
      .valid(
        "early_years",
        "primary",
        "secondary",
        "high_school",
        "foundation",
        "higher_education"
      )
      .optional()
      .messages({
        "any.only":
          "Education level must be one of: early_years, primary, secondary, high_school, foundation, higher_education",
      }),
    positionCategory: Joi.string().min(1).max(100).optional().messages({
      "string.min": "Position category must be at least 1 character long",
      "string.max": "Position category cannot exceed 100 characters",
    }),
    positionSubcategory: Joi.string().min(1).max(100).optional().messages({
      "string.min": "Position subcategory must be at least 1 character long",
      "string.max": "Position subcategory cannot exceed 100 characters",
    }),
    country: Joi.string().min(2).max(100).optional().messages({
      "string.min": "Country must be at least 2 characters long",
      "string.max": "Country cannot exceed 100 characters",
    }),
    city: Joi.string().min(2).max(100).optional().messages({
      "string.min": "City must be at least 2 characters long",
      "string.max": "City cannot exceed 100 characters",
    }),
    salaryMin: Joi.number().positive().optional().messages({
      "number.base": "Minimum salary must be a number",
      "number.positive": "Minimum salary must be positive",
    }),
    salaryMax: Joi.number().positive().optional().messages({
      "number.base": "Maximum salary must be a number",
      "number.positive": "Maximum salary must be positive",
    }),
    currency: Joi.string().length(3).optional().messages({
      "string.length": "Currency must be exactly 3 characters",
    }),
    salaryDisclose: Joi.boolean().optional().messages({
      "boolean.base": "Salary disclose must be a boolean",
    }),
    minExperience: Joi.number().min(0).max(50).optional().messages({
      "number.base": "Minimum experience must be a number",
      "number.min": "Minimum experience cannot be negative",
      "number.max": "Minimum experience cannot exceed 50 years",
    }),
    qualification: Joi.string().min(1).max(100).optional().messages({
      "string.min": "Qualification must be at least 1 character long",
      "string.max": "Qualification cannot exceed 100 characters",
    }),
    jobType: Joi.string()
      .valid("full_time", "part_time", "contract", "substitute")
      .optional()
      .messages({
        "any.only":
          "Job type must be one of: full_time, part_time, contract, substitute",
      }),
    visaSponsorship: Joi.boolean().optional().messages({
      "boolean.base": "Visa sponsorship must be a boolean",
    }),
    quickApply: Joi.boolean().optional().messages({
      "boolean.base": "Quick apply must be a boolean",
    }),
    externalLink: Joi.string().uri().optional().messages({
      "string.uri": "External link must be a valid URL",
    }),
    applicationDeadline: Joi.date().min(new Date()).optional().messages({
      "date.min": "Application deadline must be in the future",
    }),
    applicantEmail: Joi.string().email().optional().messages({
      "string.email": "Please provide a valid email address",
    }),
    screeningQuestions: Joi.array()
      .items(Joi.string().min(1).max(200))
      .max(10)
      .optional()
      .messages({
        "array.max": "Cannot exceed 10 screening questions",
      }),
    tags: Joi.array()
      .items(Joi.string().min(1).max(50))
      .max(10)
      .optional()
      .messages({
        "array.max": "Cannot exceed 10 tags",
      }),
    isUrgent: Joi.boolean().optional().messages({
      "boolean.base": "Urgent flag must be a boolean",
    }),
    isFeatured: Joi.boolean().optional().messages({
      "boolean.base": "Featured flag must be a boolean",
    }),
  }).custom((value, helpers) => {
    // Custom validation for salary range
    if (
      value.salaryMin &&
      value.salaryMax &&
      value.salaryMin > value.salaryMax
    ) {
      return helpers.error("any.invalid", {
        message: "Maximum salary must be greater than minimum salary",
      });
    }
    return value;
  }),

  // Job search schema
  searchJobs: Joi.object({
    q: Joi.string().min(1).max(200).optional().messages({
      "string.min": "Search query must be at least 1 character long",
      "string.max": "Search query cannot exceed 200 characters",
    }),
    location: Joi.string().min(1).max(200).optional().messages({
      "string.min": "Location must be at least 1 character long",
      "string.max": "Location cannot exceed 200 characters",
    }),
    country: Joi.string().min(2).max(100).optional().messages({
      "string.min": "Country must be at least 2 characters long",
      "string.max": "Country cannot exceed 100 characters",
    }),
    city: Joi.string().min(2).max(100).optional().messages({
      "string.min": "City must be at least 2 characters long",
      "string.max": "City cannot exceed 100 characters",
    }),
    salaryMin: Joi.number().positive().optional().messages({
      "number.base": "Minimum salary must be a number",
      "number.positive": "Minimum salary must be positive",
    }),
    salaryMax: Joi.number().positive().optional().messages({
      "number.base": "Maximum salary must be a number",
      "number.positive": "Maximum salary must be positive",
    }),
    currency: Joi.string().length(3).optional().messages({
      "string.length": "Currency must be exactly 3 characters",
    }),
    educationLevel: Joi.string()
      .valid(
        "early_years",
        "primary",
        "secondary",
        "high_school",
        "foundation",
        "higher_education"
      )
      .optional()
      .messages({
        "any.only":
          "Education level must be one of: early_years, primary, secondary, high_school, foundation, higher_education",
      }),
    subjects: Joi.array()
      .items(Joi.string().min(1).max(100))
      .optional()
      .messages({
        "array.max": "Cannot exceed 10 subjects",
      }),
    jobType: Joi.string()
      .valid("full_time", "part_time", "contract", "substitute")
      .optional()
      .messages({
        "any.only":
          "Job type must be one of: full_time, part_time, contract, substitute",
      }),
    visaSponsorship: Joi.boolean().optional().messages({
      "boolean.base": "Visa sponsorship must be a boolean",
    }),
    quickApply: Joi.boolean().optional().messages({
      "boolean.base": "Quick apply must be a boolean",
    }),
    isUrgent: Joi.boolean().optional().messages({
      "boolean.base": "Urgent flag must be a boolean",
    }),
    isFeatured: Joi.boolean().optional().messages({
      "boolean.base": "Featured flag must be a boolean",
    }),
    postedWithin: Joi.number().min(1).max(365).optional().messages({
      "number.base": "Posted within must be a number",
      "number.min": "Posted within must be at least 1 day",
      "number.max": "Posted within cannot exceed 365 days",
    }),
    deadlineWithin: Joi.number().min(1).max(365).optional().messages({
      "number.base": "Deadline within must be a number",
      "number.min": "Deadline within must be at least 1 day",
      "number.max": "Deadline within cannot exceed 365 days",
    }),
    page: Joi.number().integer().min(1).default(1).optional().messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .optional()
      .messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),
    sortBy: Joi.string()
      .valid("relevance", "date", "salary", "deadline", "views")
      .default("relevance")
      .optional()
      .messages({
        "any.only":
          "Sort by must be one of: relevance, date, salary, deadline, views",
      }),
    sortOrder: Joi.string()
      .valid("asc", "desc")
      .default("desc")
      .optional()
      .messages({
        "any.only": "Sort order must be one of: asc, desc",
      }),
  }).custom((value, helpers) => {
    // Custom validation for salary range
    if (
      value.salaryMin &&
      value.salaryMax &&
      value.salaryMin > value.salaryMax
    ) {
      return helpers.error("any.invalid", {
        message: "Maximum salary must be greater than minimum salary",
      });
    }
    return value;
  }),

  // Update job status schema
  updateJobStatus: Joi.object({
    status: Joi.string()
      .valid("draft", "published", "active", "expired", "closed", "archived")
      .required()
      .messages({
        "any.only":
          "Status must be one of: draft, published, active, expired, closed, archived",
        "any.required": "Status is required",
      }),
    notes: Joi.string().max(500).optional().messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
  }),

  // Job application schema
  createApplication: Joi.object({
    coverLetter: Joi.string().min(200).max(2000).required().messages({
      "string.min": "Cover letter must be at least 200 characters long",
      "string.max": "Cover letter cannot exceed 2000 characters",
      "any.required": "Cover letter is required",
    }),
    expectedSalary: Joi.number().positive().optional().messages({
      "number.base": "Expected salary must be a number",
      "number.positive": "Expected salary must be positive",
    }),
    availableFrom: Joi.date().min(new Date()).required().messages({
      "date.min": "Available from date must be today or in the future",
      "any.required": "Available from date is required",
    }),
    reasonForApplying: Joi.string().min(50).max(1000).required().messages({
      "string.min": "Reason for applying must be at least 50 characters long",
      "string.max": "Reason for applying cannot exceed 1000 characters",
      "any.required": "Reason for applying is required",
    }),
    additionalComments: Joi.string().max(500).optional().messages({
      "string.max": "Additional comments cannot exceed 500 characters",
    }),
    screeningAnswers: Joi.object()
      .pattern(/^.+$/, Joi.string().min(1).max(500))
      .optional()
      .messages({
        "object.pattern": "Screening answers must be valid key-value pairs",
      }),
    resumeUrl: Joi.string().uri().optional().messages({
      "string.uri": "Resume URL must be a valid URL",
    }),
    documents: Joi.array()
      .items(Joi.string().uri())
      .max(5)
      .optional()
      .messages({
        "array.max": "Cannot exceed 5 documents",
      }),
  }),

  // Update application status schema
  updateApplicationStatus: Joi.object({
    status: Joi.string()
      .valid(
        "pending",
        "reviewing",
        "shortlisted",
        "interviewed",
        "accepted",
        "rejected",
        "withdrawn"
      )
      .required()
      .messages({
        "any.only":
          "Status must be one of: pending, reviewing, shortlisted, interviewed, accepted, rejected, withdrawn",
        "any.required": "Status is required",
      }),
    notes: Joi.string().max(1000).optional().messages({
      "string.max": "Notes cannot exceed 1000 characters",
    }),
    rejectionReason: Joi.string().max(500).optional().messages({
      "string.max": "Rejection reason cannot exceed 500 characters",
    }),
    interviewDate: Joi.date().min(new Date()).optional().messages({
      "date.min": "Interview date must be in the future",
    }),
    interviewNotes: Joi.string().max(1000).optional().messages({
      "string.max": "Interview notes cannot exceed 1000 characters",
    }),
  }),

  // Save job schema
  saveJob: Joi.object({
    notes: Joi.string().max(500).optional().messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
    priority: Joi.string()
      .valid("low", "medium", "high", "urgent")
      .default("medium")
      .optional()
      .messages({
        "any.only": "Priority must be one of: low, medium, high, urgent",
      }),
    reminderDate: Joi.date().min(new Date()).optional().messages({
      "date.min": "Reminder date must be in the future",
    }),
    tags: Joi.array()
      .items(Joi.string().min(1).max(50))
      .max(10)
      .optional()
      .messages({
        "array.max": "Cannot exceed 10 tags",
      }),
  }),

  // Update saved job schema
  updateSavedJob: Joi.object({
    notes: Joi.string().max(500).optional().messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
    priority: Joi.string()
      .valid("low", "medium", "high", "urgent")
      .optional()
      .messages({
        "any.only": "Priority must be one of: low, medium, high, urgent",
      }),
    reminderDate: Joi.date().min(new Date()).optional().messages({
      "date.min": "Reminder date must be in the future",
    }),
    tags: Joi.array()
      .items(Joi.string().min(1).max(50))
      .max(10)
      .optional()
      .messages({
        "array.max": "Cannot exceed 10 tags",
      }),
  }),

  // Pagination schema
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1).optional().messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .optional()
      .messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),
  }),
};

// Validation middleware factory for jobs
const validateJob = (schemaName) => {
  return (req, res, next) => {
    const schema = jobValidationSchemas[schemaName];

    if (!schema) {
      return res.status(500).json({
        success: false,
        message: `Validation schema '${schemaName}' not found`,
      });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errorMessages,
      });
    }

    // Replace req.body with validated data
    req.body = value;
    next();
  };
};

// Validation middleware for query parameters
const validateJobQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = jobValidationSchemas[schemaName];

    if (!schema) {
      return res.status(500).json({
        success: false,
        message: `Validation schema '${schemaName}' not found`,
      });
    }

    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: "Query validation failed",
        errors: errorMessages,
      });
    }

    // Replace req.query with validated data
    req.query = value;
    next();
  };
};

module.exports = {
  validateJob,
  validateJobQuery,
  jobValidationSchemas,
};
