const mongoose = require("mongoose");

/**
 * SystemSettings Model
 * Stores global configuration as key-value pairs with type safety.
 * Uses singleton pattern - one document per setting key.
 *
 * Primary use: Global subscription toggle (subscriptions-enabled)
 */
const systemSettingsSchema = new mongoose.Schema(
  {
    // Unique key identifier for the setting
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Setting value with flexible type support
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Value type for validation and parsing
    valueType: {
      type: String,
      enum: ["boolean", "string", "number", "object", "array"],
      required: true,
    },
    // Human-readable description
    description: {
      type: String,
      trim: true,
    },
    // Category for grouping settings
    category: {
      type: String,
      enum: ["subscriptions", "features", "platform", "notifications", "security"],
      default: "platform",
    },
    // Whether this setting can be modified via admin UI
    isEditable: {
      type: Boolean,
      default: true,
    },
    // Track who last updated
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient lookups by category
systemSettingsSchema.index({ category: 1 });

/**
 * Get a setting value by key
 * @param {string} key - Setting key
 * @param {any} defaultValue - Default value if setting doesn't exist
 * @returns {Promise<any>} - The setting value or default
 */
systemSettingsSchema.statics.getValue = async function (key, defaultValue = null) {
  const setting = await this.findOne({ key: key.toLowerCase() });
  return setting ? setting.value : defaultValue;
};

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {any} value - Value to set
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The updated/created setting
 */
systemSettingsSchema.statics.setValue = async function (key, value, options = {}) {
  const {
    valueType = typeof value,
    description,
    category = "platform",
    isEditable = true,
    updatedBy,
  } = options;

  const setting = await this.findOneAndUpdate(
    { key: key.toLowerCase() },
    {
      key: key.toLowerCase(),
      value,
      valueType,
      description,
      category,
      isEditable,
      lastUpdatedBy: updatedBy,
    },
    { upsert: true, new: true, runValidators: true }
  );

  return setting;
};

/**
 * Check if subscriptions are enabled globally
 * @returns {Promise<boolean>} - true if subscriptions are enabled
 */
systemSettingsSchema.statics.isSubscriptionEnabled = async function () {
  const value = await this.getValue("subscriptions-enabled", true);
  return Boolean(value);
};

/**
 * Toggle subscription enforcement
 * @param {boolean} enabled - Whether to enable subscriptions
 * @param {ObjectId} updatedBy - User ID who made the change
 * @returns {Promise<Object>} - The updated setting
 */
systemSettingsSchema.statics.setSubscriptionEnabled = async function (enabled, updatedBy = null) {
  return this.setValue("subscriptions-enabled", Boolean(enabled), {
    valueType: "boolean",
    description: "Global toggle for subscription enforcement. When OFF, all features are free.",
    category: "subscriptions",
    isEditable: true,
    updatedBy,
  });
};

/**
 * Get all settings in a category
 * @param {string} category - Category name
 * @returns {Promise<Array>} - Array of settings in the category
 */
systemSettingsSchema.statics.getByCategory = async function (category) {
  return this.find({ category }).sort({ key: 1 });
};

/**
 * Get all settings as a key-value object
 * @returns {Promise<Object>} - Object with all settings
 */
systemSettingsSchema.statics.getAllAsObject = async function () {
  const settings = await this.find({});
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
};

/**
 * Initialize default settings if they don't exist
 * Called during application startup
 * @returns {Promise<void>}
 */
systemSettingsSchema.statics.initializeDefaults = async function () {
  const defaults = [
    {
      key: "subscriptions-enabled",
      value: true,
      valueType: "boolean",
      description: "Global toggle for subscription enforcement. When OFF, all features are free.",
      category: "subscriptions",
    },
  ];

  for (const setting of defaults) {
    const exists = await this.findOne({ key: setting.key });
    if (!exists) {
      await this.create(setting);
    }
  }
};

const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);

module.exports = SystemSettings;
