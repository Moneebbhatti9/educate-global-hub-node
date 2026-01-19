const mongoose = require("mongoose");

const platformSettingsSchema = new mongoose.Schema(
  {
    // Unique key for settings document (singleton pattern)
    key: {
      type: String,
      default: "platform_settings",
      unique: true,
      required: true,
    },
    // Tier configuration
    tiers: {
      bronze: {
        name: { type: String, default: "Bronze" },
        royaltyRate: {
          type: Number,
          default: 0.6,
          min: 0,
          max: 1,
          comment: "Seller receives this percentage (e.g., 0.6 = 60%)",
        },
        platformFee: {
          type: Number,
          default: 0.4,
          min: 0,
          max: 1,
          comment: "Platform receives this percentage (e.g., 0.4 = 40%)",
        },
        minSales: { type: Number, default: 0 },
        maxSales: { type: Number, default: 999.99 },
        description: {
          type: String,
          default: "Starting tier for new sellers",
        },
      },
      silver: {
        name: { type: String, default: "Silver" },
        royaltyRate: {
          type: Number,
          default: 0.7,
          min: 0,
          max: 1,
        },
        platformFee: {
          type: Number,
          default: 0.3,
          min: 0,
          max: 1,
        },
        minSales: { type: Number, default: 1000 },
        maxSales: { type: Number, default: 5999.99 },
        description: {
          type: String,
          default: "Achieved with £1,000+ in sales",
        },
      },
      gold: {
        name: { type: String, default: "Gold" },
        royaltyRate: {
          type: Number,
          default: 0.8,
          min: 0,
          max: 1,
        },
        platformFee: {
          type: Number,
          default: 0.2,
          min: 0,
          max: 1,
        },
        minSales: { type: Number, default: 6000 },
        maxSales: { type: Number, default: Infinity },
        description: {
          type: String,
          default: "Top tier for high-volume sellers",
        },
      },
    },
    // VAT settings
    vat: {
      enabled: { type: Boolean, default: true },
      rate: { type: Number, default: 0.2, comment: "20% VAT rate" },
      applicableCountries: {
        type: [String],
        default: ["GB", "UK"],
      },
    },
    // Minimum payout thresholds by currency
    minimumPayout: {
      GBP: { type: Number, default: 5000, comment: "Amount in pence (£50)" },
      USD: { type: Number, default: 6500, comment: "Amount in cents ($65)" },
      EUR: { type: Number, default: 6000, comment: "Amount in cents (€60)" },
    },
    // General platform settings
    general: {
      platformName: { type: String, default: "Educate Link" },
      supportEmail: { type: String, default: "support@educatelink.com" },
      maintenanceMode: { type: Boolean, default: false },
    },
    // Track who last updated the settings
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get settings (creates default if doesn't exist)
platformSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: "platform_settings" });

  if (!settings) {
    settings = await this.create({ key: "platform_settings" });
  }

  return settings;
};

// Static method to update settings
platformSettingsSchema.statics.updateSettings = async function (
  updates,
  adminId
) {
  const settings = await this.getSettings();

  // Deep merge updates
  if (updates.tiers) {
    if (updates.tiers.bronze) {
      Object.assign(settings.tiers.bronze, updates.tiers.bronze);
      // Auto-calculate platform fee from royalty rate
      if (updates.tiers.bronze.royaltyRate !== undefined) {
        settings.tiers.bronze.platformFee = 1 - updates.tiers.bronze.royaltyRate;
      }
    }
    if (updates.tiers.silver) {
      Object.assign(settings.tiers.silver, updates.tiers.silver);
      if (updates.tiers.silver.royaltyRate !== undefined) {
        settings.tiers.silver.platformFee = 1 - updates.tiers.silver.royaltyRate;
      }
    }
    if (updates.tiers.gold) {
      Object.assign(settings.tiers.gold, updates.tiers.gold);
      if (updates.tiers.gold.royaltyRate !== undefined) {
        settings.tiers.gold.platformFee = 1 - updates.tiers.gold.royaltyRate;
      }
    }
  }

  if (updates.vat) {
    Object.assign(settings.vat, updates.vat);
  }

  if (updates.minimumPayout) {
    Object.assign(settings.minimumPayout, updates.minimumPayout);
  }

  if (updates.general) {
    Object.assign(settings.general, updates.general);
  }

  settings.lastUpdatedBy = adminId;
  return settings.save();
};

// Static method to get tier rate for a given tier name
platformSettingsSchema.statics.getTierRate = async function (tierName) {
  const settings = await this.getSettings();
  const tierKey = tierName.toLowerCase();

  if (settings.tiers[tierKey]) {
    return {
      royaltyRate: settings.tiers[tierKey].royaltyRate,
      platformFee: settings.tiers[tierKey].platformFee,
    };
  }

  // Default to Bronze if tier not found
  return {
    royaltyRate: settings.tiers.bronze.royaltyRate,
    platformFee: settings.tiers.bronze.platformFee,
  };
};

// Static method to determine tier based on sales amount
platformSettingsSchema.statics.calculateTierFromSales = async function (
  salesAmount
) {
  const settings = await this.getSettings();

  if (salesAmount >= settings.tiers.gold.minSales) {
    return {
      tier: "Gold",
      royaltyRate: settings.tiers.gold.royaltyRate,
      platformFee: settings.tiers.gold.platformFee,
    };
  } else if (salesAmount >= settings.tiers.silver.minSales) {
    return {
      tier: "Silver",
      royaltyRate: settings.tiers.silver.royaltyRate,
      platformFee: settings.tiers.silver.platformFee,
    };
  } else {
    return {
      tier: "Bronze",
      royaltyRate: settings.tiers.bronze.royaltyRate,
      platformFee: settings.tiers.bronze.platformFee,
    };
  }
};

const PlatformSettings = mongoose.model(
  "PlatformSettings",
  platformSettingsSchema
);

module.exports = PlatformSettings;
