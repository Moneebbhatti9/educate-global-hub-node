const express = require("express");
const router = express.Router();
const adminSettingsController = require("../controllers/adminSettingsController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Apply admin authentication middleware to all routes
router.use(authenticateToken);
router.use(authorizeRoles(["admin"]));

// Get all platform settings
router.get("/", adminSettingsController.getPlatformSettings);

// Update tier/royalty settings
router.put("/tiers", adminSettingsController.updateTierSettings);

// Update VAT settings
router.put("/vat", adminSettingsController.updateVatSettings);

// Update minimum payout thresholds
router.put("/minimum-payout", adminSettingsController.updateMinimumPayout);

// Update all settings at once
router.put("/all", adminSettingsController.updateAllSettings);

// Get specific tier rate (for calculations)
router.get("/tier-rate/:tierName", adminSettingsController.getTierRate);

module.exports = router;
