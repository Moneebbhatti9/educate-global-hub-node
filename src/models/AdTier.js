const mongoose = require("mongoose");

/**
 * AdTier Model
 * Stores ad pricing tiers for the job advertisement system.
 * Admin-configurable tiers that schools can purchase to promote jobs.
 *
 * Pricing from Excel Revenue Streams:
 * - Featured Job Listing: £100/listing normal, £40/listing launch (60% off)
 * - Display Advertising: £200/month normal, £80/month launch (60% off)
 */
const adTierSchema = new mongoose.Schema(
  {
    // Tier name for display (e.g., "Featured Job Listing", "Display Ad (Banner)")
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // URL-friendly identifier
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Detailed description of what this tier includes
    description: {
      type: String,
      trim: true,
    },
    // Normal price in pence (GBP) - using Decimal128 for precision
    normalPrice: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    // Launch/promotional price in pence (GBP)
    launchPrice: {
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
    // Duration in days (e.g., 30 for monthly display ad, 0 for per-listing)
    durationDays: {
      type: Number,
      required: true,
      min: 0,
    },
    // Human-readable duration label (e.g., "Per listing", "30 days")
    durationLabel: {
      type: String,
      required: true,
      trim: true,
    },
    // Features included in this tier
    features: {
      type: [String],
      default: [],
    },
    // Whether the plan is currently available for purchase
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Sort order for display on pricing cards
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
    // Stripe Product ID (synced when tier is created in Stripe)
    stripeProductId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Stripe Price ID for normal price
    stripePriceId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Stripe Price ID for launch/promotional price
    stripeLaunchPriceId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Whether launch pricing is currently active
    isLaunchPricing: {
      type: Boolean,
      default: true,
    },
    // Launch pricing expiry date
    launchPricingExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// Compound indexes for efficient queries
adTierSchema.index({ isActive: 1, sortOrder: 1 });

/**
 * Virtual: Get the current effective price (launch or normal)
 */
adTierSchema.virtual("effectivePrice").get(function () {
  if (this.isLaunchPricing) {
    const now = new Date();
    if (!this.launchPricingExpiresAt || this.launchPricingExpiresAt > now) {
      return this.launchPrice ? parseFloat(this.launchPrice.toString()) : 0;
    }
  }
  return this.normalPrice ? parseFloat(this.normalPrice.toString()) : 0;
});

/**
 * Virtual: Check if launch pricing is currently active
 */
adTierSchema.virtual("hasActiveLaunchPricing").get(function () {
  if (!this.isLaunchPricing) return false;
  if (!this.launchPricingExpiresAt) return true;
  return this.launchPricingExpiresAt > new Date();
});

/**
 * Virtual: Get the current active Stripe Price ID
 */
adTierSchema.virtual("activeStripePriceId").get(function () {
  if (this.hasActiveLaunchPricing && this.stripeLaunchPriceId) {
    return this.stripeLaunchPriceId;
  }
  return this.stripePriceId;
});

/**
 * Find all active tiers sorted by sortOrder
 * @returns {Promise<Array>} - Array of active tiers
 */
adTierSchema.statics.findActive = async function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1 });
};

/**
 * Find a tier by slug
 * @param {string} slug - Tier slug
 * @returns {Promise<Object|null>} - The tier or null
 */
adTierSchema.statics.findBySlug = async function (slug) {
  return this.findOne({ slug: slug.toLowerCase(), isActive: true });
};

/**
 * Find a tier by Stripe Price ID (checks both normal and launch prices)
 * @param {string} stripePriceId - Stripe Price ID
 * @returns {Promise<Object|null>} - The tier or null
 */
adTierSchema.statics.findByStripePriceId = async function (stripePriceId) {
  return this.findOne({
    $or: [
      { stripePriceId: stripePriceId },
      { stripeLaunchPriceId: stripePriceId },
    ],
  });
};

/**
 * Initialize default ad tiers from Excel pricing data
 * Called during seeding
 * @returns {Promise<void>}
 */
adTierSchema.statics.initializeDefaults = async function () {
  const defaults = [
    {
      name: "Featured Job Listing",
      slug: "featured-job-listing",
      description:
        "Highlight your job posting to attract more qualified candidates",
      normalPrice: mongoose.Types.Decimal128.fromString("10000"), // £100.00 in pence
      launchPrice: mongoose.Types.Decimal128.fromString("4000"), // £40.00 in pence
      currency: "GBP",
      durationDays: 0, // Per listing (linked to job duration)
      durationLabel: "Per listing",
      features: [
        "Priority placement in search results",
        "Featured badge on listing",
        "Highlighted in job alerts",
      ],
      isActive: true,
      sortOrder: 1,
      isLaunchPricing: true,
      launchPricingExpiresAt: new Date(
        Date.now() + 10 * 30 * 24 * 60 * 60 * 1000
      ), // 10 months
    },
    {
      name: "Display Ad (Banner)",
      slug: "display-ad-banner",
      description:
        "Showcase your job with a banner ad in the auto-scrolling carousel on the Jobs page",
      normalPrice: mongoose.Types.Decimal128.fromString("20000"), // £200.00 in pence
      launchPrice: mongoose.Types.Decimal128.fromString("8000"), // £80.00 in pence
      currency: "GBP",
      durationDays: 30, // 1 month
      durationLabel: "30 days",
      features: [
        "Banner ad in Jobs page carousel",
        "Custom banner image (1200x400px)",
        "Direct link to job listing",
        "Sponsored badge",
        "Auto-scrolling visibility",
      ],
      isActive: true,
      sortOrder: 2,
      highlight: "Most Popular",
      isLaunchPricing: true,
      launchPricingExpiresAt: new Date(
        Date.now() + 10 * 30 * 24 * 60 * 60 * 1000
      ), // 10 months
    },
  ];

  for (const tier of defaults) {
    const exists = await this.findOne({ slug: tier.slug });
    if (!exists) {
      await this.create(tier);
    }
  }
};

const AdTier = mongoose.model("AdTier", adTierSchema);

module.exports = AdTier;
