const express = require("express");
const router = express.Router();
const {
  getSchoolDashboard,
  getRecentCandidates,
} = require("../controllers/schoolDashboardController");
const { authenticateToken } = require("../middleware/auth");

// Protected route (school must be logged in)
router.get("/dashboardCards", authenticateToken, getSchoolDashboard);
router.get("/getRecentCandidates", authenticateToken, getRecentCandidates);

module.exports = router;
