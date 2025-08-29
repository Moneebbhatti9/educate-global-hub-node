const { z } = require("zod");

// School profile creation validation schema
const createSchoolProfileSchema = z.object({
  // School Information
  schoolName: z
    .string()
    .min(2, "School name must be at least 2 characters long")
    .max(100, "School name cannot exceed 100 characters")
    .trim(),
  schoolEmail: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  schoolContactNumber: z
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

  // School Characteristics
  curriculum: z
    .array(
      z.enum(
        [
          "British Curriculum",
          "American Curriculum",
          "IB (International Baccalaureate)",
          "Canadian Curriculum",
          "Australian Curriculum",
          "National Curriculum",
          "Montessori",
          "Waldorf",
          "Reggio Emilia",
          "Other",
        ],
        {
          errorMap: () => ({ message: "Invalid curriculum type" }),
        }
      )
    )
    .min(1, "At least one curriculum is required")
    .max(5, "Cannot exceed 5 curricula"),
  schoolSize: z.enum(
    [
      "Small (1-500 students)",
      "Medium (501-1000 students)",
      "Large (1001+ students)",
    ],
    {
      errorMap: () => ({
        message:
          "School size must be one of: Small (1-500 students), Medium (501-1000 students), Large (1001+ students)",
      }),
    }
  ),
  schoolType: z.enum(
    ["Public", "Private", "International", "Charter", "Religious", "Other"],
    {
      errorMap: () => ({
        message:
          "School type must be one of: Public, Private, International, Charter, Religious, Other",
      }),
    }
  ),
  genderType: z.enum(["Boys Only", "Girls Only", "Mixed"], {
    errorMap: () => ({
      message: "Gender type must be one of: Boys Only, Girls Only, Mixed",
    }),
  }),
  ageGroups: z
    .array(
      z.enum(
        [
          "Early Years (2-5 years)",
          "Primary (6-11 years)",
          "Secondary (12-16 years)",
          "Sixth Form/High School (17-18 years)",
          "All Ages",
        ],
        {
          errorMap: () => ({ message: "Invalid age group" }),
        }
      )
    )
    .min(1, "At least one age group is required")
    .max(5, "Cannot exceed 5 age groups"),

  // Online Presence
  website: z
    .string()
    .url("Please enter a valid website URL")
    .optional()
    .nullable(),

  // About School
  aboutSchool: z
    .string()
    .min(50, "About school must be at least 50 words")
    .max(250, "About school cannot exceed 250 words")
    .trim()
    .refine(
      (val) => {
        const wordCount = val.trim().split(/\s+/).length;
        return wordCount >= 50 && wordCount <= 250;
      },
      {
        message: "About school must be between 50 and 250 words",
      }
    ),

  // Additional Information
  foundedYear: z
    .number()
    .int("Founded year must be a whole number")
    .min(1800, "Founded year cannot be before 1800")
    .max(new Date().getFullYear(), "Founded year cannot be in the future")
    .optional(),
  accreditation: z
    .array(z.string().trim())
    .max(10, "Cannot exceed 10 accreditations")
    .optional(),
  facilities: z
    .array(z.string().trim())
    .max(20, "Cannot exceed 20 facilities")
    .optional(),
  extracurricularActivities: z
    .array(z.string().trim())
    .max(15, "Cannot exceed 15 extracurricular activities")
    .optional(),

  // Contact Person
  contactPerson: z
    .object({
      name: z
        .string()
        .min(2, "Contact person name must be at least 2 characters long")
        .trim(),
      position: z
        .string()
        .min(2, "Contact person position must be at least 2 characters long")
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
    .optional(),

  // School Documents
  schoolLogo: z.string().url("Please enter a valid URL").optional().nullable(),
  schoolPhotos: z
    .array(z.string().url("Please enter a valid URL"))
    .max(10, "Cannot exceed 10 school photos")
    .optional(),
  prospectus: z.string().url("Please enter a valid URL").optional().nullable(),

  // School Statistics
  studentCount: z
    .number()
    .int("Student count must be a whole number")
    .min(0, "Student count cannot be negative")
    .optional(),
  teacherCount: z
    .number()
    .int("Teacher count must be a whole number")
    .min(0, "Teacher count cannot be negative")
    .optional(),
  classSize: z
    .object({
      average: z
        .number()
        .min(1, "Average class size must be at least 1")
        .optional(),
      max: z
        .number()
        .min(1, "Maximum class size must be at least 1")
        .optional(),
    })
    .optional(),

  // School Hours
  schoolHours: z
    .object({
      start: z
        .string()
        .regex(
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Please enter a valid time in HH:MM format"
        )
        .optional(),
      end: z
        .string()
        .regex(
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Please enter a valid time in HH:MM format"
        )
        .optional(),
    })
    .optional(),

  // Academic Information
  academicYear: z
    .object({
      start: z
        .enum(
          [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ],
          {
            errorMap: () => ({ message: "Please enter a valid month" }),
          }
        )
        .optional(),
      end: z
        .enum(
          [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ],
          {
            errorMap: () => ({ message: "Please enter a valid month" }),
          }
        )
        .optional(),
    })
    .optional(),
  applicationDeadline: z.string().datetime().optional(),
  interviewRequired: z.boolean().default(false),
  entranceExam: z.boolean().default(false),
});

// School profile update validation schema
const updateSchoolProfileSchema = z.object({
  // School Information
  schoolName: z
    .string()
    .min(2, "School name must be at least 2 characters long")
    .max(100, "School name cannot exceed 100 characters")
    .trim()
    .optional(),
  schoolEmail: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim()
    .optional(),
  schoolContactNumber: z
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

  // School Characteristics
  curriculum: z
    .array(
      z.enum(
        [
          "British Curriculum",
          "American Curriculum",
          "IB (International Baccalaureate)",
          "Canadian Curriculum",
          "Australian Curriculum",
          "National Curriculum",
          "Montessori",
          "Waldorf",
          "Reggio Emilia",
          "Other",
        ],
        {
          errorMap: () => ({ message: "Invalid curriculum type" }),
        }
      )
    )
    .min(1, "At least one curriculum is required")
    .max(5, "Cannot exceed 5 curricula")
    .optional(),
  schoolSize: z
    .enum(
      [
        "Small (1-500 students)",
        "Medium (501-1000 students)",
        "Large (1001+ students)",
      ],
      {
        errorMap: () => ({
          message:
            "School size must be one of: Small (1-500 students), Medium (501-1000 students), Large (1001+ students)",
        }),
      }
    )
    .optional(),
  schoolType: z
    .enum(
      ["Public", "Private", "International", "Charter", "Religious", "Other"],
      {
        errorMap: () => ({
          message:
            "School type must be one of: Public, Private, International, Charter, Religious, Other",
        }),
      }
    )
    .optional(),
  genderType: z
    .enum(["Boys Only", "Girls Only", "Mixed"], {
      errorMap: () => ({
        message: "Gender type must be one of: Boys Only, Girls Only, Mixed",
      }),
    })
    .optional(),
  ageGroups: z
    .array(
      z.enum(
        [
          "Early Years (2-5 years)",
          "Primary (6-11 years)",
          "Secondary (12-16 years)",
          "Sixth Form/High School (17-18 years)",
          "All Ages",
        ],
        {
          errorMap: () => ({ message: "Invalid age group" }),
        }
      )
    )
    .min(1, "At least one age group is required")
    .max(5, "Cannot exceed 5 age groups")
    .optional(),

  // Online Presence
  website: z
    .string()
    .url("Please enter a valid website URL")
    .optional()
    .nullable(),

  // About School
  aboutSchool: z
    .string()
    .min(50, "About school must be at least 50 words")
    .max(250, "About school cannot exceed 250 words")
    .trim()
    .refine(
      (val) => {
        const wordCount = val.trim().split(/\s+/).length;
        return wordCount >= 50 && wordCount <= 250;
      },
      {
        message: "About school must be between 50 and 250 words",
      }
    )
    .optional(),

  // Additional Information
  foundedYear: z
    .number()
    .int("Founded year must be a whole number")
    .min(1800, "Founded year cannot be before 1800")
    .max(new Date().getFullYear(), "Founded year cannot be in the future")
    .optional(),
  accreditation: z
    .array(z.string().trim())
    .max(10, "Cannot exceed 10 accreditations")
    .optional(),
  facilities: z
    .array(z.string().trim())
    .max(20, "Cannot exceed 20 facilities")
    .optional(),
  extracurricularActivities: z
    .array(z.string().trim())
    .max(15, "Cannot exceed 15 extracurricular activities")
    .optional(),

  // Contact Person
  contactPerson: z
    .object({
      name: z
        .string()
        .min(2, "Contact person name must be at least 2 characters long")
        .trim(),
      position: z
        .string()
        .min(2, "Contact person position must be at least 2 characters long")
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
    .optional(),

  // School Documents
  schoolLogo: z.string().url("Please enter a valid URL").optional().nullable(),
  schoolPhotos: z
    .array(z.string().url("Please enter a valid URL"))
    .max(10, "Cannot exceed 10 school photos")
    .optional(),
  prospectus: z.string().url("Please enter a valid URL").optional().nullable(),

  // School Statistics
  studentCount: z
    .number()
    .int("Student count must be a whole number")
    .min(0, "Student count cannot be negative")
    .optional(),
  teacherCount: z
    .number()
    .int("Teacher count must be a whole number")
    .min(0, "Teacher count cannot be negative")
    .optional(),
  classSize: z
    .object({
      average: z
        .number()
        .min(1, "Average class size must be at least 1")
        .optional(),
      max: z
        .number()
        .min(1, "Maximum class size must be at least 1")
        .optional(),
    })
    .optional(),

  // School Hours
  schoolHours: z
    .object({
      start: z
        .string()
        .regex(
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Please enter a valid time in HH:MM format"
        )
        .optional(),
      end: z
        .string()
        .regex(
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Please enter a valid time in HH:MM format"
        )
        .optional(),
    })
    .optional(),

  // Academic Information
  academicYear: z
    .object({
      start: z
        .enum(
          [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ],
          {
            errorMap: () => ({ message: "Please enter a valid month" }),
          }
        )
        .optional(),
      end: z
        .enum(
          [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ],
          {
            errorMap: () => ({ message: "Please enter a valid month" }),
          }
        )
        .optional(),
    })
    .optional(),
  applicationDeadline: z.string().datetime().optional(),
  interviewRequired: z.boolean().optional(),
  entranceExam: z.boolean().optional(),
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
  createSchoolProfileSchema,
  updateSchoolProfileSchema,
  validateRequest,
};
