const express = require("express");
const {
  getAdminDashboard,
} = require("../controllers/adminDashboardController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/dashboard",
  authenticateToken,
  authorizeRoles(["admin"]),
  getAdminDashboard
);

module.exports = router;
