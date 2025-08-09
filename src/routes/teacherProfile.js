const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createOrUpdateTeacherProfile,
  getTeacherProfile,
  getTeacherProfileById,
  searchTeachers,
} = require("../controllers/teacherProfileController");

// Create or update teacher profile (requires authentication)
router.post(
  "/",
  authenticateToken,
  validate("teacherProfile"),
  createOrUpdateTeacherProfile
);

// Get current user's teacher profile (requires authentication)
router.get("/me", authenticateToken, getTeacherProfile);

// Get teacher profile by ID (public route)
router.get("/:teacherId", getTeacherProfileById);

// Search teachers (public route)
router.get("/search", searchTeachers);

module.exports = router;
