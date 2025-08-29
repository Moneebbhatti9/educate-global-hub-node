const express = require("express");
const router = express.Router();

// Import controller
const schoolController = require("../controllers/school.controller");

// Import validation schemas and middleware
const {
  createSchoolProfileSchema,
  updateSchoolProfileSchema,
  validateRequest,
} = require("../validations/school.validation");

// Import authentication middleware
const {
  authenticateToken,
  requireEmailVerification,
  requireAdminApproval,
  requireFullAuth,
} = require("../../../middlewares/authMiddleware");

// Import role middleware
const { requireRole } = require("../../../middlewares/roleMiddleware");

// Create school profile
router.post(
  "/createSchoolProfile",
  validateRequest(createSchoolProfileSchema),
  schoolController.createSchoolProfile
);

// Update school profile
router.patch(
  "/updateSchoolProfile",
  authenticateToken,
  requireRole("school"),
  validateRequest(updateSchoolProfileSchema),
  schoolController.updateSchoolProfile
);

// Get school profile
router.get(
  "/getSchoolProfile",
  authenticateToken,
  requireRole("school"),
  schoolController.getSchoolProfile
);

// Get school profile by email
router.get(
  "/getSchoolProfileByEmail/:email",
  schoolController.getSchoolProfileByEmail
);

// Search schools
router.get("/searchSchools", schoolController.searchSchools);

// Get all complete profiles
router.get("/getAllCompleteProfiles", schoolController.getAllCompleteProfiles);

// Delete school profile
router.delete(
  "/deleteSchoolProfile",
  authenticateToken,
  requireRole("school"),
  schoolController.deleteSchoolProfile
);

// Check profile completion
router.get(
  "/checkProfileCompletion",
  authenticateToken,
  requireRole("school"),
  schoolController.checkProfileCompletion
);

// Get profile statistics (Admin only)
router.get(
  "/getProfileStatistics",
  requireFullAuth,
  requireRole("admin"),
  schoolController.getProfileStatistics
);

// Get schools by curriculum
router.get(
  "/getSchoolsByCurriculum/:curriculum",
  schoolController.getSchoolsByCurriculum
);

// Get schools by location
router.get("/getSchoolsByLocation", schoolController.getSchoolsByLocation);

// Get schools by type
router.get("/getSchoolsByType/:schoolType", schoolController.getSchoolsByType);

module.exports = router;
