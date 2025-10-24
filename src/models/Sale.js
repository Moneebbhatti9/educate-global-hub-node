const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["GBP", "USD", "EUR", "PKR"],
      default: "GBP",
      required: true,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    transactionFee: {
      type: Number,
      default: 0,
      comment: "20p/20c fee for items under £3/$3",
    },
    platformCommission: {
      type: Number,
      required: true,
      comment: "Platform's share based on seller tier",
    },
    sellerEarnings: {
      type: Number,
      required: true,
      comment: "Net royalty paid to seller after VAT, fees, and commission",
    },
    royaltyRate: {
      type: Number,
      required: true,
      comment: "Seller's royalty rate at time of sale (0.60, 0.70, or 0.80)",
    },
    sellerTier: {
      type: String,
      enum: ["Bronze", "Silver", "Gold"],
      required: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    license: {
      type: String,
      enum: ["single", "school", "bundle"],
      default: "single",
    },
    status: {
      type: String,
      enum: ["completed", "refunded", "disputed", "pending"],
      default: "completed",
      index: true,
    },
    stripeChargeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    stripePaymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    buyerEmail: {
      type: String,
    },
    buyerCountry: {
      type: String,
    },
    refundedAt: {
      type: Date,
    },
    refundReason: {
      type: String,
    },
    disputeDetails: {
      disputeId: String,
      status: String,
      reason: String,
      createdAt: Date,
      resolvedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
saleSchema.index({ seller: 1, saleDate: -1 });
saleSchema.index({ seller: 1, status: 1 });
saleSchema.index({ resource: 1, saleDate: -1 });
saleSchema.index({ stripeChargeId: 1 }, { sparse: true });

// Virtual for resource details
saleSchema.virtual("resourceDetails", {
  ref: "Resource",
  localField: "resource",
  foreignField: "_id",
  justOne: true,
});

// Virtual for seller details
saleSchema.virtual("sellerDetails", {
  ref: "User",
  localField: "seller",
  foreignField: "_id",
  justOne: true,
});

// Virtual for buyer details
saleSchema.virtual("buyerDetails", {
  ref: "User",
  localField: "buyer",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included in JSON
saleSchema.set("toJSON", { virtuals: true });
saleSchema.set("toObject", { virtuals: true });

// Static method to calculate seller's total sales for tier calculation
saleSchema.statics.calculateSellerSales = async function (sellerId, months = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await this.aggregate([
    {
      $match: {
        seller: mongoose.Types.ObjectId(sellerId),
        status: { $in: ["completed"] },
        saleDate: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: { $subtract: ["$price", "$vatAmount"] } },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0 ? result[0] : { totalSales: 0, count: 0 };
};

// Static method to get seller's earnings summary
saleSchema.statics.getSellerEarnings = async function (sellerId, currency = "GBP") {
  const result = await this.aggregate([
    {
      $match: {
        seller: mongoose.Types.ObjectId(sellerId),
        currency: currency,
        status: { $in: ["completed"] },
      },
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: "$sellerEarnings" },
        totalSales: { $sum: 1 },
        avgEarnings: { $avg: "$sellerEarnings" },
      },
    },
  ]);

  return result.length > 0
    ? result[0]
    : { totalEarnings: 0, totalSales: 0, avgEarnings: 0 };
};

const Sale = mongoose.model("Sale", saleSchema);

module.exports = Sale;
