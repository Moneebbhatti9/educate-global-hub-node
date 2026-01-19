const mongoose = require("mongoose");

const resourcePurchaseSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pricePaid: { type: Number, required: true }, // snapshot at time of purchase
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "refunded", "expired"],
      default: "completed",
    },
    purchasedAt: { type: Date, default: Date.now },

    // License Information
    license: {
      type: {
        type: String,
        enum: ["single", "department", "school"],
        default: "single",
      },
      // Number of teachers allowed under this license
      maxUsers: {
        type: Number,
        default: 1,
      },
      // For school/department licenses - verified domain
      schoolDomain: {
        type: String,
        default: null,
      },
      // School/Institution name for display
      institutionName: {
        type: String,
        default: null,
      },
      // License expiration (null = perpetual)
      expiresAt: {
        type: Date,
        default: null,
      },
    },

    // Track users who have accessed under this license (for school/department)
    authorizedUsers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      email: String,
      emailHash: String, // SHA-256 hash for GDPR compliance
      firstAccessAt: Date,
      lastAccessAt: Date,
      downloadCount: {
        type: Number,
        default: 0,
      },
    }],

    // Payment details
    paymentDetails: {
      stripePaymentIntentId: String,
      stripeSessionId: String,
      paymentMethod: String,
    },

    // Pricing breakdown
    priceBreakdown: {
      basePrice: Number,
      licenseMultiplier: {
        type: Number,
        default: 1,
      },
      vatAmount: Number,
      platformFee: Number,
      sellerEarnings: Number,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
resourcePurchaseSchema.index({ resourceId: 1, buyerId: 1 });
resourcePurchaseSchema.index({ buyerId: 1, status: 1 });
resourcePurchaseSchema.index({ "license.schoolDomain": 1 });
resourcePurchaseSchema.index({ "authorizedUsers.userId": 1 });

// Static method to check if a user has access to a resource
resourcePurchaseSchema.statics.checkAccess = async function(resourceId, userId, userEmail) {
  // First check if user is the direct buyer
  const directPurchase = await this.findOne({
    resourceId,
    buyerId: userId,
    status: "completed",
  });

  if (directPurchase) {
    return {
      hasAccess: true,
      purchase: directPurchase,
      accessType: "buyer",
    };
  }

  // Check if user has access through a school/department license
  if (userEmail) {
    const domain = userEmail.split("@")[1];

    // Find any school license for this resource with matching domain
    const schoolPurchase = await this.findOne({
      resourceId,
      status: "completed",
      "license.type": { $in: ["department", "school"] },
      "license.schoolDomain": domain,
    });

    if (schoolPurchase) {
      // Check if max users limit is reached
      const currentUsers = schoolPurchase.authorizedUsers?.length || 0;
      const maxUsers = schoolPurchase.license.maxUsers || 10;

      // Check if user is already authorized
      const isAuthorized = schoolPurchase.authorizedUsers?.some(
        (u) => u.userId?.toString() === userId.toString()
      );

      if (isAuthorized || currentUsers < maxUsers) {
        return {
          hasAccess: true,
          purchase: schoolPurchase,
          accessType: "school_license",
          isNewUser: !isAuthorized,
        };
      } else {
        return {
          hasAccess: false,
          reason: "license_limit_reached",
          currentUsers,
          maxUsers,
        };
      }
    }
  }

  return {
    hasAccess: false,
    reason: "no_purchase",
  };
};

// Static method to add authorized user to a school license
resourcePurchaseSchema.statics.addAuthorizedUser = async function(purchaseId, userId, userEmail) {
  const crypto = require("crypto");
  const emailHash = crypto.createHash("sha256").update(userEmail.toLowerCase()).digest("hex");

  return await this.findByIdAndUpdate(
    purchaseId,
    {
      $push: {
        authorizedUsers: {
          userId,
          email: userEmail.split("@")[0] + "@***", // Partially masked for privacy
          emailHash,
          firstAccessAt: new Date(),
          lastAccessAt: new Date(),
          downloadCount: 1,
        },
      },
    },
    { new: true }
  );
};

// Static method to update authorized user's access
resourcePurchaseSchema.statics.updateUserAccess = async function(purchaseId, userId) {
  return await this.findOneAndUpdate(
    {
      _id: purchaseId,
      "authorizedUsers.userId": userId,
    },
    {
      $set: { "authorizedUsers.$.lastAccessAt": new Date() },
      $inc: { "authorizedUsers.$.downloadCount": 1 },
    },
    { new: true }
  );
};

// Static method to get license utilization stats
resourcePurchaseSchema.statics.getLicenseUtilization = async function(purchaseId) {
  const purchase = await this.findById(purchaseId);
  if (!purchase) return null;

  return {
    licenseType: purchase.license.type,
    maxUsers: purchase.license.maxUsers,
    currentUsers: purchase.authorizedUsers?.length || 0,
    remainingSlots: Math.max(0, (purchase.license.maxUsers || 1) - (purchase.authorizedUsers?.length || 0)),
    users: purchase.authorizedUsers?.map((u) => ({
      emailHash: u.emailHash,
      firstAccess: u.firstAccessAt,
      lastAccess: u.lastAccessAt,
      downloads: u.downloadCount,
    })),
  };
};

module.exports = mongoose.model("ResourcePurchase", resourcePurchaseSchema);
