const mongoose = require("mongoose");

const balanceLedgerSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit", "fee", "refund", "adjustment"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["GBP", "USD", "EUR", "PKR"],
      default: "GBP",
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
      comment: "Running balance after this transaction",
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    referenceType: {
      type: String,
      enum: ["sale", "withdrawal", "refund", "adjustment", "fee"],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "referenceModel",
    },
    referenceModel: {
      type: String,
      enum: ["Sale", "WithdrawalRequest"],
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      comment: "Additional data like resource title, buyer info, etc.",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
balanceLedgerSchema.index({ seller: 1, date: -1 });
balanceLedgerSchema.index({ seller: 1, currency: 1, date: -1 });
balanceLedgerSchema.index({ seller: 1, type: 1, date: -1 });

// Static method to calculate current balance
balanceLedgerSchema.statics.getCurrentBalance = async function (
  sellerId,
  currency = "GBP"
) {
  const latestEntry = await this.findOne({
    seller: sellerId,
    currency: currency,
  })
    .sort({ date: -1 })
    .select("balanceAfter");

  return latestEntry ? latestEntry.balanceAfter : 0;
};

// Static method to get balance breakdown
balanceLedgerSchema.statics.getBalanceBreakdown = async function (
  sellerId,
  currency = "GBP"
) {
  const result = await this.aggregate([
    {
      $match: {
        seller: new mongoose.Types.ObjectId(sellerId),
        currency: currency,
      },
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const breakdown = {
    credits: 0,
    debits: 0,
    fees: 0,
    refunds: 0,
    adjustments: 0,
  };

  result.forEach((item) => {
    if (item._id === "credit") breakdown.credits = item.total;
    else if (item._id === "debit") breakdown.debits = Math.abs(item.total);
    else if (item._id === "fee") breakdown.fees = Math.abs(item.total);
    else if (item._id === "refund") breakdown.refunds = Math.abs(item.total);
    else if (item._id === "adjustment") breakdown.adjustments = item.total;
  });

  return breakdown;
};

// Static method to create ledger entry with balance calculation
balanceLedgerSchema.statics.createEntry = async function (data) {
  // Get current balance
  const currentBalance = await this.getCurrentBalance(data.seller, data.currency);

  // Calculate new balance
  let balanceChange = data.amount;
  if (data.type === "debit" || data.type === "fee") {
    balanceChange = -Math.abs(data.amount);
  }

  const newBalance = currentBalance + balanceChange;

  // Create entry
  return this.create({
    ...data,
    balanceAfter: newBalance,
  });
};

const BalanceLedger = mongoose.model("BalanceLedger", balanceLedgerSchema);

module.exports = BalanceLedger;
