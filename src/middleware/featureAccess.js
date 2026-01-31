const SystemSettings = require("../models/SystemSettings");
const UserSubscription = require("../models/UserSubscription");
const Feature = require("../models/Feature");
const { forbiddenResponse } = require("../utils/response");

/**
 * Feature Access Middleware
 *
 * Provides middleware functions for checking subscription-based feature access.
 * All middleware checks the global subscription toggle FIRST - if subscriptions
 * are disabled globally, all features are accessible.
 *
 * Error Codes:
 * - NO_SUBSCRIPTION: User has no active subscription
 * - SUBSCRIPTION_EXPIRED: User's subscription has expired
 * - FEATURE_NOT_INCLUDED: Feature not included in user's plan
 * - USAGE_LIMIT_REACHED: User has exceeded usage limit for this feature
 * - FEATURE_NOT_FOUND: The requested feature doesn't exist
 */

/**
 * Check if subscriptions are enforced globally
 * Returns early if subscriptions are disabled (everything is free)
 * @returns {Promise<boolean>} - true if subscriptions are enabled
 */
const isSubscriptionEnforced = async () => {
  return SystemSettings.isSubscriptionEnabled();
};

/**
 * Middleware factory: Require an active subscription
 * Checks global toggle first, then verifies user has active subscription.
 * Attaches subscription details to req.subscription for downstream use.
 *
 * @returns {Function} Express middleware
 */
const requireActiveSubscription = () => {
  return async (req, res, next) => {
    try {
      // Check global toggle first
      const enforced = await isSubscriptionEnforced();
      if (!enforced) {
        // Subscriptions disabled - allow access
        req.subscriptionEnforced = false;
        return next();
      }

      req.subscriptionEnforced = true;

      // User must be authenticated
      if (!req.user || !req.user.userId) {
        return forbiddenResponse(res, "Authentication required", {
          code: "AUTH_REQUIRED",
        });
      }

      // Get user's active subscription
      const subscription = await UserSubscription.findActiveByUser(req.user.userId);

      if (!subscription) {
        return forbiddenResponse(res, "Active subscription required", {
          code: "NO_SUBSCRIPTION",
          message: "You need an active subscription to access this feature.",
        });
      }

      // Check if subscription is actually usable
      if (subscription.isExpired) {
        return forbiddenResponse(res, "Subscription expired", {
          code: "SUBSCRIPTION_EXPIRED",
          message: "Your subscription has expired. Please renew to continue.",
          expiredAt: subscription.endDate || subscription.currentPeriodEnd,
        });
      }

      // Attach subscription to request for downstream use
      req.subscription = subscription;
      req.subscriptionPlan = subscription.planId;

      next();
    } catch (error) {
      console.error("Subscription check error:", error);
      next(error);
    }
  };
};

/**
 * Middleware factory: Require access to a specific feature
 * Checks global toggle, then subscription status, then feature inclusion.
 *
 * @param {string} featureKey - The feature key to check
 * @returns {Function} Express middleware
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      // Check global toggle first
      const enforced = await isSubscriptionEnforced();
      if (!enforced) {
        // Subscriptions disabled - allow access
        req.subscriptionEnforced = false;
        return next();
      }

      req.subscriptionEnforced = true;

      // User must be authenticated
      if (!req.user || !req.user.userId) {
        return forbiddenResponse(res, "Authentication required", {
          code: "AUTH_REQUIRED",
        });
      }

      // Verify the feature exists
      const feature = await Feature.findByKey(featureKey);
      if (!feature) {
        console.warn(`Feature check for non-existent feature: ${featureKey}`);
        // If feature doesn't exist in system, allow access (fail open for dev)
        // In production, you might want to fail closed instead
        return next();
      }

      // Check if this feature applies to user's role
      if (!feature.applicableRoles.includes(req.user.role)) {
        // Feature doesn't apply to this role - allow access
        // (Role-based features shouldn't block wrong roles, just not offer them)
        return next();
      }

      // Get user's active subscription
      const subscription = await UserSubscription.findActiveByUser(req.user.userId);

      if (!subscription) {
        return forbiddenResponse(res, "Active subscription required", {
          code: "NO_SUBSCRIPTION",
          feature: featureKey,
          featureName: feature.name,
          message: `You need an active subscription to ${feature.description.toLowerCase()}.`,
        });
      }

      // Check if subscription is expired
      if (subscription.isExpired) {
        return forbiddenResponse(res, "Subscription expired", {
          code: "SUBSCRIPTION_EXPIRED",
          feature: featureKey,
          featureName: feature.name,
          message: "Your subscription has expired. Please renew to continue.",
          expiredAt: subscription.endDate || subscription.currentPeriodEnd,
        });
      }

      // Check if feature is included in user's plan
      const plan = subscription.planId;
      if (!plan || !plan.features.includes(featureKey.toLowerCase())) {
        return forbiddenResponse(res, "Feature not included in your plan", {
          code: "FEATURE_NOT_INCLUDED",
          feature: featureKey,
          featureName: feature.name,
          currentPlan: plan ? plan.name : null,
          message: `Your current plan does not include ${feature.name}. Please upgrade to access this feature.`,
        });
      }

      // Attach subscription and feature to request
      req.subscription = subscription;
      req.subscriptionPlan = plan;
      req.feature = feature;

      next();
    } catch (error) {
      console.error("Feature access check error:", error);
      next(error);
    }
  };
};

/**
 * Middleware factory: Require feature with usage limit check
 * Extends requireFeature to also check usage limits.
 *
 * @param {string} featureKey - The feature key to check
 * @param {string} usageKey - The usage counter key (e.g., 'featuredListings')
 * @returns {Function} Express middleware
 */
const requireFeatureWithLimit = (featureKey, usageKey) => {
  return async (req, res, next) => {
    try {
      // Check global toggle first
      const enforced = await isSubscriptionEnforced();
      if (!enforced) {
        req.subscriptionEnforced = false;
        return next();
      }

      req.subscriptionEnforced = true;

      // User must be authenticated
      if (!req.user || !req.user.userId) {
        return forbiddenResponse(res, "Authentication required", {
          code: "AUTH_REQUIRED",
        });
      }

      // Verify the feature exists
      const feature = await Feature.findByKey(featureKey);
      if (!feature) {
        return next();
      }

      // Check if this feature applies to user's role
      if (!feature.applicableRoles.includes(req.user.role)) {
        return next();
      }

      // Get user's active subscription
      const subscription = await UserSubscription.findActiveByUser(req.user.userId);

      if (!subscription) {
        return forbiddenResponse(res, "Active subscription required", {
          code: "NO_SUBSCRIPTION",
          feature: featureKey,
          featureName: feature.name,
          message: `You need an active subscription to ${feature.description.toLowerCase()}.`,
        });
      }

      if (subscription.isExpired) {
        return forbiddenResponse(res, "Subscription expired", {
          code: "SUBSCRIPTION_EXPIRED",
          feature: featureKey,
          featureName: feature.name,
          message: "Your subscription has expired. Please renew to continue.",
        });
      }

      const plan = subscription.planId;
      if (!plan || !plan.features.includes(featureKey.toLowerCase())) {
        return forbiddenResponse(res, "Feature not included in your plan", {
          code: "FEATURE_NOT_INCLUDED",
          feature: featureKey,
          featureName: feature.name,
          currentPlan: plan ? plan.name : null,
          message: `Your current plan does not include ${feature.name}. Please upgrade to access this feature.`,
        });
      }

      // Check usage limit
      const usageCheck = await UserSubscription.checkUsageLimit(req.user.userId, usageKey);

      if (!usageCheck.withinLimit) {
        return forbiddenResponse(res, "Usage limit reached", {
          code: "USAGE_LIMIT_REACHED",
          feature: featureKey,
          featureName: feature.name,
          usageKey,
          current: usageCheck.current,
          limit: usageCheck.limit,
          message: `You have reached your ${feature.name.toLowerCase()} limit (${usageCheck.current}/${usageCheck.limit}). Please upgrade your plan for more.`,
        });
      }

      // Attach data to request
      req.subscription = subscription;
      req.subscriptionPlan = plan;
      req.feature = feature;
      req.usageInfo = usageCheck;

      next();
    } catch (error) {
      console.error("Feature limit check error:", error);
      next(error);
    }
  };
};

/**
 * Middleware: Optional subscription info
 * Attaches subscription info to request if available, but doesn't block.
 * Useful for routes that behave differently based on subscription status.
 *
 * @returns {Function} Express middleware
 */
const attachSubscriptionInfo = () => {
  return async (req, res, next) => {
    try {
      // Check global toggle
      const enforced = await isSubscriptionEnforced();
      req.subscriptionEnforced = enforced;

      if (!enforced || !req.user || !req.user.userId) {
        return next();
      }

      // Try to get subscription info
      const subscription = await UserSubscription.findActiveByUser(req.user.userId);

      if (subscription && !subscription.isExpired) {
        req.subscription = subscription;
        req.subscriptionPlan = subscription.planId;
      }

      next();
    } catch (error) {
      // Don't fail the request, just continue without subscription info
      console.error("Error attaching subscription info:", error);
      next();
    }
  };
};

/**
 * Helper: Check if user has feature access (non-middleware)
 * Useful for conditional logic in controllers.
 *
 * @param {ObjectId} userId - User ID
 * @param {string} featureKey - Feature key
 * @returns {Promise<Object>} - { hasAccess, reason, subscription }
 */
const checkFeatureAccess = async (userId, featureKey) => {
  // Check global toggle
  const enforced = await isSubscriptionEnforced();
  if (!enforced) {
    return { hasAccess: true, reason: "subscriptions_disabled" };
  }

  // Get subscription
  const subscription = await UserSubscription.findActiveByUser(userId);

  if (!subscription) {
    return { hasAccess: false, reason: "no_subscription", code: "NO_SUBSCRIPTION" };
  }

  if (subscription.isExpired) {
    return {
      hasAccess: false,
      reason: "subscription_expired",
      code: "SUBSCRIPTION_EXPIRED",
      subscription,
    };
  }

  const plan = subscription.planId;
  if (!plan || !plan.features.includes(featureKey.toLowerCase())) {
    return {
      hasAccess: false,
      reason: "feature_not_included",
      code: "FEATURE_NOT_INCLUDED",
      subscription,
      currentPlan: plan ? plan.name : null,
    };
  }

  return { hasAccess: true, reason: "has_access", subscription };
};

module.exports = {
  isSubscriptionEnforced,
  requireActiveSubscription,
  requireFeature,
  requireFeatureWithLimit,
  attachSubscriptionInfo,
  checkFeatureAccess,
};
