const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1000, "Minimum withdrawal amount is £10 / $10"], // Amount in smallest unit (pence/cents)
    },
    currency: {
      type: String,
      enum: ["GBP", "USD", "EUR", "PKR"],
      default: "GBP",
      required: true,
    },
    payoutMethod: {
      type: String,
      enum: ["stripe", "paypal", "bank_transfer"],
      required: true,
    },
    payoutDetails: {
      // Stripe Connect
      stripeAccountId: String,
      stripeAccountHolderName: String,

      // PayPal
      paypalEmail: String,
      paypalAccountName: String,

      // Bank Transfer
      bankAccountHolder: String,
      bankName: String,
      accountNumber: String,
      sortCode: String,
      iban: String,
      swift: String,

      // Common
      country: String,
    },
    feeAmount: {
      type: Number,
      default: 0,
      comment: "Transaction fee charged by payout method",
    },
    netAmount: {
      type: Number,
      required: true,
      comment: "Amount after fees",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    failureReason: {
      type: String,
    },
    // Stripe-specific fields
    stripeTransferId: {
      type: String,
      unique: true,
      sparse: true,
    },
    stripePayoutId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // PayPal-specific fields
    paypalPayoutBatchId: {
      type: String,
    },
    paypalPayoutItemId: {
      type: String,
    },
    // Bank transfer tracking
    bankTransferReference: {
      type: String,
    },
    // Admin notes
    adminNotes: {
      type: String,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
withdrawalRequestSchema.index({ seller: 1, requestedAt: -1 });
withdrawalRequestSchema.index({ seller: 1, status: 1 });
withdrawalRequestSchema.index({ status: 1, requestedAt: 1 });

// Virtual for seller details
withdrawalRequestSchema.virtual("sellerDetails", {
  ref: "User",
  localField: "seller",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included in JSON
withdrawalRequestSchema.set("toJSON", { virtuals: true });
withdrawalRequestSchema.set("toObject", { virtuals: true });

// Static method to check if seller can withdraw (once per week rule)
withdrawalRequestSchema.statics.canSellerWithdraw = async function (sellerId) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentWithdrawal = await this.findOne({
    seller: sellerId,
    status: { $in: ["completed", "processing", "pending"] },
    requestedAt: { $gte: oneWeekAgo },
  }).sort({ requestedAt: -1 });

  return {
    canWithdraw: !recentWithdrawal,
    lastWithdrawal: recentWithdrawal,
    daysRemaining: recentWithdrawal
      ? Math.ceil(
          (7 - (new Date() - recentWithdrawal.requestedAt) / (1000 * 60 * 60 * 24))
        )
      : 0,
  };
};

// Instance method to process withdrawal
withdrawalRequestSchema.methods.markAsProcessing = function () {
  this.status = "processing";
  this.processedAt = new Date();
  return this.save();
};

// Instance method to complete withdrawal
withdrawalRequestSchema.methods.markAsCompleted = function (transactionId) {
  this.status = "completed";
  this.completedAt = new Date();

  if (this.payoutMethod === "stripe") {
    this.stripePayoutId = transactionId;
  } else if (this.payoutMethod === "paypal") {
    this.paypalPayoutBatchId = transactionId;
  } else if (this.payoutMethod === "bank_transfer") {
    this.bankTransferReference = transactionId;
  }

  return this.save();
};

// Instance method to fail withdrawal
withdrawalRequestSchema.methods.markAsFailed = function (reason) {
  this.status = "failed";
  this.failureReason = reason;
  return this.save();
};

const WithdrawalRequest = mongoose.model(
  "WithdrawalRequest",
  withdrawalRequestSchema
);

module.exports = WithdrawalRequest;
