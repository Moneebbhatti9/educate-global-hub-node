const express = require("express");
const {
  authenticateToken,
  optionalAuth,
  requireEmailVerification,
} = require("../middleware/auth");
const {
  exportUserData,
  requestDataDeletion,
  recordConsent,
  getConsentHistory,
  getExportHistory,
  getBreachNotifications,
  requestDataRectification,
  getGDPRRights,
} = require("../controllers/gdprController");

const router = express.Router();

/**
 * @swagger
 * /api/v1/gdpr/rights:
 *   get:
 *     summary: Get GDPR rights information
 *     tags: [GDPR]
 *     description: Returns information about user rights under GDPR
 *     responses:
 *       200:
 *         description: GDPR rights information
 */
router.get("/rights", getGDPRRights);

/**
 * @swagger
 * /api/v1/gdpr/export-data:
 *   get:
 *     summary: Export all user data (GDPR Article 20)
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     description: Export all personal data for the authenticated user
 *     responses:
 *       200:
 *         description: User data exported successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/export-data",
  authenticateToken,
  requireEmailVerification,
  exportUserData
);

/**
 * @swagger
 * /api/v1/gdpr/request-deletion:
 *   post:
 *     summary: Request account deletion (GDPR Article 17)
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirmEmail
 *             properties:
 *               confirmEmail:
 *                 type: string
 *                 description: Email confirmation
 *               reason:
 *                 type: string
 *                 description: Reason for deletion request
 *     responses:
 *       200:
 *         description: Deletion request submitted
 */
router.post(
  "/request-deletion",
  authenticateToken,
  requireEmailVerification,
  requestDataDeletion
);

/**
 * @swagger
 * /api/v1/gdpr/consent:
 *   post:
 *     summary: Record user consent
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consentType
 *               - granted
 *             properties:
 *               consentType:
 *                 type: string
 *                 enum: [cookies, marketing, data_processing, terms]
 *               granted:
 *                 type: boolean
 *               preferences:
 *                 type: object
 *     responses:
 *       201:
 *         description: Consent recorded successfully
 */
router.post("/consent", optionalAuth, recordConsent);

/**
 * @swagger
 * /api/v1/gdpr/consent-history:
 *   get:
 *     summary: Get user's consent history
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consent history retrieved
 */
router.get(
  "/consent-history",
  authenticateToken,
  requireEmailVerification,
  getConsentHistory
);

/**
 * @swagger
 * /api/v1/gdpr/export-history:
 *   get:
 *     summary: Get data export requests history
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export history retrieved
 */
router.get(
  "/export-history",
  authenticateToken,
  requireEmailVerification,
  getExportHistory
);

/**
 * @swagger
 * /api/v1/gdpr/breach-notifications:
 *   get:
 *     summary: Get breach notifications for user
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Breach notifications retrieved
 */
router.get(
  "/breach-notifications",
  authenticateToken,
  requireEmailVerification,
  getBreachNotifications
);

/**
 * @swagger
 * /api/v1/gdpr/rectification-request:
 *   post:
 *     summary: Request data rectification (GDPR Article 16)
 *     tags: [GDPR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dataField
 *               - correctedValue
 *             properties:
 *               dataField:
 *                 type: string
 *               currentValue:
 *                 type: string
 *               correctedValue:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rectification request submitted
 */
router.post(
  "/rectification-request",
  authenticateToken,
  requireEmailVerification,
  requestDataRectification
);

module.exports = router;
