const express = require("express");
const {
  getAdminDashboard,
} = require("../controllers/adminDashboardController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const {
  getAllResourcesAdmin,
  getResourceStatsAdmin,
} = require("../controllers/resourceController");
const {
  getRevenueOverview,
  getTimeSeries,
  getSubscriptionMetrics,
  getRecentTransactions,
  getRevenueBreakdown,
  getPerSchoolRevenue,
  getCreatorEarnings,
} = require("../controllers/financialController");
const {
  exportCSV,
  exportPDF,
} = require("../controllers/financialExportController");

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

// ==================== FINANCIAL DASHBOARD ====================
router.get("/financial/overview", authenticateToken, authorizeRoles(["admin"]), getRevenueOverview);
router.get("/financial/time-series", authenticateToken, authorizeRoles(["admin"]), getTimeSeries);
router.get("/financial/subscription-metrics", authenticateToken, authorizeRoles(["admin"]), getSubscriptionMetrics);
router.get("/financial/recent-transactions", authenticateToken, authorizeRoles(["admin"]), getRecentTransactions);
router.get("/financial/breakdown", authenticateToken, authorizeRoles(["admin"]), getRevenueBreakdown);
router.get("/financial/per-school", authenticateToken, authorizeRoles(["admin"]), getPerSchoolRevenue);
router.get("/financial/creator-earnings", authenticateToken, authorizeRoles(["admin"]), getCreatorEarnings);
router.get("/financial/export/csv", authenticateToken, authorizeRoles(["admin"]), exportCSV);
router.get("/financial/export/pdf", authenticateToken, authorizeRoles(["admin"]), exportPDF);

module.exports = router;
