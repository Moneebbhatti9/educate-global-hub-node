const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {
  createBreach,
  getBreaches,
  getBreach,
  notifyUsers,
  generateReport,
  markReported,
  resolveBreach,
  checkDeadlines,
  runRetentionTasks,
  getRetentionReport,
  getConsentStats,
  getExportStats,
  getDeletionRequests,
  processDeletionRequest,
  getDashboard,
} = require("../controllers/adminGdprController");

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(authorizeRoles("admin"));

/**
 * @swagger
 * /api/v1/admin/gdpr/dashboard:
 *   get:
 *     summary: Get GDPR compliance dashboard
 *     tags: [Admin GDPR]
 *     security:
 *       - bearerAuth: []
 */
router.get("/dashboard", getDashboard);

// ==================== Breach Management ====================

/**
 * @swagger
 * /api/v1/admin/gdpr/breaches:
 *   get:
 *     summary: Get all breach notifications
 *     tags: [Admin GDPR]
 *   post:
 *     summary: Create new breach notification
 *     tags: [Admin GDPR]
 */
router.get("/breaches", getBreaches);
router.post("/breaches", createBreach);

/**
 * @swagger
 * /api/v1/admin/gdpr/breaches/deadline-alerts:
 *   get:
 *     summary: Check for breaches approaching 72-hour deadline
 *     tags: [Admin GDPR]
 */
router.get("/breaches/deadline-alerts", checkDeadlines);

/**
 * @swagger
 * /api/v1/admin/gdpr/breaches/:breachId:
 *   get:
 *     summary: Get breach by ID
 *     tags: [Admin GDPR]
 */
router.get("/breaches/:breachId", getBreach);

/**
 * @swagger
 * /api/v1/admin/gdpr/breaches/:breachId/notify:
 *   post:
 *     summary: Send notifications to affected users
 *     tags: [Admin GDPR]
 */
router.post("/breaches/:breachId/notify", notifyUsers);

/**
 * @swagger
 * /api/v1/admin/gdpr/breaches/:breachId/report:
 *   get:
 *     summary: Generate supervisory authority report
 *     tags: [Admin GDPR]
 */
router.get("/breaches/:breachId/report", generateReport);

/**
 * @swagger
 * /api/v1/admin/gdpr/breaches/:breachId/mark-reported:
 *   post:
 *     summary: Mark breach as reported to supervisory authority
 *     tags: [Admin GDPR]
 */
router.post("/breaches/:breachId/mark-reported", markReported);

/**
 * @swagger
 * /api/v1/admin/gdpr/breaches/:breachId/resolve:
 *   post:
 *     summary: Resolve a breach
 *     tags: [Admin GDPR]
 */
router.post("/breaches/:breachId/resolve", resolveBreach);

// ==================== Data Retention ====================

/**
 * @swagger
 * /api/v1/admin/gdpr/retention/report:
 *   get:
 *     summary: Get data retention report
 *     tags: [Admin GDPR]
 */
router.get("/retention/report", getRetentionReport);

/**
 * @swagger
 * /api/v1/admin/gdpr/retention/run:
 *   post:
 *     summary: Run data retention tasks
 *     tags: [Admin GDPR]
 */
router.post("/retention/run", runRetentionTasks);

// ==================== Consent Management ====================

/**
 * @swagger
 * /api/v1/admin/gdpr/consent/stats:
 *   get:
 *     summary: Get consent statistics
 *     tags: [Admin GDPR]
 */
router.get("/consent/stats", getConsentStats);

// ==================== Export Management ====================

/**
 * @swagger
 * /api/v1/admin/gdpr/exports/stats:
 *   get:
 *     summary: Get export request statistics
 *     tags: [Admin GDPR]
 */
router.get("/exports/stats", getExportStats);

// ==================== Deletion Requests ====================

/**
 * @swagger
 * /api/v1/admin/gdpr/deletion-requests:
 *   get:
 *     summary: Get pending deletion requests
 *     tags: [Admin GDPR]
 */
router.get("/deletion-requests", getDeletionRequests);

/**
 * @swagger
 * /api/v1/admin/gdpr/deletion-requests/:userId/process:
 *   post:
 *     summary: Process deletion request immediately
 *     tags: [Admin GDPR]
 */
router.post("/deletion-requests/:userId/process", processDeletionRequest);

module.exports = router;
