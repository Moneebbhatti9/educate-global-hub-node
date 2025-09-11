const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  createOrUpdateTeacherProfile,
  updateTeacherProfile,
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
  listCertifications,
  addCertification,
  updateCertification,
  deleteCertification,
  listDevelopment,
  addDevelopment,
  updateDevelopment,
  deleteDevelopment,
  listMemberships,
  addMembership,
  updateMembership,
  deleteMembership,
  addDependent,
  getDependents,
  updateDependent,
  deleteDependent,
  addActivity,
  getActivities,
  updateActivity,
  deleteActivity,
} = require("../controllers/teacherProfileController");

// Create or update teacher profile (requires authentication)
router.post(
  "/",
  authenticateToken,
  validate("teacherProfile"),
  createOrUpdateTeacherProfile
);

// Update teacher profile (PATCH method for partial updates)
router.patch("/updateTeacherProfile", authenticateToken, updateTeacherProfile);

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

// === Professional Certifications (me)
router.get("/me/certifications", authenticateToken, listCertifications);
router.post("/me/certifications", authenticateToken, addCertification);
router.patch("/me/certifications/:id", authenticateToken, updateCertification);
router.delete("/me/certifications/:id", authenticateToken, deleteCertification);

// === Professional Development (me)
router.get("/me/development", authenticateToken, listDevelopment);
router.post("/me/development", authenticateToken, addDevelopment);
router.patch("/me/development/:id", authenticateToken, updateDevelopment);
router.delete("/me/development/:id", authenticateToken, deleteDevelopment);

// === Professional Memberships (me)
router.get("/me/memberships", authenticateToken, listMemberships);
router.post("/me/memberships", authenticateToken, addMembership);
router.patch("/me/memberships/:id", authenticateToken, updateMembership);
router.delete("/me/memberships/:id", authenticateToken, deleteMembership);

router.post("/me/dependents", authenticateToken, addDependent);
router.get("/me/dependents", authenticateToken, getDependents);
router.put("/me/dependents/:id", authenticateToken, updateDependent);
router.delete("/me/dependents/:id", authenticateToken, deleteDependent);

// Activities
router.post("/me/activities", authenticateToken, addActivity);
router.get("/me/activities", authenticateToken, getActivities);
router.put("/me/activities/:id", authenticateToken, updateActivity);
router.delete("/me/activities/:id", authenticateToken, deleteActivity);

module.exports = router;
