const express = require("express");
const {
  getAdminDashboard,
} = require("../controllers/adminDashboardController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {
  getAllResourcesAdmin,
  getResourceStatsAdmin,
} = require("../controllers/resourceController");

const router = express.Router();

router.get(
  "/dashboard",
  authenticateToken,
  authorizeRoles(["admin"]),
  getAdminDashboard
);

//  Admin Routes
router.get(
  "/admin-resources",
  authenticateToken,
  authorizeRoles(["admin"]),
  getAllResourcesAdmin
);

router.get(
  "/admin-resources/stats",
  authenticateToken,
  authorizeRoles(["admin"]),
  getResourceStatsAdmin
);

module.exports = router;
