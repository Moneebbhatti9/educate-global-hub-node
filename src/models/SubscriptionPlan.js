const mongoose = require("mongoose");

/**
 * SubscriptionPlan Model
 * Stores subscription plan definitions with features, limits, and pricing.
 * Admin-configurable plans that users can subscribe to.
 *
 * Includes Stripe integration fields for payment processing.
 */
const subscriptionPlanSchema = new mongoose.Schema(
  {
    // Plan name for display
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // URL-friendly slug
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Detailed description
    description: {
      type: String,
      trim: true,
    },
    // Target user role for this plan
    targetRole: {
      type: String,
      enum: ["teacher", "school", "recruiter", "supplier"],
      required: true,
      index: true,
    },
    // Pricing in pence (GBP) - using Decimal128 for precision
    price: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    // Currency code
    currency: {
      type: String,
      default: "GBP",
      uppercase: true,
    },
    // Billing period
    billingPeriod: {
      type: String,
      enum: ["monthly", "annual", "lifetime"],
      required: true,
    },
    // Features included in this plan (array of feature keys)
    features: {
      type: [String],
      default: [],
      index: true,
    },
    // Usage limits for metered features
    limits: {
      // Featured job listings per billing period
      featuredListings: {
        type: Number,
        default: null, // null = unlimited
      },
      // Candidate searches per billing period
      candidateSearches: {
        type: Number,
        default: null,
      },
      // Resource uploads per billing period (for teachers)
      resourceUploads: {
        type: Number,
        default: null,
      },
      // Bulk messages per billing period
      bulkMessages: {
        type: Number,
        default: null,
      },
    },
    // Trial period in days (0 = no trial)
    trialDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Whether the plan is currently available for purchase
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Whether this is the default/recommended plan for the role
    isDefault: {
      type: Boolean,
      default: false,
    },
    // Sort order for display on pricing page
    sortOrder: {
      type: Number,
      default: 0,
    },
    // Highlight text (e.g., "Most Popular", "Best Value")
    highlight: {
      type: String,
      trim: true,
      default: null,
    },
    // Stripe Product ID (synced when plan is created/updated in Stripe)
    stripeProductId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Stripe Price ID (synced when plan is created/updated in Stripe)
    stripePriceId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Promotional discount percentage (0-100)
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Discount expiry date
    discountExpiresAt: {
      type: Date,
      default: null,
    },
    // Created by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Last updated by admin
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Compound indexes for efficient queries
subscriptionPlanSchema.index({ targetRole: 1, isActive: 1, sortOrder: 1 });
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

/**
 * Virtual: Calculate effective price after discount
 */
subscriptionPlanSchema.virtual("effectivePrice").get(function () {
  const basePrice = this.price ? parseFloat(this.price.toString()) : 0;

  // Check if discount is active
  if (this.discountPercent > 0) {
    const now = new Date();
    if (!this.discountExpiresAt || this.discountExpiresAt > now) {
      return basePrice * (1 - this.discountPercent / 100);
    }
  }

  return basePrice;
});

/**
 * Virtual: Check if discount is currently active
 */
subscriptionPlanSchema.virtual("hasActiveDiscount").get(function () {
  if (this.discountPercent <= 0) return false;
  if (!this.discountExpiresAt) return true;
  return this.discountExpiresAt > new Date();
});

/**
 * Find active plans for a specific role
 * @param {string} role - User role
 * @returns {Promise<Array>} - Array of active plans
 */
subscriptionPlanSchema.statics.findActiveByRole = async function (role) {
  return this.find({
    targetRole: role,
    isActive: true,
  }).sort({ sortOrder: 1 });
};

/**
 * Find a plan by slug
 * @param {string} slug - Plan slug
 * @returns {Promise<Object|null>} - The plan or null
 */
subscriptionPlanSchema.statics.findBySlug = async function (slug) {
  return this.findOne({ slug: slug.toLowerCase(), isActive: true });
};

/**
 * Find a plan by Stripe Price ID
 * @param {string} stripePriceId - Stripe Price ID
 * @returns {Promise<Object|null>} - The plan or null
 */
subscriptionPlanSchema.statics.findByStripePriceId = async function (stripePriceId) {
  return this.findOne({ stripePriceId });
};

/**
 * Get the default plan for a role
 * @param {string} role - User role
 * @returns {Promise<Object|null>} - The default plan or null
 */
subscriptionPlanSchema.statics.getDefaultForRole = async function (role) {
  return this.findOne({
    targetRole: role,
    isActive: true,
    isDefault: true,
  });
};

/**
 * Get all active plans grouped by role
 * @returns {Promise<Object>} - Plans grouped by role
 */
subscriptionPlanSchema.statics.getAllGroupedByRole = async function () {
  const plans = await this.find({ isActive: true }).sort({ targetRole: 1, sortOrder: 1 });

  return plans.reduce((acc, plan) => {
    if (!acc[plan.targetRole]) {
      acc[plan.targetRole] = [];
    }
    acc[plan.targetRole].push(plan);
    return acc;
  }, {});
};

/**
 * Check if a plan includes a specific feature
 * @param {string} featureKey - Feature key to check
 * @returns {boolean} - true if feature is included
 */
subscriptionPlanSchema.methods.hasFeature = function (featureKey) {
  return this.features.includes(featureKey.toLowerCase());
};

/**
 * Get the limit value for a specific limit type
 * @param {string} limitKey - Limit key (e.g., 'featuredListings')
 * @returns {number|null} - Limit value or null for unlimited
 */
subscriptionPlanSchema.methods.getLimit = function (limitKey) {
  return this.limits && this.limits[limitKey] !== undefined ? this.limits[limitKey] : null;
};

/**
 * Initialize default plans if they don't exist
 * Called during seeding
 * @returns {Promise<void>}
 */
subscriptionPlanSchema.statics.initializeDefaults = async function () {
  const defaults = [
    // Teacher Creator Plan
    {
      name: "Creator",
      slug: "teacher-creator",
      description: "Upload and sell teaching resources on the marketplace",
      targetRole: "teacher",
      price: mongoose.Types.Decimal128.fromString("500"), // £5.00 in pence
      currency: "GBP",
      billingPeriod: "annual",
      features: ["resource_upload", "resource_sell", "analytics_dashboard"],
      limits: {
        resourceUploads: null, // unlimited
      },
      trialDays: 0,
      isActive: true,
      isDefault: true,
      sortOrder: 1,
      highlight: null,
      discountPercent: 60, // 60% launch discount
      discountExpiresAt: new Date(Date.now() + 10 * 30 * 24 * 60 * 60 * 1000), // 10 months from now
    },
    // School Basic Plan
    {
      name: "Basic",
      slug: "school-basic",
      description: "Essential tools for school recruitment",
      targetRole: "school",
      price: mongoose.Types.Decimal128.fromString("4900"), // £49.00 in pence
      currency: "GBP",
      billingPeriod: "monthly",
      features: ["featured_listing"],
      limits: {
        featuredListings: 5,
        candidateSearches: 0,
      },
      trialDays: 14,
      isActive: true,
      isDefault: false,
      sortOrder: 1,
    },
    // School Professional Plan
    {
      name: "Professional",
      slug: "school-professional",
      description: "Advanced recruitment tools for growing schools",
      targetRole: "school",
      price: mongoose.Types.Decimal128.fromString("9900"), // £99.00 in pence
      currency: "GBP",
      billingPeriod: "monthly",
      features: ["featured_listing", "candidate_search", "analytics_dashboard"],
      limits: {
        featuredListings: 15,
        candidateSearches: 50,
      },
      trialDays: 14,
      isActive: true,
      isDefault: true,
      sortOrder: 2,
      highlight: "Most Popular",
    },
    // School Enterprise Plan
    {
      name: "Enterprise",
      slug: "school-enterprise",
      description: "Full suite of recruitment tools for large institutions",
      targetRole: "school",
      price: mongoose.Types.Decimal128.fromString("19900"), // £199.00 in pence
      currency: "GBP",
      billingPeriod: "monthly",
      features: [
        "featured_listing",
        "candidate_search",
        "bulk_messaging",
        "analytics_dashboard",
        "priority_support",
      ],
      limits: {
        featuredListings: null, // unlimited
        candidateSearches: null, // unlimited
        bulkMessages: 100,
      },
      trialDays: 14,
      isActive: true,
      isDefault: false,
      sortOrder: 3,
      highlight: "Best Value",
    },
  ];

  for (const plan of defaults) {
    const exists = await this.findOne({ slug: plan.slug });
    if (!exists) {
      await this.create(plan);
    }
  }
};

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

module.exports = SubscriptionPlan;
