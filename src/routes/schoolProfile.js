const express = require("express");
const multer = require("multer");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createOrUpdateSchoolProfile,
  updateSchoolProfile,
  getSchoolProfile,
  getSchoolProfileById,
  searchSchools,
  addProgram,
  listMyPrograms,
  updateProgram,
  deleteProgram,
  listProgramsBySchoolId,
  addSchoolMedia,
  getSchoolMedia,
  deleteSchoolMedia,
} = require("../controllers/schoolProfileController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WEBP images allowed"), false);
  },
});

// Create or update school profile (requires authentication)
router.post(
  "/",
  authenticateToken,
  validate("schoolProfile"),
  createOrUpdateSchoolProfile
);

// Update school profile (PATCH method for partial updates)
router.patch("/updateSchoolProfile", authenticateToken, updateSchoolProfile);

// Get current user's school profile (requires authentication)
router.get("/me", authenticateToken, getSchoolProfile);

// Get school profile by ID (public route)
router.get("/:schoolId", getSchoolProfileById);

// Search schools (public route)
router.get("/search", searchSchools);

router.get("/me/programs", authenticateToken, listMyPrograms);
router.post("/programs", authenticateToken, addProgram);
router.put("/programs/:id", authenticateToken, updateProgram);
router.delete("/programs/:id", authenticateToken, deleteProgram);
router.get("/:schoolId/programs", listProgramsBySchoolId);

// Upload media for a school
router.post(
  "/media",
  authenticateToken,
  upload.array("files", 5), // allow multiple (max 5 per request)
  addSchoolMedia
);

// Get all media for a school
router.get("/:schoolId", getSchoolMedia);

// Delete a media file
router.delete("/:mediaId", authenticateToken, deleteSchoolMedia);
module.exports = router;
