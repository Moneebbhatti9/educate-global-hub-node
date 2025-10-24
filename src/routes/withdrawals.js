const express = require("express");
const {
  requestWithdrawal,
  getWithdrawalHistory,
  getWithdrawalInfo,
  updateTaxInfo,
  getTaxInfo,
  processWithdrawal,
  getPendingWithdrawals,
} = require("../controllers/withdrawalController");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const router = express.Router();

/**
 * Withdrawal Routes
 * Handles withdrawal requests, tax information, and payout processing
 */

// Request a withdrawal (Seller)
router.post("/request", authenticateToken, requestWithdrawal);

// Get withdrawal history (Seller)
router.get("/history", authenticateToken, getWithdrawalHistory);

// Get withdrawal info and limits (Seller)
router.get("/info", authenticateToken, getWithdrawalInfo);

// Get tax information (Seller)
router.get("/tax-info", authenticateToken, getTaxInfo);

// Update tax information (Seller)
router.put("/tax-info", authenticateToken, updateTaxInfo);

// Process withdrawal - approve/reject (Admin only)
router.post(
  "/process/:withdrawalId",
  authenticateToken,
  authorizeRoles(["admin"]),
  processWithdrawal
);

// Get all pending withdrawals (Admin only)
router.get(
  "/pending",
  authenticateToken,
  authorizeRoles(["admin"]),
  getPendingWithdrawals
);

module.exports = router;
