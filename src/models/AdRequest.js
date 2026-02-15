const mongoose = require("mongoose");

/**
 * AdRequest Model
 * Tracks the full lifecycle of an ad request from submission to expiration.
 *
 * Flow: School submits → Admin reviews → Approved/Rejected → Payment → Active → Expired
 *
 * Status flow:
 * PENDING_REVIEW → APPROVED → PENDING_PAYMENT → ACTIVE → EXPIRED
 *                → REJECTED
 *                → CHANGES_REQUESTED → (school resubmits as new request)
 * Any pre-payment status → CANCELLED (by school)
 */

const AD_REQUEST_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "PENDING_PAYMENT",
  "REJECTED",
  "CHANGES_REQUESTED",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
];

const adRequestSchema = new mongoose.Schema(
  {
    // The job this ad promotes
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    // The school that submitted the ad request
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The ad tier selected
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdTier",
      required: true,
      index: true,
    },
    // Banner image URL (uploaded to Cloudinary)
    bannerImageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional headline text for the banner
    headline: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },
    // Optional description text for the banner
    description: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },
    // Current status of the ad request
    status: {
      type: String,
      enum: AD_REQUEST_STATUSES,
      default: "PENDING_REVIEW",
      required: true,
      index: true,
    },
    // Admin comment (required for rejection, optional for other actions)
    adminComment: {
      type: String,
      trim: true,
      default: null,
    },
    // Admin who reviewed this request
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Date when admin reviewed
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Stripe Checkout Session ID
    stripeSessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Stripe Payment Intent ID
    stripePaymentIntentId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Amount paid in pence (GBP) - Decimal128 for precision
    paidAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },
    // Currency of payment
    paidCurrency: {
      type: String,
      default: "GBP",
      uppercase: true,
    },
    // Date when payment was completed
    paidAt: {
      type: Date,
      default: null,
    },
    // Date when ad was activated (after payment)
    activatedAt: {
      type: Date,
      default: null,
    },
    // Date when ad expires
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

// Compound indexes for common queries
adRequestSchema.index({ schoolId: 1, status: 1 });
adRequestSchema.index({ status: 1, createdAt: -1 });
adRequestSchema.index({ status: 1, expiresAt: 1 }); // For expiration queries

/**
 * Virtual: Check if the ad is currently expired
 */
adRequestSchema.virtual("isExpired").get(function () {
  if (this.status !== "ACTIVE") return false;
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

/**
 * Virtual: Days remaining for active ads
 */
adRequestSchema.virtual("daysRemaining").get(function () {
  if (this.status !== "ACTIVE" || !this.expiresAt) return null;
  const now = new Date();
  if (now > this.expiresAt) return 0;
  return Math.ceil((this.expiresAt - now) / (1000 * 60 * 60 * 24));
});

/**
 * Find ad requests by school
 * @param {ObjectId} schoolId - School user ID
 * @returns {Promise<Array>}
 */
adRequestSchema.statics.findBySchool = async function (schoolId) {
  return this.find({ schoolId })
    .populate("jobId", "title organization")
    .populate("tierId", "name slug effectivePrice durationLabel")
    .sort({ createdAt: -1 });
};

/**
 * Find ad requests by status
 * @param {string} status - Ad request status
 * @returns {Promise<Array>}
 */
adRequestSchema.statics.findByStatus = async function (status) {
  return this.find({ status })
    .populate("jobId", "title organization")
    .populate("schoolId", "name email")
    .populate("tierId", "name slug effectivePrice durationLabel")
    .sort({ createdAt: -1 });
};

/**
 * Find all active, non-expired banner ads (for carousel display)
 * @returns {Promise<Array>}
 */
adRequestSchema.statics.findActiveBanners = async function () {
  const now = new Date();
  return this.find({
    status: "ACTIVE",
    $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }],
  })
    .populate("jobId", "title organization slug")
    .populate("tierId", "name sortOrder")
    .sort({ "tierId.sortOrder": 1, activatedAt: -1 });
};

/**
 * Find expired ads that need status update
 * @returns {Promise<Array>}
 */
adRequestSchema.statics.findExpiredAds = async function () {
  const now = new Date();
  return this.find({
    status: "ACTIVE",
    expiresAt: { $lte: now },
  });
};

/**
 * Expire active ads that have passed their expiration date
 * @returns {Promise<number>} - Number of ads expired
 */
adRequestSchema.statics.expireOverdueAds = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: "ACTIVE",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "EXPIRED" },
    }
  );
  return result.modifiedCount;
};

// Export status constants for use in controllers
adRequestSchema.statics.STATUSES = AD_REQUEST_STATUSES;

const AdRequest = mongoose.model("AdRequest", adRequestSchema);

module.exports = AdRequest;
