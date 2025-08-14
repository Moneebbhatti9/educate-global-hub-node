const express = require("express");
const router = express.Router();
const JobController = require("../controllers/jobController");
const ApplicationController = require("../controllers/applicationController");
const SavedJobController = require("../controllers/savedJobController");
const {
  validateJob,
  validateJobQuery,
} = require("../middleware/jobValidation");
const {
  authenticateToken: authenticate,
  authorizeRoles: authorize,
  optionalAuth,
} = require("../middleware/auth");

// Job Management Routes (School only)
router.post(
  "/",
  authenticate,
  authorize(["school"]),
  validateJob("createJob"),
  JobController.createJob
);

router.get(
  "/school/:schoolId",
  authenticate,
  authorize(["school"]),
  validateJobQuery("pagination"),
  JobController.getJobsBySchool
);

router.put(
  "/:jobId",
  authenticate,
  authorize(["school"]),
  validateJob("updateJob"),
  JobController.updateJob
);

router.delete(
  "/:jobId",
  authenticate,
  authorize(["school"]),
  JobController.deleteJob
);

router.patch(
  "/:jobId/status",
  authenticate,
  authorize(["school"]),
  validateJob("updateJobStatus"),
  JobController.updateJobStatus
);

router.patch(
  "/:jobId/flags",
  authenticate,
  authorize(["school"]),
  validateJob("updateJobFlags"),
  JobController.updateJobFlags
);

// Application Routes - Specific routes must come BEFORE parameterized routes
router.get(
  "/applications/stats",
  authenticate,
  ApplicationController.getApplicationStats
);

router.get(
  "/applications/recent",
  authenticate,
  ApplicationController.getRecentApplications
);

router.get(
  "/applications/overdue",
  authenticate,
  authorize(["school"]),
  ApplicationController.getOverdueApplications
);

router.patch(
  "/applications/bulk/status",
  authenticate,
  authorize(["school"]),
  ApplicationController.bulkUpdateApplicationStatuses
);

// Now the parameterized routes
router.get(
  "/:jobId/applications",
  authenticate,
  authorize(["school"]),
  validateJobQuery("pagination"),
  JobController.getJobApplications
);

router.get(
  "/:jobId/analytics",
  authenticate,
  authorize(["school"]),
  JobController.getJobAnalytics
);

router.get(
  "/:jobId/export",
  authenticate,
  authorize(["school"]),
  JobController.exportJobs
);

// Job Search & Viewing Routes (Public)
router.get("/search", validateJobQuery("searchJobs"), JobController.searchJobs);

router.get("/featured", JobController.getFeaturedJobs);

router.get("/urgent", JobController.getUrgentJobs);

router.get("/category/:category", JobController.getJobsByCategory);

router.get("/location/:country/:city", JobController.getJobsByLocation);

// Public Job Detail Route - Must be after other specific routes
// Optional authentication for enhanced features (saved status, application status)
router.get("/:jobId", optionalAuth, JobController.getJobById);

// Job Recommendations (Teacher only)
router.get(
  "/recommendations",
  authenticate,
  authorize(["teacher"]),
  JobController.getJobRecommendations
);

// School Dashboard Routes (School only)
router.get(
  "/dashboard/school/:schoolId",
  authenticate,
  authorize(["school"]),
  JobController.getSchoolDashboardStats
);

router.get(
  "/dashboard/stats",
  authenticate,
  authorize(["school"]),
  JobController.getJobStatistics
);

// Bulk Operations (School only)
router.patch(
  "/bulk/status",
  authenticate,
  authorize(["school"]),
  validateJob("updateJobStatus"),
  JobController.bulkUpdateJobStatuses
);

// Application Routes - Parameterized routes
router.post(
  "/:jobId/apply",
  authenticate,
  authorize(["teacher"]),
  validateJob("createApplication"),
  ApplicationController.submitApplication
);

router.get(
  "/applications/:applicationId",
  authenticate,
  ApplicationController.getApplicationById
);

router.patch(
  "/applications/:applicationId/status",
  authenticate,
  authorize(["school"]),
  validateJob("updateApplicationStatus"),
  ApplicationController.updateApplicationStatus
);

router.post(
  "/applications/:applicationId/withdraw",
  authenticate,
  authorize(["teacher"]),
  ApplicationController.withdrawApplication
);

router.get(
  "/applications/teacher/:teacherId",
  authenticate,
  authorize(["school"]),
  ApplicationController.getApplicationsByTeacher
);

// Application Status Specific Routes
router.post(
  "/applications/:applicationId/interview",
  authenticate,
  authorize(["school"]),
  ApplicationController.scheduleInterview
);

router.post(
  "/applications/:applicationId/accept",
  authenticate,
  authorize(["school"]),
  ApplicationController.acceptApplication
);

router.post(
  "/applications/:applicationId/reject",
  authenticate,
  authorize(["school"]),
  ApplicationController.rejectApplication
);

router.post(
  "/applications/:applicationId/shortlist",
  authenticate,
  authorize(["school"]),
  ApplicationController.shortlistApplication
);

router.post(
  "/applications/:applicationId/reviewing",
  authenticate,
  authorize(["school"]),
  ApplicationController.moveToReviewing
);

router.get(
  "/applications/:applicationId/timeline",
  authenticate,
  ApplicationController.getApplicationTimeline
);

router.get(
  "/applications/:jobId/export",
  authenticate,
  authorize(["school"]),
  ApplicationController.exportApplications
);

// Saved Jobs Routes (Teacher only)
router.post(
  "/:jobId/save",
  authenticate,
  authorize(["teacher"]),
  validateJob("saveJob"),
  SavedJobController.saveJob
);

router.get(
  "/saved",
  authenticate,
  authorize(["teacher"]),
  SavedJobController.getSavedJobs
);

router.get(
  "/saved/:savedJobId",
  authenticate,
  authorize(["teacher"]),
  SavedJobController.getSavedJobById
);

router.put(
  "/saved/:savedJobId",
  authenticate,
  authorize(["teacher"]),
  validateJob("updateSavedJob"),
  SavedJobController.updateSavedJob
);

router.delete(
  "/saved/:savedJobId",
  authenticate,
  authorize(["teacher"]),
  SavedJobController.removeSavedJob
);

router.get(
  "/:jobId/saved",
  authenticate,
  authorize(["teacher"]),
  SavedJobController.isJobSaved
);

router.get(
  "/saved/stats",
  authenticate,
  authorize(["teacher"]),
  SavedJobController.getSavedJobStats
);

module.exports = router;
