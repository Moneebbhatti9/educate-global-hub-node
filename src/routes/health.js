const express = require("express");
const router = express.Router();
const healthController = require("../controllers/healthController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// All health routes require admin authentication
router.get(
  "/status",
  authenticateToken,
  authorizeRoles(["admin"]),
  healthController.getSystemHealth
);

router.get(
  "/feature-flags",
  authenticateToken,
  authorizeRoles(["admin"]),
  healthController.getFeatureFlags
);

router.get(
  "/data-consistency",
  authenticateToken,
  authorizeRoles(["admin"]),
  healthController.getDataConsistency
);

module.exports = router;
