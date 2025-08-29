const { z } = require("zod");

// Upload validation schema
const uploadSchema = z.object({
  fileType: z.enum(
    [
      "avatar",
      "document",
      "cv",
      "coverLetter",
      "schoolLogo",
      "schoolPhoto",
      "prospectus",
    ],
    {
      errorMap: () => ({
        message:
          "File type must be one of: avatar, document, cv, coverLetter, schoolLogo, schoolPhoto, prospectus",
      }),
    }
  ),
  description: z
    .string()
    .max(200, "Description cannot exceed 200 characters")
    .optional()
    .nullable(),
});

// Multiple files upload validation schema
const multipleUploadSchema = z.object({
  fileType: z.enum(["documents", "schoolPhotos"], {
    errorMap: () => ({
      message: "File type must be one of: documents, schoolPhotos",
    }),
  }),
  descriptions: z
    .array(z.string().max(200, "Description cannot exceed 200 characters"))
    .optional()
    .nullable(),
});

// Validation middleware function
const validateUploadRequest = (schema) => {
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
  uploadSchema,
  multipleUploadSchema,
  validateUploadRequest,
};
