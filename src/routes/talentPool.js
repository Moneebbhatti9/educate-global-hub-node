const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  optIn,
  optOut,
  getConsentStatus,
  updateAvailability,
  searchTalentPool,
} = require("../controllers/talentPoolController");

// Consent management
router.post("/opt-in", authenticateToken, optIn);
router.post("/opt-out", authenticateToken, optOut);
router.get("/consent-status", authenticateToken, getConsentStatus);

// Availability
router.patch("/availability", authenticateToken, updateAvailability);

// Search
router.get("/search", authenticateToken, searchTalentPool);

module.exports = router;
