const express = require("express");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const { validateFileUpload } = require("../middleware/validation");
const {
  uploadAvatar: uploadAvatarController,
  uploadDocument: uploadDocumentController,
  deleteFile,
  getUploadPreset,
} = require("../controllers/uploadController");
const { verifyCredentials } = require("../config/cloudinary");

const router = express.Router();

// Configure multer for avatar uploads (images only, max 5MB)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `File type not allowed. Allowed types: ${allowedTypes.join(", ")}`
        ),
        false
      );
    }
  },
});

// Configure multer for document uploads (documents and images, max 500MB)
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `File type not allowed. Allowed types: PDF, DOCX, PPTX, XLSX, ZIP, images`
        ),
        false
      );
    }
  },
});

// @route   POST /api/v1/upload/avatar
// @desc    Upload user avatar
// @access  Private
router.post(
  "/avatar",
  authenticateToken,
  avatarUpload.single("avatar"),
  validateFileUpload,
  uploadAvatarController
);

// @route   POST /api/v1/upload/document
// @desc    Upload document (PDFs, DOCX, images, etc.)
// @access  Private
router.post(
  "/document",
  authenticateToken,
  documentUpload.single("document"),
  validateFileUpload,
  uploadDocumentController
);

// @route   DELETE /api/v1/upload/:publicId
// @desc    Delete file from Cloudinary
// @access  Private
router.delete("/:publicId", authenticateToken, deleteFile);

// @route   GET /api/v1/upload/preset
// @desc    Get upload preset for client-side uploads
// @access  Private
router.get("/preset", authenticateToken, getUploadPreset);

// @route   GET /api/v1/upload/verify-cloudinary
// @desc    Verify Cloudinary credentials are working
// @access  Private (Admin only in production)
router.get("/verify-cloudinary", authenticateToken, async (req, res) => {
  try {
    const result = await verifyCredentials();
    if (result.success) {
      return res.json({
        success: true,
        message: "Cloudinary credentials are valid",
        data: result,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Cloudinary credentials verification failed",
        error: result.error,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying Cloudinary credentials",
      error: error.message,
    });
  }
});

module.exports = router;
