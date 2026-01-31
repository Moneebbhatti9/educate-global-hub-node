const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const adminSubscriptionController = require("../controllers/adminSubscriptionController");

/**
 * Admin Subscription Routes
 * All routes require admin authentication
 */

// Apply admin authentication to all routes
router.use(authenticateToken);
router.use(authorizeRoles(["admin"]));

// ============================================
// SYSTEM SETTINGS
// ============================================

// GET /api/v1/admin/subscriptions/settings - Get subscription system settings
router.get("/settings", adminSubscriptionController.getSettings);

// PUT /api/v1/admin/subscriptions/settings - Update subscription system settings
router.put("/settings", adminSubscriptionController.updateSettings);

// POST /api/v1/admin/subscriptions/toggle - Toggle subscription enforcement
router.post("/toggle", adminSubscriptionController.toggleSubscriptions);

// ============================================
// SUBSCRIPTION PLANS
// ============================================

// GET /api/v1/admin/subscriptions/plans - Get all plans
router.get("/plans", adminSubscriptionController.getAllPlans);

// GET /api/v1/admin/subscriptions/plans/:planId - Get a single plan
router.get("/plans/:planId", adminSubscriptionController.getPlan);

// POST /api/v1/admin/subscriptions/plans - Create a new plan
router.post("/plans", adminSubscriptionController.createPlan);

// PUT /api/v1/admin/subscriptions/plans/:planId - Update a plan
router.put("/plans/:planId", adminSubscriptionController.updatePlan);

// DELETE /api/v1/admin/subscriptions/plans/:planId - Delete a plan
router.delete("/plans/:planId", adminSubscriptionController.deletePlan);

// POST /api/v1/admin/subscriptions/plans/:planId/sync-stripe - Sync with Stripe
router.post("/plans/:planId/sync-stripe", adminSubscriptionController.syncPlanWithStripe);

// ============================================
// FEATURES
// ============================================

// GET /api/v1/admin/subscriptions/features - Get all features
router.get("/features", adminSubscriptionController.getAllFeatures);

// PUT /api/v1/admin/subscriptions/features/:featureId - Update a feature
router.put("/features/:featureId", adminSubscriptionController.updateFeature);

// ============================================
// ANALYTICS
// ============================================

// GET /api/v1/admin/subscriptions/analytics - Get subscription analytics
router.get("/analytics", adminSubscriptionController.getAnalytics);

// ============================================
// USER SUBSCRIPTIONS
// ============================================

// GET /api/v1/admin/subscriptions/user-subscriptions - Get all user subscriptions
router.get("/user-subscriptions", adminSubscriptionController.getUserSubscriptions);

module.exports = router;
