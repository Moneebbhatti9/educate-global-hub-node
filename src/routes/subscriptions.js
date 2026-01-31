const express = require("express");
const router = express.Router();
const { authenticateToken, optionalAuth } = require("../middleware/auth");
const subscriptionController = require("../controllers/subscriptionController");

/**
 * Subscription Routes
 * Handles subscription checkout, management, and status
 */

// Public routes
// GET /api/v1/subscriptions/plans/all - Get all plans (for pricing page)
router.get("/plans/all", subscriptionController.getAllPlans);

// Protected routes (require authentication)
// POST /api/v1/subscriptions/create-checkout - Create checkout session
router.post("/create-checkout", authenticateToken, subscriptionController.createCheckout);

// GET /api/v1/subscriptions/plans - Get plans for user's role
router.get("/plans", authenticateToken, subscriptionController.getPlans);

// GET /api/v1/subscriptions/my-subscription - Get current subscription
router.get("/my-subscription", authenticateToken, subscriptionController.getMySubscription);

// GET /api/v1/subscriptions/history - Get subscription history
router.get("/history", authenticateToken, subscriptionController.getSubscriptionHistory);

// POST /api/v1/subscriptions/cancel - Cancel subscription
router.post("/cancel", authenticateToken, subscriptionController.cancelSubscription);

// POST /api/v1/subscriptions/reactivate - Reactivate cancelled subscription
router.post("/reactivate", authenticateToken, subscriptionController.reactivateSubscription);

// GET /api/v1/subscriptions/check-feature/:featureKey - Check feature access
router.get(
  "/check-feature/:featureKey",
  authenticateToken,
  subscriptionController.checkFeatureAccess
);

// POST /api/v1/subscriptions/preview-change - Preview plan change proration
router.post("/preview-change", authenticateToken, subscriptionController.previewChange);

// POST /api/v1/subscriptions/change-plan - Change subscription plan
router.post("/change-plan", authenticateToken, subscriptionController.changePlan);

// POST /api/v1/subscriptions/billing-portal - Get Stripe billing portal URL
router.post("/billing-portal", authenticateToken, subscriptionController.getBillingPortal);

// GET /api/v1/subscriptions/invoices - Get billing/invoice history
router.get("/invoices", authenticateToken, subscriptionController.getInvoices);

module.exports = router;
