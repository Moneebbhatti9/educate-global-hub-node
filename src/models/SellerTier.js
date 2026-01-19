const mongoose = require("mongoose");

const sellerTierSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    currentTier: {
      type: String,
      enum: ["Bronze", "Silver", "Gold"],
      default: "Bronze",
      required: true,
    },
    royaltyRate: {
      type: Number,
      required: true,
      default: 0.6,
      comment: "Current royalty rate: 0.6 (Bronze), 0.7 (Silver), 0.8 (Gold)",
    },
    // Rolling 12-month sales data
    last12MonthsSales: {
      type: Number,
      default: 0,
      comment: "Total sales (net of VAT) in last 12 months",
    },
    last12MonthsCount: {
      type: Number,
      default: 0,
      comment: "Number of sales in last 12 months",
    },
    // Lifetime stats
    lifetimeSales: {
      type: Number,
      default: 0,
    },
    lifetimeEarnings: {
      type: Number,
      default: 0,
    },
    lifetimeSalesCount: {
      type: Number,
      default: 0,
    },
    // Tier history
    tierHistory: [
      {
        tier: {
          type: String,
          enum: ["Bronze", "Silver", "Gold"],
        },
        achievedAt: {
          type: Date,
          default: Date.now,
        },
        salesAtTierChange: Number,
      },
    ],
    // Last tier calculation
    lastCalculatedAt: {
      type: Date,
      default: Date.now,
    },
    nextCalculationDue: {
      type: Date,
      comment: "When to recalculate tier (monthly)",
    },
    // Thresholds (in GBP, converted for other currencies)
    tierThresholds: {
      bronze: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 999.99 },
      },
      silver: {
        min: { type: Number, default: 1000 },
        max: { type: Number, default: 5999.99 },
      },
      gold: {
        min: { type: Number, default: 6000 },
        max: { type: Number, default: Infinity },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for seller details
sellerTierSchema.virtual("sellerDetails", {
  ref: "User",
  localField: "seller",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included in JSON
sellerTierSchema.set("toJSON", { virtuals: true });
sellerTierSchema.set("toObject", { virtuals: true });

// Instance method to determine tier based on sales
sellerTierSchema.methods.calculateTier = function (salesAmount) {
  if (salesAmount >= this.tierThresholds.gold.min) {
    return { tier: "Gold", rate: 0.8 };
  } else if (salesAmount >= this.tierThresholds.silver.min) {
    return { tier: "Silver", rate: 0.7 };
  } else {
    return { tier: "Bronze", rate: 0.6 };
  }
};

// Instance method to update tier
sellerTierSchema.methods.updateTier = async function (newSalesAmount) {
  const previousTier = this.currentTier;
  const { tier, rate } = this.calculateTier(newSalesAmount);

  this.last12MonthsSales = newSalesAmount;
  this.currentTier = tier;
  this.royaltyRate = rate;
  this.lastCalculatedAt = new Date();

  // Set next calculation date (1 month from now)
  const nextCalc = new Date();
  nextCalc.setMonth(nextCalc.getMonth() + 1);
  this.nextCalculationDue = nextCalc;

  // Record tier change in history
  if (previousTier !== tier) {
    this.tierHistory.push({
      tier: tier,
      achievedAt: new Date(),
      salesAtTierChange: newSalesAmount,
    });
  }

  return this.save();
};

// Static method to update all seller tiers (run monthly)
sellerTierSchema.statics.updateAllTiers = async function () {
  const Sale = require("./Sale");
  const sellers = await this.find({});

  const results = {
    updated: 0,
    upgraded: 0,
    downgraded: 0,
    unchanged: 0,
  };

  for (const sellerTierDoc of sellers) {
    try {
      // Calculate last 12 months sales
      const salesData = await Sale.calculateSellerSales(
        sellerTierDoc.seller,
        12
      );
      const previousTier = sellerTierDoc.currentTier;

      await sellerTierDoc.updateTier(salesData.totalSales);

      results.updated++;
      if (sellerTierDoc.currentTier !== previousTier) {
        const tierLevels = { Bronze: 1, Silver: 2, Gold: 3 };
        if (tierLevels[sellerTierDoc.currentTier] > tierLevels[previousTier]) {
          results.upgraded++;
        } else {
          results.downgraded++;
        }
      } else {
        results.unchanged++;
      }
    } catch (error) {
      console.error(
        `Error updating tier for seller ${sellerTierDoc.seller}:`,
        error
      );
    }
  }

  return results;
};

// Static method to get or create tier for seller
sellerTierSchema.statics.getOrCreateTier = async function (sellerId) {
  let tierDoc = await this.findOne({ seller: sellerId });

  if (!tierDoc) {
    tierDoc = await this.create({
      seller: sellerId,
      currentTier: "Bronze",
      royaltyRate: 0.6,
      last12MonthsSales: 0,
      last12MonthsCount: 0,
      tierHistory: [
        {
          tier: "Bronze",
          achievedAt: new Date(),
          salesAtTierChange: 0,
        },
      ],
    });
  }

  return tierDoc;
};

const SellerTier = mongoose.model("SellerTier", sellerTierSchema);

module.exports = SellerTier;
