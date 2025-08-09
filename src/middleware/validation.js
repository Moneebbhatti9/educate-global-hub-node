const Joi = require("joi");

// Validation schemas
const validationSchemas = {
  // User registration
  signup: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string()
      .min(8)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        "any.required": "Password is required",
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref("password"))
      .required()
      .messages({
        "any.only": "Passwords do not match",
        "any.required": "Password confirmation is required",
      }),
    firstName: Joi.string().min(2).max(50).required().messages({
      "string.min": "First name must be at least 2 characters long",
      "string.max": "First name cannot exceed 50 characters",
      "any.required": "First name is required",
    }),
    lastName: Joi.string().min(2).max(50).required().messages({
      "string.min": "Last name must be at least 2 characters long",
      "string.max": "Last name cannot exceed 50 characters",
      "any.required": "Last name is required",
    }),
    role: Joi.string()
      .valid("teacher", "school", "recruiter", "supplier", "admin")
      .required()
      .messages({
        "any.only":
          "Role must be one of: teacher, school, recruiter, supplier, admin",
        "any.required": "Role is required",
      }),
    agreeToTerms: Joi.boolean().valid(true).required().messages({
      "any.only": "You must agree to the terms and conditions",
      "any.required": "Terms agreement is required",
    }),
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
    rememberMe: Joi.boolean().default(false),
  }),

  // Send OTP
  sendOTP: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  }),

  // Verify OTP
  verifyOTP: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
      "string.length": "OTP must be exactly 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
  }),

  // Password reset
  passwordReset: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
      "string.length": "OTP must be exactly 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
    newPassword: Joi.string()
      .min(8)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        "any.required": "New password is required",
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref("newPassword"))
      .required()
      .messages({
        "any.only": "Passwords do not match",
        "any.required": "Password confirmation is required",
      }),
  }),

  // Profile completion
  completeProfile: Joi.object({
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-\(\)]+$/)
      .optional()
      .messages({
        "string.pattern.base": "Please provide a valid phone number",
      }),
    bio: Joi.string().max(500).optional().messages({
      "string.max": "Bio cannot exceed 500 characters",
    }),
    address: Joi.object({
      street: Joi.string().max(100).optional(),
      city: Joi.string().max(50).optional(),
      state: Joi.string().max(50).optional(),
      country: Joi.string().max(50).optional(),
      zipCode: Joi.string().max(20).optional(),
    }).optional(),
    teacher: Joi.object({
      subjects: Joi.array().items(Joi.string()).optional(),
      experience: Joi.number().min(0).max(50).optional().messages({
        "number.min": "Experience cannot be negative",
        "number.max": "Experience cannot exceed 50 years",
      }),
      education: Joi.string().max(100).optional(),
      certifications: Joi.array().items(Joi.string()).optional(),
    }).optional(),
    school: Joi.object({
      schoolName: Joi.string().max(100).optional(),
      schoolType: Joi.string()
        .valid("primary", "secondary", "higher_secondary", "university")
        .optional(),
      studentCount: Joi.number().min(0).optional(),
      address: Joi.string().max(200).optional(),
    }).optional(),
    recruiter: Joi.object({
      companyName: Joi.string().max(100).optional(),
      industry: Joi.string().max(50).optional(),
      position: Joi.string().max(50).optional(),
      experience: Joi.number().min(0).max(50).optional(),
    }).optional(),
    supplier: Joi.object({
      companyName: Joi.string().max(100).optional(),
      industry: Joi.string().max(50).optional(),
      products: Joi.array().items(Joi.string()).optional(),
      experience: Joi.number().min(0).max(50).optional(),
    }).optional(),
  }),

  // Update profile
  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional().messages({
      "string.min": "First name must be at least 2 characters long",
      "string.max": "First name cannot exceed 50 characters",
    }),
    lastName: Joi.string().min(2).max(50).optional().messages({
      "string.min": "Last name must be at least 2 characters long",
      "string.max": "Last name cannot exceed 50 characters",
    }),
    phone: Joi.string()
      .pattern(/^\+?[\d\s\-\(\)]+$/)
      .optional()
      .messages({
        "string.pattern.base": "Please provide a valid phone number",
      }),
    bio: Joi.string().max(500).optional().messages({
      "string.max": "Bio cannot exceed 500 characters",
    }),
    address: Joi.object({
      street: Joi.string().max(100).optional(),
      city: Joi.string().max(50).optional(),
      state: Joi.string().max(50).optional(),
      country: Joi.string().max(50).optional(),
      zipCode: Joi.string().max(20).optional(),
    }).optional(),
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

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(",") || [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB default

  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: `File type not allowed. Allowed types: ${allowedTypes.join(
        ", "
      )}`,
    });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: `File too large. Maximum size: ${Math.round(
        maxSize / 1024 / 1024
      )}MB`,
    });
  }

  next();
};

module.exports = {
  validate,
  validateFileUpload,
  validationSchemas,
};
