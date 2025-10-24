const mongoose = require("mongoose");

const taxInfoSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    country: {
      type: String,
      required: true,
    },
    // VAT Information (for UK/EU sellers)
    isVATRegistered: {
      type: Boolean,
      default: false,
    },
    vatNumber: {
      type: String,
      sparse: true,
    },
    vatCountry: {
      type: String,
    },
    // US Tax Information
    isUSPerson: {
      type: Boolean,
      default: false,
    },
    taxIdType: {
      type: String,
      enum: ["SSN", "EIN", "ITIN", "OTHER"],
    },
    taxIdNumber: {
      type: String,
      select: false, // Don't include in queries by default for security
    },
    taxFormType: {
      type: String,
      enum: ["W9", "W8BEN", "W8BEN-E", "OTHER"],
    },
    taxFormUrl: {
      type: String,
      comment: "URL to uploaded tax form document",
    },
    taxFormUploadedAt: {
      type: Date,
    },
    // Additional tax documents
    additionalDocuments: [
      {
        name: String,
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Business Information
    businessType: {
      type: String,
      enum: ["individual", "sole_proprietor", "partnership", "corporation", "llc"],
      default: "individual",
    },
    businessName: {
      type: String,
    },
    businessAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    // Verification status
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verificationNotes: {
      type: String,
    },
    // Tax settings
    taxWithholdingRate: {
      type: Number,
      default: 0,
      comment: "Percentage to withhold for tax purposes",
    },
    exemptFromWithholding: {
      type: Boolean,
      default: false,
    },
    // Compliance
    lastReviewedAt: {
      type: Date,
    },
    nextReviewDue: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for seller details
taxInfoSchema.virtual("sellerDetails", {
  ref: "User",
  localField: "seller",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included in JSON
taxInfoSchema.set("toJSON", { virtuals: true });
taxInfoSchema.set("toObject", { virtuals: true });

// Instance method to check if tax info is complete
taxInfoSchema.methods.isComplete = function () {
  if (!this.country) return false;

  // For US persons, require tax form
  if (this.isUSPerson) {
    return !!(this.taxFormType && this.taxFormUrl);
  }

  // For VAT registered sellers, require VAT number
  if (this.isVATRegistered) {
    return !!(this.vatNumber && this.vatCountry);
  }

  return true;
};

// Instance method to mark as verified
taxInfoSchema.methods.verify = function (adminId, notes) {
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  this.verificationNotes = notes;
  this.lastReviewedAt = new Date();

  // Set next review date (1 year from now)
  const nextReview = new Date();
  nextReview.setFullYear(nextReview.getFullYear() + 1);
  this.nextReviewDue = nextReview;

  return this.save();
};

// Static method to find sellers needing tax review
taxInfoSchema.statics.findNeedingReview = async function () {
  return this.find({
    $or: [
      { isVerified: false },
      { nextReviewDue: { $lte: new Date() } },
      { nextReviewDue: null },
    ],
  })
    .populate("seller", "email firstName lastName")
    .sort({ createdAt: 1 });
};

const TaxInfo = mongoose.model("TaxInfo", taxInfoSchema);

module.exports = TaxInfo;
