const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createOrUpdateTeacherProfile,
  getTeacherProfile,
  getTeacherProfileById,
  searchTeachers,
  getRecommendedJobs,
  addEmployment,
  updateEmployment,
  deleteEmployment,
  addEducation,
  updateEducation,
  deleteEducation,
  addQualification,
  updateQualification,
  deleteQualification,
  addReferee,
  updateReferee,
  deleteReferee,
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

// Get recommended jobs for teacher (requires authentication)
router.get("/me/recommended-jobs", authenticateToken, getRecommendedJobs);

router.post("/me/employment", authenticateToken, addEmployment);
router.put("/me/employment/:employmentId", authenticateToken, updateEmployment);
router.delete(
  "/me/employment/:employmentId",
  authenticateToken,
  deleteEmployment
);

// Education
router.post("/me/education", authenticateToken, addEducation);
router.put("/me/education/:educationId", authenticateToken, updateEducation);
router.delete("/me/education/:educationId", authenticateToken, deleteEducation);

// Qualifications
router.post("/me/qualifications", authenticateToken, addQualification);
router.put(
  "/me/qualifications/:qualificationId",
  authenticateToken,
  updateQualification
);
router.delete(
  "/me/qualifications/:qualificationId",
  authenticateToken,
  deleteQualification
);

// Referees
router.post("/me/referees", authenticateToken, addReferee);
router.put("/me/referees/:refereeId", authenticateToken, updateReferee);
router.delete("/me/referees/:refereeId", authenticateToken, deleteReferee);

module.exports = router;
