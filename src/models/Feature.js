const mongoose = require("mongoose");

/**
 * Feature Model
 * Defines gateable capabilities that can be included in subscription plans.
 * Each feature has a unique key used for access control checks.
 *
 * Features are assigned to subscription plans, and users with active
 * subscriptions gain access to the features included in their plan.
 */
const featureSchema = new mongoose.Schema(
  {
    // Unique identifier for the feature (used in code)
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Display name for UI
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Detailed description of the feature
    description: {
      type: String,
      trim: true,
    },
    // Category for grouping features
    category: {
      type: String,
      enum: ["marketplace", "jobs", "search", "premium", "admin"],
      required: true,
      index: true,
    },
    // Which roles can potentially access this feature (with subscription)
    applicableRoles: {
      type: [String],
      enum: ["teacher", "school", "recruiter", "supplier"],
      required: true,
    },
    // Whether this feature is currently active/available
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Sort order for display
    sortOrder: {
      type: Number,
      default: 0,
    },
    // Icon name for UI (optional)
    icon: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
featureSchema.index({ category: 1, isActive: 1 });
featureSchema.index({ applicableRoles: 1, isActive: 1 });

/**
 * Find a feature by its unique key
 * @param {string} key - Feature key
 * @returns {Promise<Object|null>} - The feature or null
 */
featureSchema.statics.findByKey = async function (key) {
  return this.findOne({ key: key.toLowerCase(), isActive: true });
};

/**
 * Get all active features
 * @returns {Promise<Array>} - Array of active features
 */
featureSchema.statics.getActiveFeatures = async function () {
  return this.find({ isActive: true }).sort({ category: 1, sortOrder: 1 });
};

/**
 * Get active features by category
 * @param {string} category - Feature category
 * @returns {Promise<Array>} - Array of features in the category
 */
featureSchema.statics.getByCategory = async function (category) {
  return this.find({ category, isActive: true }).sort({ sortOrder: 1 });
};

/**
 * Get features applicable to a specific role
 * @param {string} role - User role
 * @returns {Promise<Array>} - Array of applicable features
 */
featureSchema.statics.getByRole = async function (role) {
  return this.find({
    applicableRoles: role,
    isActive: true,
  }).sort({ category: 1, sortOrder: 1 });
};

/**
 * Check if a feature key exists and is active
 * @param {string} key - Feature key
 * @returns {Promise<boolean>} - true if feature exists and is active
 */
featureSchema.statics.exists = async function (key) {
  const count = await this.countDocuments({ key: key.toLowerCase(), isActive: true });
  return count > 0;
};

/**
 * Get feature keys as a simple array
 * @returns {Promise<Array<string>>} - Array of feature keys
 */
featureSchema.statics.getAllKeys = async function () {
  const features = await this.find({ isActive: true }).select("key");
  return features.map((f) => f.key);
};

/**
 * Initialize default features if they don't exist
 * Called during application startup or seeding
 * @returns {Promise<void>}
 */
featureSchema.statics.initializeDefaults = async function () {
  const defaults = [
    // Teacher/Marketplace features
    {
      key: "resource_upload",
      name: "Resource Upload",
      description: "Upload teaching resources to the marketplace",
      category: "marketplace",
      applicableRoles: ["teacher"],
      sortOrder: 1,
      icon: "upload",
    },
    {
      key: "resource_sell",
      name: "Resource Selling",
      description: "Sell teaching resources on the marketplace",
      category: "marketplace",
      applicableRoles: ["teacher"],
      sortOrder: 2,
      icon: "shopping-cart",
    },
    // School/Jobs features
    {
      key: "featured_listing",
      name: "Featured Job Listings",
      description: "Highlight job postings for increased visibility",
      category: "jobs",
      applicableRoles: ["school"],
      sortOrder: 1,
      icon: "star",
    },
    {
      key: "candidate_search",
      name: "Candidate Search",
      description: "Search and filter teacher profiles and CVs",
      category: "search",
      applicableRoles: ["school"],
      sortOrder: 1,
      icon: "search",
    },
    {
      key: "bulk_messaging",
      name: "Bulk Messaging",
      description: "Send messages to multiple candidates at once",
      category: "premium",
      applicableRoles: ["school"],
      sortOrder: 2,
      icon: "mail",
    },
    {
      key: "analytics_dashboard",
      name: "Analytics Dashboard",
      description: "Access detailed analytics and insights",
      category: "premium",
      applicableRoles: ["school", "teacher"],
      sortOrder: 3,
      icon: "bar-chart",
    },
    {
      key: "priority_support",
      name: "Priority Support",
      description: "Access to priority customer support",
      category: "premium",
      applicableRoles: ["school", "teacher"],
      sortOrder: 4,
      icon: "headphones",
    },
  ];

  for (const feature of defaults) {
    const exists = await this.findOne({ key: feature.key });
    if (!exists) {
      await this.create(feature);
    }
  }
};

const Feature = mongoose.model("Feature", featureSchema);

module.exports = Feature;
