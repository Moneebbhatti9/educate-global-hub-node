const express = require("express");
const router = express.Router();
const multer = require("multer");
const adminSettingsController = require("../controllers/adminSettingsController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "image/x-icon") {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// ==================== Public Routes ====================
// Get general settings (public - for logo, site name displayed everywhere)
router.get("/general", adminSettingsController.getGeneralSettings);

// ==================== Admin Protected Routes ====================
// Apply admin authentication middleware to remaining routes
router.use(authenticateToken);
router.use(authorizeRoles(["admin"]));

// Get all platform settings
router.get("/", adminSettingsController.getPlatformSettings);

// Update general settings (with file uploads for logo/favicon)
router.put(
  "/general",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  adminSettingsController.updateGeneralSettings
);

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
