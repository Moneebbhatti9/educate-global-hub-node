const express = require("express");
const {
  purchaseResource,
  getMySales,
  getMyPurchases,
  getPurchaseBySession,
  getEarningsDashboard,
  getResourceSales,
  refundSale,
  secureDownload,
  proxyDownload,
  getResourceDownloads,
  getMyDownloads,
} = require("../controllers/salesController");
const { authenticateToken, optionalAuth, authorizeRoles } = require("../middleware/auth");
const router = express.Router();

/**
 * Sales Routes
 * Handles resource purchases, sales history, earnings analytics, and downloads
 * Enhancement: Added secure download and download tracking endpoints
 */

// Purchase a resource (Buyer)
router.post("/purchase", authenticateToken, purchaseResource);

// Get my sales history (Seller)
router.get("/my-sales", authenticateToken, getMySales);

// Get my purchases (Buyer)
router.get("/my-purchases", authenticateToken, getMyPurchases);

// Get my download history (Buyer)
// Enhancement: Added download history endpoint
router.get("/my-downloads", authenticateToken, getMyDownloads);

// Get purchase details by session ID (Buyer)
router.get("/purchase/session/:sessionId", authenticateToken, getPurchaseBySession);

// Get earnings dashboard (Seller)
router.get("/earnings", authenticateToken, getEarningsDashboard);

// Get sales for a specific resource (Seller)
router.get("/resource/:resourceId", authenticateToken, getResourceSales);

// Get download analytics for a resource (Seller/Owner)
// Enhancement: Added download analytics endpoint
router.get("/resource/:resourceId/downloads", authenticateToken, getResourceDownloads);

// Secure download endpoint - verifies ownership/purchase before download
// Enhancement: Added secure download with verification
// Uses optionalAuth to allow free resource downloads without login
router.get("/download/:resourceId", optionalAuth, secureDownload);

// Proxy download endpoint - streams file to client with proper headers
// This solves CORS issues with Cloudinary PDFs and ensures proper downloads
// Enhancement: Added file proxy for reliable downloads
router.get("/download/:resourceId/file", optionalAuth, proxyDownload);

// Refund a sale (Admin only)
router.post(
  "/refund/:saleId",
  authenticateToken,
  authorizeRoles(["admin"]),
  refundSale
);

module.exports = router;
