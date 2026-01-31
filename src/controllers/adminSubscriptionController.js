const mongoose = require("mongoose");
const SystemSettings = require("../models/SystemSettings");
const Feature = require("../models/Feature");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const UserSubscription = require("../models/UserSubscription");
const { createSubscriptionProduct } = require("../config/stripe");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  createdResponse,
  paginatedResponse,
} = require("../utils/response");

/**
 * Admin Subscription Controller
 * Handles admin operations for subscription management
 */

// ============================================
// SYSTEM SETTINGS
// ============================================

/**
 * Get subscription system settings
 * GET /api/v1/admin/subscriptions/settings
 */
async function getSettings(req, res, next) {
  try {
    const subscriptionsEnabled = await SystemSettings.isSubscriptionEnabled();
    const allSettings = await SystemSettings.getByCategory("subscriptions");

    return successResponse(
      res,
      {
        settings: {
          subscriptionsEnabled,
          allSettings: allSettings.map((s) => ({
            key: s.key,
            value: s.value,
            description: s.description,
            updatedAt: s.updatedAt,
          })),
        },
      },
      "Settings retrieved"
    );
  } catch (error) {
    console.error("Error getting subscription settings:", error);
    next(error);
  }
}

/**
 * Update subscription system settings
 * PUT /api/v1/admin/subscriptions/settings
 */
async function updateSettings(req, res, next) {
  try {
    const { subscriptionsEnabled } = req.body;
    const adminId = req.user.userId;

    if (typeof subscriptionsEnabled === "boolean") {
      await SystemSettings.setSubscriptionEnabled(subscriptionsEnabled, adminId);
    }

    const newState = await SystemSettings.isSubscriptionEnabled();

    return successResponse(
      res,
      {
        settings: {
          subscriptionsEnabled: newState,
        },
      },
      "Settings updated"
    );
  } catch (error) {
    console.error("Error updating subscription settings:", error);
    next(error);
  }
}

/**
 * Toggle subscription enforcement
 * POST /api/v1/admin/subscriptions/toggle
 */
async function toggleSubscriptions(req, res, next) {
  try {
    const { enabled } = req.body;
    const adminId = req.user.userId;

    if (typeof enabled !== "boolean") {
      return errorResponse(res, "enabled must be a boolean", 400);
    }

    await SystemSettings.setSubscriptionEnabled(enabled, adminId);
    const newState = await SystemSettings.isSubscriptionEnabled();

    return successResponse(
      res,
      {
        settings: {
          subscriptionsEnabled: newState,
        },
      },
      `Subscriptions ${newState ? "enabled" : "disabled"}`
    );
  } catch (error) {
    console.error("Error toggling subscriptions:", error);
    next(error);
  }
}

// ============================================
// SUBSCRIPTION PLANS
// ============================================

/**
 * Get all subscription plans (admin view)
 * GET /api/v1/admin/subscriptions/plans
 */
async function getAllPlans(req, res, next) {
  try {
    const plans = await SubscriptionPlan.find({})
      .sort({ targetRole: 1, sortOrder: 1 })
      .lean();

    // Convert Decimal128 to numbers for JSON
    const formattedPlans = plans.map((plan) => ({
      ...plan,
      price: plan.price ? parseFloat(plan.price.toString()) : 0,
    }));

    return successResponse(res, { plans: formattedPlans }, "Plans retrieved");
  } catch (error) {
    console.error("Error getting plans:", error);
    next(error);
  }
}

/**
 * Get a single plan
 * GET /api/v1/admin/subscriptions/plans/:planId
 */
async function getPlan(req, res, next) {
  try {
    const { planId } = req.params;

    const plan = await SubscriptionPlan.findById(planId).lean();

    if (!plan) {
      return notFoundResponse(res, "Plan not found");
    }

    return successResponse(
      res,
      {
        plan: {
          ...plan,
          price: plan.price ? parseFloat(plan.price.toString()) : 0,
        },
      },
      "Plan retrieved"
    );
  } catch (error) {
    console.error("Error getting plan:", error);
    next(error);
  }
}

/**
 * Create a new subscription plan
 * POST /api/v1/admin/subscriptions/plans
 */
async function createPlan(req, res, next) {
  try {
    const adminId = req.user.userId;
    const {
      name,
      slug,
      description,
      targetRole,
      price,
      currency,
      billingPeriod,
      features,
      limits,
      trialDays,
      isActive,
      isDefault,
      sortOrder,
      highlight,
      discountPercent,
      discountExpiresAt,
    } = req.body;

    // Validate required fields
    if (!name || !slug || !targetRole || !billingPeriod) {
      return errorResponse(res, "Missing required fields", 400);
    }

    // Check for duplicate slug
    const existing = await SubscriptionPlan.findOne({ slug: slug.toLowerCase() });
    if (existing) {
      return errorResponse(res, "A plan with this slug already exists", 409);
    }

    // Create plan
    const plan = await SubscriptionPlan.create({
      name,
      slug: slug.toLowerCase(),
      description,
      targetRole,
      price: mongoose.Types.Decimal128.fromString((price || 0).toString()),
      currency: currency || "GBP",
      billingPeriod,
      features: features || [],
      limits: limits || {},
      trialDays: trialDays || 0,
      isActive: isActive !== false,
      isDefault: isDefault || false,
      sortOrder: sortOrder || 0,
      highlight,
      discountPercent: discountPercent || 0,
      discountExpiresAt: discountExpiresAt ? new Date(discountExpiresAt) : null,
      createdBy: adminId,
      lastUpdatedBy: adminId,
    });

    // If setting as default, unset other defaults for same role
    if (isDefault) {
      await SubscriptionPlan.updateMany(
        { targetRole, _id: { $ne: plan._id } },
        { isDefault: false }
      );
    }

    return createdResponse(
      res,
      {
        plan: {
          ...plan.toObject(),
          price: plan.price ? parseFloat(plan.price.toString()) : 0,
        },
      },
      "Plan created"
    );
  } catch (error) {
    console.error("Error creating plan:", error);
    next(error);
  }
}

/**
 * Update a subscription plan
 * PUT /api/v1/admin/subscriptions/plans/:planId
 */
async function updatePlan(req, res, next) {
  try {
    const { planId } = req.params;
    const adminId = req.user.userId;
    const updates = req.body;

    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      return notFoundResponse(res, "Plan not found");
    }

    // Handle price conversion
    if (updates.price !== undefined) {
      updates.price = mongoose.Types.Decimal128.fromString(updates.price.toString());
    }

    // Handle discount expiry date
    if (updates.discountExpiresAt) {
      updates.discountExpiresAt = new Date(updates.discountExpiresAt);
    }

    // Update fields
    Object.assign(plan, updates, { lastUpdatedBy: adminId });
    await plan.save();

    // If setting as default, unset other defaults for same role
    if (updates.isDefault) {
      await SubscriptionPlan.updateMany(
        { targetRole: plan.targetRole, _id: { $ne: plan._id } },
        { isDefault: false }
      );
    }

    return successResponse(
      res,
      {
        plan: {
          ...plan.toObject(),
          price: plan.price ? parseFloat(plan.price.toString()) : 0,
        },
      },
      "Plan updated"
    );
  } catch (error) {
    console.error("Error updating plan:", error);
    next(error);
  }
}

/**
 * Delete a subscription plan
 * DELETE /api/v1/admin/subscriptions/plans/:planId
 */
async function deletePlan(req, res, next) {
  try {
    const { planId } = req.params;

    // Check if plan has active subscriptions
    const activeCount = await UserSubscription.countDocuments({
      planId,
      status: { $in: ["active", "trial", "past_due"] },
    });

    if (activeCount > 0) {
      return errorResponse(
        res,
        `Cannot delete plan with ${activeCount} active subscriptions. Deactivate the plan instead.`,
        400
      );
    }

    const plan = await SubscriptionPlan.findByIdAndDelete(planId);

    if (!plan) {
      return notFoundResponse(res, "Plan not found");
    }

    return successResponse(res, null, "Plan deleted");
  } catch (error) {
    console.error("Error deleting plan:", error);
    next(error);
  }
}

/**
 * Sync plan with Stripe (create/update product and price)
 * POST /api/v1/admin/subscriptions/plans/:planId/sync-stripe
 */
async function syncPlanWithStripe(req, res, next) {
  try {
    const { planId } = req.params;

    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      return notFoundResponse(res, "Plan not found");
    }

    // Create Stripe product and price
    const { product, price } = await createSubscriptionProduct({
      name: plan.name,
      description: plan.description || `${plan.name} subscription plan`,
      amount: plan.price ? parseInt(plan.price.toString()) : 0,
      currency: plan.currency || "GBP",
      interval: plan.billingPeriod,
      metadata: {
        planId: plan._id.toString(),
        targetRole: plan.targetRole,
      },
    });

    // Update plan with Stripe IDs
    plan.stripeProductId = product.id;
    plan.stripePriceId = price.id;
    await plan.save();

    return successResponse(
      res,
      {
        plan: {
          ...plan.toObject(),
          price: plan.price ? parseFloat(plan.price.toString()) : 0,
        },
      },
      "Plan synced with Stripe"
    );
  } catch (error) {
    console.error("Error syncing plan with Stripe:", error);
    next(error);
  }
}

// ============================================
// FEATURES
// ============================================

/**
 * Get all features
 * GET /api/v1/admin/subscriptions/features
 */
async function getAllFeatures(req, res, next) {
  try {
    const features = await Feature.find({}).sort({ category: 1, sortOrder: 1 });

    return successResponse(res, { features }, "Features retrieved");
  } catch (error) {
    console.error("Error getting features:", error);
    next(error);
  }
}

/**
 * Update a feature
 * PUT /api/v1/admin/subscriptions/features/:featureId
 */
async function updateFeature(req, res, next) {
  try {
    const { featureId } = req.params;
    const updates = req.body;

    const feature = await Feature.findByIdAndUpdate(featureId, updates, { new: true });

    if (!feature) {
      return notFoundResponse(res, "Feature not found");
    }

    return successResponse(res, { feature }, "Feature updated");
  } catch (error) {
    console.error("Error updating feature:", error);
    next(error);
  }
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get subscription analytics
 * GET /api/v1/admin/subscriptions/analytics
 */
async function getAnalytics(req, res, next) {
  try {
    // Get counts by status
    const statusCounts = await UserSubscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get active and trial counts
    const activeCount =
      statusCounts.find((s) => s._id === "active")?.count || 0;
    const trialCount =
      statusCounts.find((s) => s._id === "trial")?.count || 0;

    // Get counts by plan
    const planCounts = await UserSubscription.aggregate([
      { $match: { status: { $in: ["active", "trial"] } } },
      { $group: { _id: "$planId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "subscriptionplans",
          localField: "_id",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: "$plan" },
      {
        $project: {
          planId: "$_id",
          planName: "$plan.name",
          count: 1,
        },
      },
    ]);

    // Get recent subscriptions
    const recentSubscriptions = await UserSubscription.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "firstName lastName email")
      .populate("planId", "name slug")
      .lean();

    // Calculate revenue (simplified - just sum of pricePaid for active subscriptions)
    const revenueData = await UserSubscription.aggregate([
      { $match: { status: { $in: ["active", "trial"] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $toDouble: "$pricePaid" } },
        },
      },
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    // Calculate MRR (simplified)
    const monthlyPlans = await UserSubscription.aggregate([
      { $match: { status: "active" } },
      {
        $lookup: {
          from: "subscriptionplans",
          localField: "planId",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: "$plan" },
      { $match: { "plan.billingPeriod": "monthly" } },
      {
        $group: {
          _id: null,
          mrr: { $sum: { $toDouble: "$plan.price" } },
        },
      },
    ]);

    const mrr = (monthlyPlans[0]?.mrr || 0) / 100; // Convert from pence

    return successResponse(
      res,
      {
        analytics: {
          totalActiveSubscriptions: activeCount,
          totalTrialSubscriptions: trialCount,
          totalRevenue: totalRevenue / 100, // Convert from pence
          monthlyRecurringRevenue: mrr,
          churnRate: 0, // TODO: Calculate actual churn rate
          subscriptionsByPlan: planCounts,
          subscriptionsByStatus: statusCounts.map((s) => ({
            status: s._id,
            count: s.count,
          })),
          recentSubscriptions: recentSubscriptions.map((sub) => ({
            id: sub._id,
            userId: sub.userId?._id,
            userName: sub.userId
              ? `${sub.userId.firstName} ${sub.userId.lastName}`
              : "Unknown",
            userEmail: sub.userId?.email,
            planName: sub.planId?.name || "Unknown",
            status: sub.status,
            createdAt: sub.createdAt,
          })),
        },
      },
      "Analytics retrieved"
    );
  } catch (error) {
    console.error("Error getting analytics:", error);
    next(error);
  }
}

// ============================================
// USER SUBSCRIPTIONS
// ============================================

/**
 * Get all user subscriptions (paginated)
 * GET /api/v1/admin/subscriptions/user-subscriptions
 */
async function getUserSubscriptions(req, res, next) {
  try {
    const { page = 1, limit = 10, status, planId } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (planId) filter.planId = planId;

    // Get total count
    const total = await UserSubscription.countDocuments(filter);

    // Get subscriptions
    const subscriptions = await UserSubscription.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("userId", "firstName lastName email")
      .populate("planId", "name slug")
      .lean();

    return paginatedResponse(
      res,
      subscriptions,
      {
        page: pageNum,
        limit: limitNum,
        total,
      },
      "Subscriptions retrieved"
    );
  } catch (error) {
    console.error("Error getting user subscriptions:", error);
    next(error);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  toggleSubscriptions,
  getAllPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  syncPlanWithStripe,
  getAllFeatures,
  updateFeature,
  getAnalytics,
  getUserSubscriptions,
};
