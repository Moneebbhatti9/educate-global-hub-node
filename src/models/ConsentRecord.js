const mongoose = require("mongoose");

const consentRecordSchema = new mongoose.Schema(
  {
    // User reference (can be null for anonymous consent like cookie banner)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Type of consent
    consentType: {
      type: String,
      required: true,
      enum: [
        "cookies_essential",
        "cookies_functional",
        "cookies_analytics",
        "cookies_marketing",
        "cookies_all",
        "data_processing",
        "marketing_communications",
        "terms_of_service",
        "privacy_policy",
        "third_party_sharing",
        "rectification_request",
        "deletion_request",
        "profile_visibility",
        "talent_pool",
        "newsletter",
        "other",
      ],
    },

    // Action taken
    action: {
      type: String,
      required: true,
      enum: ["granted", "withdrawn", "updated", "requested"],
    },

    // Additional preferences/details
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Version of terms/policy when consent was given
    policyVersion: {
      type: String,
      default: "1.0",
    },

    // Timestamp
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Tracking information
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },

    // Source of consent
    source: {
      type: String,
      enum: ["website", "app", "email", "api", "admin", "other"],
      default: "website",
    },

    // Proof of consent (for audit purposes)
    consentText: {
      type: String,
      default: null,
    },

    // Expiration (for time-limited consents)
    expiresAt: {
      type: Date,
      default: null,
    },

    // Whether this consent is currently active
    isActive: {
      type: Boolean,
      default: true,
    },

    // Reference to previous consent (for consent history chain)
    previousConsentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConsentRecord",
      default: null,
    },

    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
consentRecordSchema.index({ userId: 1, consentType: 1 });
consentRecordSchema.index({ userId: 1, timestamp: -1 });
consentRecordSchema.index({ consentType: 1, action: 1 });
consentRecordSchema.index({ timestamp: -1 });
consentRecordSchema.index({ userId: 1, consentType: 1, isActive: 1, expiresAt: 1 });

// Method to get latest consent for a user and type
consentRecordSchema.statics.getLatestConsent = async function (userId, consentType) {
  return this.findOne({ userId, consentType, isActive: true })
    .sort({ timestamp: -1 })
    .exec();
};

// Method to check if user has active consent
consentRecordSchema.statics.hasActiveConsent = async function (userId, consentType) {
  const consent = await this.findOne({
    userId,
    consentType,
    action: "granted",
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });
  return !!consent;
};

module.exports = mongoose.model("ConsentRecord", consentRecordSchema);
