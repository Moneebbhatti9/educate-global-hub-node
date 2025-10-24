const express = require("express");
const {
  purchaseResource,
  getMySales,
  getMyPurchases,
  getPurchaseBySession,
  getEarningsDashboard,
  getResourceSales,
  refundSale,
} = require("../controllers/salesController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const router = express.Router();

/**
 * Sales Routes
 * Handles resource purchases, sales history, and earnings analytics
 */

// Purchase a resource (Buyer)
router.post("/purchase", authenticateToken, purchaseResource);

// Get my sales history (Seller)
router.get("/my-sales", authenticateToken, getMySales);

// Get my purchases (Buyer)
router.get("/my-purchases", authenticateToken, getMyPurchases);

// Get purchase details by session ID (Buyer)
router.get("/purchase/session/:sessionId", authenticateToken, getPurchaseBySession);

// Get earnings dashboard (Seller)
router.get("/earnings", authenticateToken, getEarningsDashboard);

// Get sales for a specific resource (Seller)
router.get("/resource/:resourceId", authenticateToken, getResourceSales);

// Refund a sale (Admin only)
router.post(
  "/refund/:saleId",
  authenticateToken,
  authorizeRoles(["admin"]),
  refundSale
);

module.exports = router;
