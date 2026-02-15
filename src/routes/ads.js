const express = require("express");
const multer = require("multer");
const router = express.Router();
const adController = require("../controllers/adController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

/**
 * Ad Routes
 * Handles ad tier listing and ad request operations.
 *
 * Base path: /api/v1/ads
 */

// Configure multer for banner image uploads (images only, max 2MB)
const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "File type not allowed. Allowed types: JPEG, PNG, WebP"
        ),
        false
      );
    }
  },
});

// ==========================================
// Public routes
// ==========================================

// GET /api/v1/ads/tiers - Get all active ad tiers with pricing
router.get("/tiers", adController.getAdTiers);

// GET /api/v1/ads/tiers/:slug - Get a single ad tier by slug
router.get("/tiers/:slug", adController.getAdTierBySlug);

// GET /api/v1/ads/banners/active - Get active banners for carousel
router.get("/banners/active", adController.getActiveBanners);

// ==========================================
// Protected routes (school)
// ==========================================

// POST /api/v1/ads/requests - Create ad request with banner upload
router.post(
  "/requests",
  authenticateToken,
  bannerUpload.single("banner"),
  adController.createAdRequest
);

// GET /api/v1/ads/requests/my - Get current school's ad requests
router.get("/requests/my", authenticateToken, adController.getMyAdRequests);

// PATCH /api/v1/ads/requests/:id/cancel - Cancel a pending ad request
router.patch(
  "/requests/:id/cancel",
  authenticateToken,
  adController.cancelAdRequest
);

// POST /api/v1/ads/requests/:id/resubmit - Resubmit ad request after changes requested
router.post(
  "/requests/:id/resubmit",
  authenticateToken,
  bannerUpload.single("banner"),
  adController.resubmitAdRequest
);

// POST /api/v1/ads/requests/:id/checkout - Create Stripe checkout for approved ad
router.post(
  "/requests/:id/checkout",
  authenticateToken,
  adController.createAdCheckout
);

// ==========================================
// Admin routes
// ==========================================

// GET /api/v1/ads/admin/stats - Get ad request statistics (admin)
router.get(
  "/admin/stats",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminGetAdStats
);

// GET /api/v1/ads/admin/requests - Get all ad requests (admin)
router.get(
  "/admin/requests",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminGetAdRequests
);

// GET /api/v1/ads/admin/requests/:id - Get ad request detail (admin)
router.get(
  "/admin/requests/:id",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminGetAdRequestDetail
);

// PATCH /api/v1/ads/admin/requests/:id/approve - Approve ad request (admin)
router.patch(
  "/admin/requests/:id/approve",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminApproveAdRequest
);

// PATCH /api/v1/ads/admin/requests/:id/reject - Reject ad request (admin)
router.patch(
  "/admin/requests/:id/reject",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminRejectAdRequest
);

// PATCH /api/v1/ads/admin/requests/:id/request-changes - Request changes (admin)
router.patch(
  "/admin/requests/:id/request-changes",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminRequestChanges
);

// ==========================================
// Admin Ad Tier CRUD routes
// ==========================================

// GET /api/v1/ads/admin/tiers - Get all ad tiers (admin)
router.get(
  "/admin/tiers",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminGetAllAdTiers
);

// POST /api/v1/ads/admin/tiers - Create ad tier (admin)
router.post(
  "/admin/tiers",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminCreateAdTier
);

// PUT /api/v1/ads/admin/tiers/:id - Update ad tier (admin)
router.put(
  "/admin/tiers/:id",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminUpdateAdTier
);

// DELETE /api/v1/ads/admin/tiers/:id - Delete ad tier (admin)
router.delete(
  "/admin/tiers/:id",
  authenticateToken,
  authorizeRoles(["admin"]),
  adController.adminDeleteAdTier
);

module.exports = router;
