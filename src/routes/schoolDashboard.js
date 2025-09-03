const express = require("express");
const router = express.Router();
const {
  getSchoolDashboard,
} = require("../controllers/schoolDashboardController");
const { authenticateToken } = require("../middleware/auth");

// Protected route (school must be logged in)
router.get("/dashboardCards", authenticateToken, getSchoolDashboard);

module.exports = router;
