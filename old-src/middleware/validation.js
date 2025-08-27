const Joi = require("joi");
const mongoose = require("mongoose");

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
      .valid("student", "teacher", "school", "recruiter", "supplier", "admin")
      .default("student")
      .messages({
        "any.only":
          "Role must be one of: student, teacher, school, recruiter, supplier, admin",
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

  // Refresh token
  refresh: Joi.object({
    refreshToken: Joi.string().required().messages({
      "any.required": "Refresh token is required",
    }),
  }),

  // Logout
  logout: Joi.object({
    refreshToken: Joi.string().optional(),
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
      .pattern(/^\+[1-9]\d{1,14}$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Please provide a valid phone number with country code (e.g., +1234567890)",
      }),
    bio: Joi.string().max(500).optional().messages({
      "string.max": "Bio cannot exceed 500 characters",
    }),
    address: Joi.string().max(200).optional().messages({
      "string.max": "Address cannot exceed 200 characters",
    }),
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
      .pattern(/^\+[1-9]\d{1,14}$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Please provide a valid phone number with country code (e.g., +1234567890)",
      }),
    bio: Joi.string().max(500).optional().messages({
      "string.max": "Bio cannot exceed 500 characters",
    }),
    address: Joi.string().max(200).optional().messages({
      "string.max": "Address cannot exceed 200 characters",
    }),
  }),

  // Teacher profile validation
  teacherProfile: Joi.object({
    fullName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Full name must be at least 2 characters long",
      "string.max": "Full name cannot exceed 100 characters",
      "any.required": "Full name is required",
    }),
    phoneNumber: Joi.string()
      .pattern(/^\+[1-9]\d{1,14}$/)
      .required()
      .messages({
        "string.pattern.base":
          "Please provide a valid phone number with country code (e.g., +1234567890)",
        "any.required": "Phone number with country code is required",
      }),
    country: Joi.string().min(2).max(50).required().messages({
      "string.min": "Country must be at least 2 characters long",
      "string.max": "Country cannot exceed 50 characters",
      "any.required": "Country is required",
    }),
    city: Joi.string().min(2).max(50).required().messages({
      "string.min": "City must be at least 2 characters long",
      "string.max": "City cannot exceed 50 characters",
      "any.required": "City is required",
    }),
    province: Joi.string().min(2).max(50).required().messages({
      "string.min": "Province/State must be at least 2 characters long",
      "string.max": "Province/State cannot exceed 50 characters",
      "any.required": "Province/State is required",
    }),
    zipCode: Joi.string().min(2).max(20).required().messages({
      "string.min": "Zip code must be at least 2 characters long",
      "string.max": "Zip code cannot exceed 20 characters",
      "any.required": "Zip code is required",
    }),
    address: Joi.string().min(5).max(200).required().messages({
      "string.min": "Address must be at least 5 characters long",
      "string.max": "Address cannot exceed 200 characters",
      "any.required": "Address is required",
    }),
    qualification: Joi.string()
      .valid("Bachelor", "Master", "PhD", "Diploma", "Certificate", "Other")
      .required()
      .messages({
        "any.only":
          "Qualification must be one of: Bachelor, Master, PhD, Diploma, Certificate, Other",
        "any.required": "Qualification is required",
      }),
    subject: Joi.string().min(2).max(100).required().messages({
      "string.min": "Subject must be at least 2 characters long",
      "string.max": "Subject cannot exceed 100 characters",
      "any.required": "Subject is required",
    }),
    pgce: Joi.boolean().default(false),
    yearsOfTeachingExperience: Joi.number().min(0).max(50).required().messages({
      "number.min": "Years of experience cannot be negative",
      "number.max": "Years of experience cannot exceed 50",
      "any.required": "Years of teaching experience is required",
    }),
    professionalBio: Joi.string().min(50).max(1000).required().messages({
      "string.min": "Professional bio must be at least 50 characters long",
      "string.max": "Professional bio cannot exceed 1000 characters",
      "any.required": "Professional bio is required",
    }),
    keyAchievements: Joi.array().items(Joi.string().max(200)).optional(),
    certifications: Joi.array().items(Joi.string().max(200)).optional(),
    additionalQualifications: Joi.array()
      .items(Joi.string().max(200))
      .optional(),
  }),

  // School profile validation
  schoolProfile: Joi.object({
    schoolName: Joi.string().min(2).max(100).required().messages({
      "string.min": "School name must be at least 2 characters long",
      "string.max": "School name cannot exceed 100 characters",
      "any.required": "School name is required",
    }),
    schoolEmail: Joi.string().email().required().messages({
      "string.email": "Please provide a valid school email address",
      "any.required": "School email is required",
    }),
    schoolContactNumber: Joi.string()
      .pattern(/^\+[1-9]\d{1,14}$/)
      .required()
      .messages({
        "string.pattern.base":
          "Please provide a valid contact number with country code (e.g., +1234567890)",
        "any.required": "School contact number with country code is required",
      }),
    country: Joi.string().min(2).max(50).required().messages({
      "string.min": "Country must be at least 2 characters long",
      "string.max": "Country cannot exceed 50 characters",
      "any.required": "Country is required",
    }),
    city: Joi.string().min(2).max(50).required().messages({
      "string.min": "City must be at least 2 characters long",
      "string.max": "City cannot exceed 50 characters",
      "any.required": "City is required",
    }),
    province: Joi.string().min(2).max(50).required().messages({
      "string.min": "Province/State must be at least 2 characters long",
      "string.max": "Province/State cannot exceed 50 characters",
      "any.required": "Province/State is required",
    }),
    zipCode: Joi.string().min(2).max(20).required().messages({
      "string.min": "Zip code must be at least 2 characters long",
      "string.max": "Zip code cannot exceed 20 characters",
      "any.required": "Zip code is required",
    }),
    address: Joi.string().min(5).max(200).required().messages({
      "string.min": "Address must be at least 5 characters long",
      "string.max": "Address cannot exceed 200 characters",
      "any.required": "Address is required",
    }),
    curriculum: Joi.array()
      .items(
        Joi.string().valid(
          "British Curriculum",
          "American Curriculum",
          "IB (International Baccalaureate)",
          "Canadian Curriculum",
          "Australian Curriculum",
          "National Curriculum",
          "Montessori",
          "Waldorf",
          "Reggio Emilia",
          "Other"
        )
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one curriculum must be selected",
        "any.required": "Curriculum is required",
      }),
    schoolSize: Joi.string()
      .valid(
        "Small (1-500 students)",
        "Medium (501-1000 students)",
        "Large (1001+ students)"
      )
      .required()
      .messages({
        "any.only": "School size must be one of: Small, Medium, Large",
        "any.required": "School size is required",
      }),
    schoolType: Joi.string()
      .valid(
        "Public",
        "Private",
        "International",
        "Charter",
        "Religious",
        "Other"
      )
      .required()
      .messages({
        "any.only":
          "School type must be one of: Public, Private, International, Charter, Religious, Other",
        "any.required": "School type is required",
      }),
    genderType: Joi.string()
      .valid("Boys Only", "Girls Only", "Mixed")
      .required()
      .messages({
        "any.only": "Gender type must be one of: Boys Only, Girls Only, Mixed",
        "any.required": "Gender type is required",
      }),
    ageGroup: Joi.array()
      .items(
        Joi.string().valid(
          "Early Years (2-5 years)",
          "Primary (6-11 years)",
          "Secondary (12-16 years)",
          "Sixth Form/High School (17-18 years)",
          "All Ages"
        )
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one age group must be selected",
        "any.required": "Age group is required",
      }),
    schoolWebsite: Joi.string().uri().optional().messages({
      "string.uri": "Please provide a valid website URL",
    }),
    aboutSchool: Joi.string().min(100).max(2000).required().messages({
      "string.min": "About school must be at least 100 characters long",
      "string.max": "About school cannot exceed 2000 characters",
      "any.required": "About school is required",
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

// ObjectId validation middleware
const validateObjectId = (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  next();
};

module.exports = {
  validate,
  validateFileUpload,
  validateObjectId,
  validationSchemas,
};
