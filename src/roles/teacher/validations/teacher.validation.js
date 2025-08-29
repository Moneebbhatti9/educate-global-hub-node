const { z } = require("zod");

// Teacher profile creation validation schema
const createTeacherProfileSchema = z.object({
  // Personal Information
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters long")
    .max(50, "First name cannot exceed 50 characters")
    .trim(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters long")
    .max(50, "Last name cannot exceed 50 characters")
    .trim(),

  // Contact Information
  phoneNumber: z
    .string()
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Please enter a valid phone number with country code (e.g., +1234567890)"
    )
    .trim(),

  // Location Information
  country: z
    .string()
    .min(2, "Country must be at least 2 characters long")
    .trim(),
  city: z.string().min(2, "City must be at least 2 characters long").trim(),
  provinceState: z
    .string()
    .min(2, "Province/State must be at least 2 characters long")
    .trim(),
  zipCode: z
    .string()
    .regex(/^\d+$/, "Zip code must contain only numbers")
    .optional()
    .nullable(),
  address: z
    .string()
    .min(10, "Address must be at least 10 characters long")
    .max(200, "Address cannot exceed 200 characters")
    .trim(),

  // Professional Information
  qualification: z.enum(
    ["Bachelor", "Master", "PhD", "Diploma", "Certificate", "Other"],
    {
      errorMap: () => ({
        message:
          "Qualification must be one of: Bachelor, Master, PhD, Diploma, Certificate, Other",
      }),
    }
  ),
  teachingSubjects: z
    .array(
      z
        .string()
        .min(2, "Teaching subject must be at least 2 characters long")
        .max(50, "Teaching subject cannot exceed 50 characters")
        .trim()
    )
    .min(1, "At least one teaching subject is required")
    .max(10, "Cannot exceed 10 teaching subjects"),
  yearsOfExperience: z
    .number()
    .int("Years of experience must be a whole number")
    .min(0, "Years of experience cannot be negative")
    .max(50, "Years of experience cannot exceed 50"),
  pgce: z.boolean().default(false),

  // Professional Bio
  professionalBio: z
    .string()
    .min(30, "Professional bio must be at least 30 words")
    .max(200, "Professional bio cannot exceed 200 words")
    .trim()
    .refine(
      (val) => {
        const wordCount = val.trim().split(/\s+/).length;
        return wordCount >= 30 && wordCount <= 200;
      },
      {
        message: "Professional bio must be between 30 and 200 words",
      }
    ),

  // Achievements and Certifications
  keyAchievements: z
    .array(
      z
        .string()
        .min(10, "Achievement must be at least 10 characters long")
        .max(200, "Achievement cannot exceed 200 characters")
        .trim()
    )
    .max(10, "Cannot exceed 10 achievements")
    .optional(),
  certifications: z
    .array(
      z
        .string()
        .min(5, "Certification must be at least 5 characters long")
        .max(100, "Certification cannot exceed 100 characters")
        .trim()
    )
    .max(10, "Cannot exceed 10 certifications")
    .optional(),

  // References
  references: z
    .array(
      z.object({
        name: z
          .string()
          .min(2, "Reference name must be at least 2 characters long")
          .trim(),
        position: z
          .string()
          .min(2, "Reference position must be at least 2 characters long")
          .trim(),
        organization: z
          .string()
          .min(2, "Reference organization must be at least 2 characters long")
          .trim(),
        email: z
          .string()
          .email("Please enter a valid email address")
          .toLowerCase()
          .trim(),
        phone: z
          .string()
          .regex(
            /^\+[1-9]\d{1,14}$/,
            "Please enter a valid phone number with country code"
          )
          .trim(),
      })
    )
    .max(3, "Cannot exceed 3 references")
    .optional(),

  // Preferences
  preferredLocations: z
    .array(z.string().trim())
    .max(10, "Cannot exceed 10 preferred locations")
    .optional(),
  preferredSalary: z
    .object({
      min: z.number().min(0, "Minimum salary cannot be negative").optional(),
      max: z.number().min(0, "Maximum salary cannot be negative").optional(),
      currency: z.string().default("USD"),
    })
    .optional(),
  availability: z
    .enum(["Immediate", "2 weeks", "1 month", "3 months", "Flexible"], {
      errorMap: () => ({
        message:
          "Availability must be one of: Immediate, 2 weeks, 1 month, 3 months, Flexible",
      }),
    })
    .default("Flexible"),

  // Documents
  cvUrl: z.string().url("Please enter a valid URL").optional().nullable(),
  coverLetterUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .nullable(),
});

// Teacher profile update validation schema
const updateTeacherProfileSchema = z.object({
  // Personal Information
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters long")
    .max(50, "First name cannot exceed 50 characters")
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters long")
    .max(50, "Last name cannot exceed 50 characters")
    .trim()
    .optional(),

  // Contact Information
  phoneNumber: z
    .string()
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Please enter a valid phone number with country code (e.g., +1234567890)"
    )
    .trim()
    .optional(),

  // Location Information
  country: z
    .string()
    .min(2, "Country must be at least 2 characters long")
    .trim()
    .optional(),
  city: z
    .string()
    .min(2, "City must be at least 2 characters long")
    .trim()
    .optional(),
  provinceState: z
    .string()
    .min(2, "Province/State must be at least 2 characters long")
    .trim()
    .optional(),
  zipCode: z
    .string()
    .regex(/^\d+$/, "Zip code must contain only numbers")
    .optional()
    .nullable(),
  address: z
    .string()
    .min(10, "Address must be at least 10 characters long")
    .max(200, "Address cannot exceed 200 characters")
    .trim()
    .optional(),

  // Professional Information
  qualification: z
    .enum(["Bachelor", "Master", "PhD", "Diploma", "Certificate", "Other"], {
      errorMap: () => ({
        message:
          "Qualification must be one of: Bachelor, Master, PhD, Diploma, Certificate, Other",
      }),
    })
    .optional(),
  teachingSubjects: z
    .array(
      z
        .string()
        .min(2, "Teaching subject must be at least 2 characters long")
        .max(50, "Teaching subject cannot exceed 50 characters")
        .trim()
    )
    .min(1, "At least one teaching subject is required")
    .max(10, "Cannot exceed 10 teaching subjects")
    .optional(),
  yearsOfExperience: z
    .number()
    .int("Years of experience must be a whole number")
    .min(0, "Years of experience cannot be negative")
    .max(50, "Years of experience cannot exceed 50")
    .optional(),
  pgce: z.boolean().optional(),

  // Professional Bio
  professionalBio: z
    .string()
    .min(30, "Professional bio must be at least 30 words")
    .max(200, "Professional bio cannot exceed 200 words")
    .trim()
    .refine(
      (val) => {
        const wordCount = val.trim().split(/\s+/).length;
        return wordCount >= 30 && wordCount <= 200;
      },
      {
        message: "Professional bio must be between 30 and 200 words",
      }
    )
    .optional(),

  // Achievements and Certifications
  keyAchievements: z
    .array(
      z
        .string()
        .min(10, "Achievement must be at least 10 characters long")
        .max(200, "Achievement cannot exceed 200 characters")
        .trim()
    )
    .max(10, "Cannot exceed 10 achievements")
    .optional(),
  certifications: z
    .array(
      z
        .string()
        .min(5, "Certification must be at least 5 characters long")
        .max(100, "Certification cannot exceed 100 characters")
        .trim()
    )
    .max(10, "Cannot exceed 10 certifications")
    .optional(),

  // References
  references: z
    .array(
      z.object({
        name: z
          .string()
          .min(2, "Reference name must be at least 2 characters long")
          .trim(),
        position: z
          .string()
          .min(2, "Reference position must be at least 2 characters long")
          .trim(),
        organization: z
          .string()
          .min(2, "Reference organization must be at least 2 characters long")
          .trim(),
        email: z
          .string()
          .email("Please enter a valid email address")
          .toLowerCase()
          .trim(),
        phone: z
          .string()
          .regex(
            /^\+[1-9]\d{1,14}$/,
            "Please enter a valid phone number with country code"
          )
          .trim(),
      })
    )
    .max(3, "Cannot exceed 3 references")
    .optional(),

  // Preferences
  preferredLocations: z
    .array(z.string().trim())
    .max(10, "Cannot exceed 10 preferred locations")
    .optional(),
  preferredSalary: z
    .object({
      min: z.number().min(0, "Minimum salary cannot be negative").optional(),
      max: z.number().min(0, "Maximum salary cannot be negative").optional(),
      currency: z.string().default("USD"),
    })
    .optional(),
  availability: z
    .enum(["Immediate", "2 weeks", "1 month", "3 months", "Flexible"], {
      errorMap: () => ({
        message:
          "Availability must be one of: Immediate, 2 weeks, 1 month, 3 months, Flexible",
      }),
    })
    .optional(),

  // Documents
  cvUrl: z.string().url("Please enter a valid URL").optional().nullable(),
  coverLetterUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .nullable(),
});

// Validation middleware function
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.body);
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }
      next(error);
    }
  };
};

module.exports = {
  createTeacherProfileSchema,
  updateTeacherProfileSchema,
  validateRequest,
};
