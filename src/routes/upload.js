const express = require("express");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");
const { validateFileUpload } = require("../middleware/validation");
const {
  uploadAvatar,
  uploadDocument,
  deleteFile,
  getUploadPreset,
} = require("../controllers/uploadController");

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(",") || [
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

// @route   POST /api/v1/upload/avatar
// @desc    Upload user avatar
// @access  Private
router.post(
  "/avatar",
  authenticateToken,
  upload.single("avatar"),
  validateFileUpload,
  uploadAvatar
);

// @route   POST /api/v1/upload/document
// @desc    Upload document
// @access  Private
router.post(
  "/document",
  authenticateToken,
  upload.single("document"),
  validateFileUpload,
  uploadDocument
);

// @route   DELETE /api/v1/upload/:publicId
// @desc    Delete file from Cloudinary
// @access  Private
router.delete("/:publicId", authenticateToken, deleteFile);

// @route   GET /api/v1/upload/preset
// @desc    Get upload preset for client-side uploads
// @access  Private
router.get("/preset", authenticateToken, getUploadPreset);

module.exports = router;
