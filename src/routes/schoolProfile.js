const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createOrUpdateSchoolProfile,
  getSchoolProfile,
  getSchoolProfileById,
  searchSchools,
} = require("../controllers/schoolProfileController");

// Create or update school profile (requires authentication)
router.post(
  "/",
  authenticateToken,
  validate("schoolProfile"),
  createOrUpdateSchoolProfile
);

// Get current user's school profile (requires authentication)
router.get("/me", authenticateToken, getSchoolProfile);

// Get school profile by ID (public route)
router.get("/:schoolId", getSchoolProfileById);

// Search schools (public route)
router.get("/search", searchSchools);

module.exports = router;
