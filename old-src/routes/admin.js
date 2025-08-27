const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {
  validateAdminUserCreation,
  validateAdminUserUpdate,
  validateUserStatusChange,
} = require("../middleware/adminValidation");
const {
  validateJobStatusUpdate,
  validateJobDeletion,
  validateBulkStatusUpdate,
  validateJobQueryParams,
  validateExportQueryParams,
  validateJobApplicationsQueryParams,
  validateAnalyticsQueryParams,
} = require("../middleware/adminJobValidation");

// Apply admin authentication middleware to all routes
router.use(authenticateToken);
router.use(authorizeRoles(["admin"]));

// Get all users with pagination, search, and filters
router.get("/allUsers", adminController.getAllUsers);

// Get user by ID
router.get("/users/:id", adminController.getUserById);

// Create new user
router.post(
  "/add-users",
  validateAdminUserCreation,
  adminController.createUser
);

// Update user
router.put(
  "/update-users/:id",
  validateAdminUserUpdate,
  adminController.updateUser
);

// Delete user
router.delete("/delete-users/:id", adminController.deleteUser);

// Change user status
router.patch(
  "/users/:id/status",
  validateUserStatusChange,
  adminController.changeUserStatus
);

// Get user profile details
router.get("/users/:id/profile", adminController.getUserProfile);

// Update user profile
router.put("/users/:id/profile", adminController.updateUserProfile);

// Export users
router.get(
  "/users/export",
  authenticateToken,
  authorizeRoles(["admin"]),
  adminController.exportUsers
);

// Get recently active users
router.get(
  "/users/recently-active",
  authenticateToken,
  authorizeRoles(["admin"]),
  adminController.getRecentlyActiveUsers
);

// ==================== JOB MANAGEMENT ROUTES ====================

// Get all jobs with pagination, search, and filters
router.get("/jobs", validateJobQueryParams, adminController.getAllJobs);

// Get job statistics
router.get("/jobs/statistics", adminController.getJobStatistics);

// Get job by ID
router.get("/jobs/:id", adminController.getJobById);

// Update job status
router.patch(
  "/jobs/:id/status",
  validateJobStatusUpdate,
  adminController.updateJobStatus
);

// Delete job
router.delete("/jobs/:id", validateJobDeletion, adminController.deleteJob);

// Export jobs
router.get(
  "/jobs/export",
  validateExportQueryParams,
  adminController.exportJobs
);

// Get job applications
router.get(
  "/jobs/:jobId/applications",
  validateJobApplicationsQueryParams,
  adminController.getJobApplications
);

// Bulk update job statuses
router.patch(
  "/jobs/bulk-status",
  validateBulkStatusUpdate,
  adminController.bulkUpdateJobStatuses
);

// Get job analytics
router.get(
  "/jobs/analytics",
  validateAnalyticsQueryParams,
  adminController.getJobAnalytics
);

module.exports = router;
