const express = require("express");
const router = express.Router();

// Import controller
const teacherController = require("../controllers/teacher.controller");

// Import validation schemas and middleware
const {
  createTeacherProfileSchema,
  updateTeacherProfileSchema,
  validateRequest,
} = require("../validations/teacher.validation");

// Import authentication middleware
const {
  authenticateToken,
  requireEmailVerification,
  requireAdminApproval,
  requireFullAuth,
} = require("../../../middlewares/authMiddleware");

// Import role middleware
const { requireRole } = require("../../../middlewares/roleMiddleware");

// Create teacher profile
router.post(
  "/createTeacherProfile",
  validateRequest(createTeacherProfileSchema),
  teacherController.createTeacherProfile
);

// Update teacher profile
router.patch(
  "/updateTeacherProfile",
  authenticateToken,
  requireRole("teacher"),
  validateRequest(updateTeacherProfileSchema),
  teacherController.updateTeacherProfile
);

// Get teacher profile
router.get(
  "/getTeacherProfile",
  authenticateToken,
  requireRole("teacher"),
  teacherController.getTeacherProfile
);

// Get teacher profile by email
router.get(
  "/getTeacherProfileByEmail/:email",
  teacherController.getTeacherProfileByEmail
);

// Search teachers
router.get("/searchTeachers", teacherController.searchTeachers);

// Get all complete profiles
router.get("/getAllCompleteProfiles", teacherController.getAllCompleteProfiles);

// Delete teacher profile
router.delete(
  "/deleteTeacherProfile",
  authenticateToken,
  requireRole("teacher"),
  teacherController.deleteTeacherProfile
);

// Check profile completion
router.get(
  "/checkProfileCompletion",
  authenticateToken,
  requireRole("teacher"),
  teacherController.checkProfileCompletion
);

// Get profile statistics (Admin only)
router.get(
  "/getProfileStatistics",
  requireFullAuth,
  requireRole("admin"),
  teacherController.getProfileStatistics
);

module.exports = router;
