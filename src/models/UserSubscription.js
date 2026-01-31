const mongoose = require("mongoose");

/**
 * UserSubscription Model
 * Tracks a user's active subscription and its status.
 * Links users to their subscription plans and manages lifecycle.
 *
 * Status flow: trial -> active -> (past_due -> active OR cancelled) -> expired
 */
const userSubscriptionSchema = new mongoose.Schema(
  {
    // Reference to the user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Reference to the subscription plan
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    // Subscription status
    status: {
      type: String,
      enum: ["active", "trial", "past_due", "cancelled", "expired"],
      required: true,
      default: "active",
      index: true,
    },
    // Stripe Subscription ID
    stripeSubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Stripe Customer ID (denormalized for quick lookup)
    stripeCustomerId: {
      type: String,
      sparse: true,
    },
    // Subscription start date
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Subscription end date (null for active recurring subscriptions)
    endDate: {
      type: Date,
      default: null,
    },
    // Current billing period start
    currentPeriodStart: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Current billing period end
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    // Trial end date (if applicable)
    trialEndDate: {
      type: Date,
      default: null,
    },
    // Date when subscription was cancelled (still active until period end)
    cancelledAt: {
      type: Date,
      default: null,
    },
    // Whether subscription should renew at period end
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    // Usage tracking for the current billing period
    usage: {
      featuredListings: {
        type: Number,
        default: 0,
      },
      candidateSearches: {
        type: Number,
        default: 0,
      },
      resourceUploads: {
        type: Number,
        default: 0,
      },
      bulkMessages: {
        type: Number,
        default: 0,
      },
      // When usage was last reset
      lastResetAt: {
        type: Date,
        default: Date.now,
      },
    },
    // Price paid (in pence) - may differ from plan price due to discounts
    pricePaid: {
      type: mongoose.Schema.Types.Decimal128,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    // Metadata from Stripe or other sources
    metadata: {
      type: Map,
      of: String,
      default: new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Compound indexes for efficient queries
userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
userSubscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });

/**
 * Virtual: Check if subscription is expired
 */
userSubscriptionSchema.virtual("isExpired").get(function () {
  if (this.status === "expired") return true;
  if (this.status === "cancelled" && this.endDate && this.endDate < new Date()) return true;
  if (this.currentPeriodEnd && this.currentPeriodEnd < new Date() && this.status !== "active") {
    return true;
  }
  return false;
});

/**
 * Virtual: Check if subscription is in trial
 */
userSubscriptionSchema.virtual("isInTrial").get(function () {
  if (this.status !== "trial") return false;
  if (!this.trialEndDate) return false;
  return this.trialEndDate > new Date();
});

/**
 * Virtual: Days remaining in current period
 */
userSubscriptionSchema.virtual("daysRemaining").get(function () {
  if (!this.currentPeriodEnd) return 0;
  const now = new Date();
  const diffTime = this.currentPeriodEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

/**
 * Find active subscription for a user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object|null>} - Active subscription or null
 */
userSubscriptionSchema.statics.findActiveByUser = async function (userId) {
  return this.findOne({
    userId,
    status: { $in: ["active", "trial", "past_due"] },
  }).populate("planId");
};

/**
 * Find all subscriptions for a user (including expired)
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Array>} - Array of subscriptions
 */
userSubscriptionSchema.statics.findAllByUser = async function (userId) {
  return this.find({ userId }).populate("planId").sort({ createdAt: -1 });
};

/**
 * Find subscription by Stripe Subscription ID
 * @param {string} stripeSubscriptionId - Stripe Subscription ID
 * @returns {Promise<Object|null>} - Subscription or null
 */
userSubscriptionSchema.statics.findByStripeSubscriptionId = async function (stripeSubscriptionId) {
  return this.findOne({ stripeSubscriptionId }).populate("planId");
};

/**
 * Check if user has an active subscription
 * @param {ObjectId} userId - User ID
 * @returns {Promise<boolean>} - true if user has active subscription
 */
userSubscriptionSchema.statics.hasActiveSubscription = async function (userId) {
  const count = await this.countDocuments({
    userId,
    status: { $in: ["active", "trial", "past_due"] },
  });
  return count > 0;
};

/**
 * Check if user has access to a specific feature
 * @param {ObjectId} userId - User ID
 * @param {string} featureKey - Feature key
 * @returns {Promise<boolean>} - true if user has access
 */
userSubscriptionSchema.statics.hasFeatureAccess = async function (userId, featureKey) {
  const subscription = await this.findActiveByUser(userId);

  if (!subscription || !subscription.planId) {
    return false;
  }

  return subscription.planId.features.includes(featureKey.toLowerCase());
};

/**
 * Increment usage counter for a feature
 * @param {ObjectId} userId - User ID
 * @param {string} usageKey - Usage key (e.g., 'featuredListings')
 * @param {number} amount - Amount to increment (default: 1)
 * @returns {Promise<Object|null>} - Updated subscription or null
 */
userSubscriptionSchema.statics.incrementUsage = async function (userId, usageKey, amount = 1) {
  const subscription = await this.findActiveByUser(userId);

  if (!subscription) {
    return null;
  }

  const updatePath = `usage.${usageKey}`;
  return this.findByIdAndUpdate(
    subscription._id,
    { $inc: { [updatePath]: amount } },
    { new: true }
  ).populate("planId");
};

/**
 * Check if user is within usage limit
 * @param {ObjectId} userId - User ID
 * @param {string} usageKey - Usage key
 * @returns {Promise<Object>} - { withinLimit, current, limit }
 */
userSubscriptionSchema.statics.checkUsageLimit = async function (userId, usageKey) {
  const subscription = await this.findActiveByUser(userId);

  if (!subscription || !subscription.planId) {
    return { withinLimit: false, current: 0, limit: 0, hasSubscription: false };
  }

  const current = subscription.usage[usageKey] || 0;
  const limit = subscription.planId.limits[usageKey];

  // null limit means unlimited
  if (limit === null || limit === undefined) {
    return { withinLimit: true, current, limit: null, hasSubscription: true };
  }

  return {
    withinLimit: current < limit,
    current,
    limit,
    hasSubscription: true,
  };
};

/**
 * Reset usage counters (called at billing period start)
 * @returns {Promise<Object>} - Update result
 */
userSubscriptionSchema.statics.resetUsageForPeriod = async function (subscriptionId) {
  return this.findByIdAndUpdate(
    subscriptionId,
    {
      $set: {
        "usage.featuredListings": 0,
        "usage.candidateSearches": 0,
        "usage.resourceUploads": 0,
        "usage.bulkMessages": 0,
        "usage.lastResetAt": new Date(),
      },
    },
    { new: true }
  );
};

/**
 * Get subscriptions expiring soon (for notifications)
 * @param {number} daysAhead - Days to look ahead
 * @returns {Promise<Array>} - Subscriptions expiring within the window
 */
userSubscriptionSchema.statics.getExpiringSoon = async function (daysAhead = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return this.find({
    status: { $in: ["active", "trial"] },
    currentPeriodEnd: { $gte: now, $lte: futureDate },
    cancelAtPeriodEnd: true,
  }).populate(["userId", "planId"]);
};

/**
 * Update subscription status from Stripe event
 * @param {string} stripeSubscriptionId - Stripe Subscription ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} - Updated subscription or null
 */
userSubscriptionSchema.statics.updateFromStripeEvent = async function (
  stripeSubscriptionId,
  updates
) {
  return this.findOneAndUpdate({ stripeSubscriptionId }, { $set: updates }, { new: true }).populate(
    "planId"
  );
};

const UserSubscription = mongoose.model("UserSubscription", userSubscriptionSchema);

module.exports = UserSubscription;
