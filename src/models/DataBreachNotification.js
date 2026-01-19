const mongoose = require("mongoose");

const dataBreachNotificationSchema = new mongoose.Schema(
  {
    // Breach identification
    breachId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },

    // Breach details
    breachDate: {
      type: Date,
      required: true,
    },
    discoveredAt: {
      type: Date,
      required: true,
    },
    notifiedAt: {
      type: Date,
      default: Date.now,
    },

    // Severity and scope
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    dataTypesAffected: [{
      type: String,
      enum: [
        "personal_identification",
        "contact_information",
        "financial_data",
        "authentication_credentials",
        "professional_data",
        "health_data",
        "location_data",
        "behavioral_data",
        "other",
      ],
    }],

    // Affected users
    affectedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    estimatedAffectedCount: {
      type: Number,
      default: 0,
    },
    isGlobalNotification: {
      type: Boolean,
      default: false,
    },

    // Response and mitigation
    immediateActions: [{
      type: String,
    }],
    recommendedUserActions: [{
      type: String,
    }],
    mitigationSteps: [{
      type: String,
    }],

    // Regulatory compliance
    supervisoryAuthorityNotified: {
      type: Boolean,
      default: false,
    },
    supervisoryAuthorityNotifiedAt: {
      type: Date,
      default: null,
    },
    supervisoryAuthorityReference: {
      type: String,
      default: null,
    },

    // Contact information
    contactEmail: {
      type: String,
      default: "gdpr@educatelink.com",
    },
    contactPhone: {
      type: String,
      default: null,
    },

    // Status tracking
    status: {
      type: String,
      enum: ["draft", "notifying", "notified", "resolved", "closed"],
      default: "draft",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: null,
    },

    // Created by (admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
dataBreachNotificationSchema.index({ breachDate: -1 });
dataBreachNotificationSchema.index({ status: 1 });
dataBreachNotificationSchema.index({ severity: 1 });
dataBreachNotificationSchema.index({ affectedUsers: 1 });

module.exports = mongoose.model("DataBreachNotification", dataBreachNotificationSchema);
