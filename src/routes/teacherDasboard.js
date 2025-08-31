const express = require("express");
const router = express.Router();
const { getTeacherDashboard } = require("../controllers/teacherDashboardController");
const { authenticateToken } = require("../middleware/auth");
// GET /api/dashboard/teacher/:teacherId
router.get("/dashboard", authenticateToken ,getTeacherDashboard);

module.exports = router;
