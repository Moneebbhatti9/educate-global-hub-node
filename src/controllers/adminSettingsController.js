const PlatformSettings = require("../models/PlatformSettings");
const GeneralSettings = require("../models/GeneralSettings");
const { successResponse, errorResponse } = require("../utils/response");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary");

// Get platform settings
const getPlatformSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();

    // Format the response for frontend consumption
    const formattedSettings = {
      tiers: {
        bronze: {
          name: settings.tiers.bronze.name,
          royaltyRate: settings.tiers.bronze.royaltyRate,
          royaltyRatePercent: Math.round(settings.tiers.bronze.royaltyRate * 100),
          platformFee: settings.tiers.bronze.platformFee,
          platformFeePercent: Math.round(settings.tiers.bronze.platformFee * 100),
          minSales: settings.tiers.bronze.minSales,
          maxSales: settings.tiers.bronze.maxSales,
          minSalesFormatted: `£${(settings.tiers.bronze.minSales).toLocaleString()}`,
          maxSalesFormatted: settings.tiers.bronze.maxSales === Infinity
            ? "Unlimited"
            : `£${(settings.tiers.bronze.maxSales).toLocaleString()}`,
          description: settings.tiers.bronze.description,
        },
        silver: {
          name: settings.tiers.silver.name,
          royaltyRate: settings.tiers.silver.royaltyRate,
          royaltyRatePercent: Math.round(settings.tiers.silver.royaltyRate * 100),
          platformFee: settings.tiers.silver.platformFee,
          platformFeePercent: Math.round(settings.tiers.silver.platformFee * 100),
          minSales: settings.tiers.silver.minSales,
          maxSales: settings.tiers.silver.maxSales,
          minSalesFormatted: `£${(settings.tiers.silver.minSales).toLocaleString()}`,
          maxSalesFormatted: settings.tiers.silver.maxSales === Infinity
            ? "Unlimited"
            : `£${(settings.tiers.silver.maxSales).toLocaleString()}`,
          description: settings.tiers.silver.description,
        },
        gold: {
          name: settings.tiers.gold.name,
          royaltyRate: settings.tiers.gold.royaltyRate,
          royaltyRatePercent: Math.round(settings.tiers.gold.royaltyRate * 100),
          platformFee: settings.tiers.gold.platformFee,
          platformFeePercent: Math.round(settings.tiers.gold.platformFee * 100),
          minSales: settings.tiers.gold.minSales,
          maxSales: settings.tiers.gold.maxSales,
          minSalesFormatted: `£${(settings.tiers.gold.minSales).toLocaleString()}`,
          maxSalesFormatted: "Unlimited",
          description: settings.tiers.gold.description,
        },
      },
      vat: {
        enabled: settings.vat.enabled,
        rate: settings.vat.rate,
        ratePercent: Math.round(settings.vat.rate * 100),
        pricingType: settings.vat.pricingType || "inclusive",
        applicableRegions: settings.vat.applicableRegions || ["UK", "EU"],
        applicableCountries: settings.vat.applicableCountries,
        euRates: settings.vat.euRates ? Object.fromEntries(
          Array.from(settings.vat.euRates.entries()).map(([key, value]) => [
            key,
            { rate: value, ratePercent: Math.round(value * 100) }
          ])
        ) : {},
        b2bReverseCharge: settings.vat.b2bReverseCharge || {
          enabled: true,
          requireVatNumber: true,
          validateVatNumber: true,
        },
        invoiceSettings: settings.vat.invoiceSettings || {
          autoGenerate: true,
          sendToEmail: true,
          companyName: "Educate Link Ltd",
          companyAddress: "",
          vatNumber: "",
          invoicePrefix: "INV",
        },
      },
      minimumPayout: {
        GBP: settings.minimumPayout.GBP,
        GBPFormatted: `£${(settings.minimumPayout.GBP / 100).toFixed(2)}`,
        USD: settings.minimumPayout.USD,
        USDFormatted: `$${(settings.minimumPayout.USD / 100).toFixed(2)}`,
        EUR: settings.minimumPayout.EUR,
        EURFormatted: `€${(settings.minimumPayout.EUR / 100).toFixed(2)}`,
      },
      general: settings.general,
      lastUpdatedAt: settings.updatedAt,
      lastUpdatedBy: settings.lastUpdatedBy,
    };

    return successResponse(
      res,
      formattedSettings,
      "Platform settings retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching platform settings:", error);
    return errorResponse(res, "Failed to fetch platform settings", error);
  }
};

// Update tier settings
const updateTierSettings = async (req, res) => {
  try {
    const { tiers } = req.body;
    const adminId = req.user._id;

    if (!tiers) {
      return errorResponse(res, "Tier settings are required", null, 400);
    }

    // Validate tier data
    const validationErrors = [];

    for (const [tierName, tierData] of Object.entries(tiers)) {
      if (!["bronze", "silver", "gold"].includes(tierName)) {
        validationErrors.push(`Invalid tier name: ${tierName}`);
        continue;
      }

      if (tierData.royaltyRate !== undefined) {
        const rate = parseFloat(tierData.royaltyRate);
        if (isNaN(rate) || rate < 0 || rate > 1) {
          validationErrors.push(
            `${tierName}: Royalty rate must be between 0 and 1 (0% to 100%)`
          );
        }
      }

      if (tierData.minSales !== undefined) {
        const minSales = parseFloat(tierData.minSales);
        if (isNaN(minSales) || minSales < 0) {
          validationErrors.push(`${tierName}: Minimum sales must be 0 or greater`);
        }
      }
    }

    // Validate tier thresholds don't overlap incorrectly
    if (tiers.bronze?.maxSales !== undefined && tiers.silver?.minSales !== undefined) {
      if (tiers.bronze.maxSales >= tiers.silver.minSales) {
        validationErrors.push(
          "Bronze max sales must be less than Silver min sales"
        );
      }
    }

    if (tiers.silver?.maxSales !== undefined && tiers.gold?.minSales !== undefined) {
      if (tiers.silver.maxSales >= tiers.gold.minSales) {
        validationErrors.push(
          "Silver max sales must be less than Gold min sales"
        );
      }
    }

    if (validationErrors.length > 0) {
      return errorResponse(
        res,
        "Validation failed",
        { errors: validationErrors },
        400
      );
    }

    // Convert percentage inputs to decimals if needed
    const processedTiers = {};
    for (const [tierName, tierData] of Object.entries(tiers)) {
      processedTiers[tierName] = { ...tierData };

      // If royaltyRate is provided as percentage (> 1), convert to decimal
      if (tierData.royaltyRate !== undefined) {
        let rate = parseFloat(tierData.royaltyRate);
        if (rate > 1) {
          rate = rate / 100; // Convert percentage to decimal
        }
        processedTiers[tierName].royaltyRate = rate;
      }
    }

    const updatedSettings = await PlatformSettings.updateSettings(
      { tiers: processedTiers },
      adminId
    );

    return successResponse(res, {
      tiers: {
        bronze: {
          name: updatedSettings.tiers.bronze.name,
          royaltyRate: updatedSettings.tiers.bronze.royaltyRate,
          royaltyRatePercent: Math.round(updatedSettings.tiers.bronze.royaltyRate * 100),
          platformFee: updatedSettings.tiers.bronze.platformFee,
          platformFeePercent: Math.round(updatedSettings.tiers.bronze.platformFee * 100),
          minSales: updatedSettings.tiers.bronze.minSales,
          maxSales: updatedSettings.tiers.bronze.maxSales,
        },
        silver: {
          name: updatedSettings.tiers.silver.name,
          royaltyRate: updatedSettings.tiers.silver.royaltyRate,
          royaltyRatePercent: Math.round(updatedSettings.tiers.silver.royaltyRate * 100),
          platformFee: updatedSettings.tiers.silver.platformFee,
          platformFeePercent: Math.round(updatedSettings.tiers.silver.platformFee * 100),
          minSales: updatedSettings.tiers.silver.minSales,
          maxSales: updatedSettings.tiers.silver.maxSales,
        },
        gold: {
          name: updatedSettings.tiers.gold.name,
          royaltyRate: updatedSettings.tiers.gold.royaltyRate,
          royaltyRatePercent: Math.round(updatedSettings.tiers.gold.royaltyRate * 100),
          platformFee: updatedSettings.tiers.gold.platformFee,
          platformFeePercent: Math.round(updatedSettings.tiers.gold.platformFee * 100),
          minSales: updatedSettings.tiers.gold.minSales,
          maxSales: updatedSettings.tiers.gold.maxSales,
        },
      },
    }, "Tier settings updated successfully");
  } catch (error) {
    console.error("Error updating tier settings:", error);
    return errorResponse(res, "Failed to update tier settings", error);
  }
};

// Update VAT settings
const updateVatSettings = async (req, res) => {
  try {
    const { vat } = req.body;
    const adminId = req.user._id;

    if (!vat) {
      return errorResponse(res, "VAT settings are required", null, 400);
    }

    // Validate and convert VAT rate
    if (vat.rate !== undefined) {
      let rate = parseFloat(vat.rate);
      if (rate > 1) {
        rate = rate / 100; // Convert percentage to decimal
      }
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return errorResponse(
          res,
          "VAT rate must be between 0 and 100%",
          null,
          400
        );
      }
      vat.rate = rate;
    }

    // Process EU rates if provided
    if (vat.euRates) {
      const processedEuRates = {};
      for (const [country, rate] of Object.entries(vat.euRates)) {
        let processedRate = parseFloat(rate);
        if (processedRate > 1) {
          processedRate = processedRate / 100;
        }
        processedEuRates[country] = processedRate;
      }
      vat.euRates = processedEuRates;
    }

    const updatedSettings = await PlatformSettings.updateSettings(
      { vat },
      adminId
    );

    // Format EU rates for response
    const formattedEuRates = {};
    if (updatedSettings.vat.euRates) {
      for (const [key, value] of updatedSettings.vat.euRates.entries()) {
        formattedEuRates[key] = {
          rate: value,
          ratePercent: Math.round(value * 100),
        };
      }
    }

    return successResponse(res, {
      vat: {
        enabled: updatedSettings.vat.enabled,
        rate: updatedSettings.vat.rate,
        ratePercent: Math.round(updatedSettings.vat.rate * 100),
        pricingType: updatedSettings.vat.pricingType,
        applicableRegions: updatedSettings.vat.applicableRegions,
        applicableCountries: updatedSettings.vat.applicableCountries,
        euRates: formattedEuRates,
        b2bReverseCharge: updatedSettings.vat.b2bReverseCharge,
        invoiceSettings: {
          autoGenerate: updatedSettings.vat.invoiceSettings.autoGenerate,
          sendToEmail: updatedSettings.vat.invoiceSettings.sendToEmail,
          companyName: updatedSettings.vat.invoiceSettings.companyName,
          companyAddress: updatedSettings.vat.invoiceSettings.companyAddress,
          vatNumber: updatedSettings.vat.invoiceSettings.vatNumber,
          invoicePrefix: updatedSettings.vat.invoiceSettings.invoicePrefix,
        },
      },
    }, "VAT settings updated successfully");
  } catch (error) {
    console.error("Error updating VAT settings:", error);
    return errorResponse(res, "Failed to update VAT settings", error);
  }
};

// Update minimum payout thresholds
const updateMinimumPayout = async (req, res) => {
  try {
    const { minimumPayout } = req.body;
    const adminId = req.user._id;

    if (!minimumPayout) {
      return errorResponse(
        res,
        "Minimum payout settings are required",
        null,
        400
      );
    }

    // Validate amounts (should be in smallest currency unit - pence/cents)
    for (const [currency, amount] of Object.entries(minimumPayout)) {
      if (!["GBP", "USD", "EUR"].includes(currency)) {
        return errorResponse(res, `Invalid currency: ${currency}`, null, 400);
      }
      if (isNaN(amount) || amount < 0) {
        return errorResponse(
          res,
          `${currency}: Amount must be a positive number`,
          null,
          400
        );
      }
    }

    const updatedSettings = await PlatformSettings.updateSettings(
      { minimumPayout },
      adminId
    );

    return successResponse(res, {
      minimumPayout: {
        GBP: updatedSettings.minimumPayout.GBP,
        GBPFormatted: `£${(updatedSettings.minimumPayout.GBP / 100).toFixed(2)}`,
        USD: updatedSettings.minimumPayout.USD,
        USDFormatted: `$${(updatedSettings.minimumPayout.USD / 100).toFixed(2)}`,
        EUR: updatedSettings.minimumPayout.EUR,
        EURFormatted: `€${(updatedSettings.minimumPayout.EUR / 100).toFixed(2)}`,
      },
    }, "Minimum payout thresholds updated successfully");
  } catch (error) {
    console.error("Error updating minimum payout:", error);
    return errorResponse(res, "Failed to update minimum payout settings", error);
  }
};

// Update all platform settings at once
const updateAllSettings = async (req, res) => {
  try {
    const { tiers, vat, minimumPayout, general } = req.body;
    const adminId = req.user._id;

    const updates = {};

    // Process tier updates
    if (tiers) {
      updates.tiers = {};
      for (const [tierName, tierData] of Object.entries(tiers)) {
        if (["bronze", "silver", "gold"].includes(tierName)) {
          updates.tiers[tierName] = { ...tierData };
          if (tierData.royaltyRate !== undefined) {
            let rate = parseFloat(tierData.royaltyRate);
            if (rate > 1) rate = rate / 100;
            updates.tiers[tierName].royaltyRate = rate;
          }
        }
      }
    }

    // Process VAT updates
    if (vat) {
      updates.vat = { ...vat };
      if (vat.rate !== undefined) {
        let rate = parseFloat(vat.rate);
        if (rate > 1) rate = rate / 100;
        updates.vat.rate = rate;
      }
    }

    // Process minimum payout updates
    if (minimumPayout) {
      updates.minimumPayout = minimumPayout;
    }

    // Process general settings
    if (general) {
      updates.general = general;
    }

    const updatedSettings = await PlatformSettings.updateSettings(
      updates,
      adminId
    );

    return successResponse(
      res,
      updatedSettings,
      "Platform settings updated successfully"
    );
  } catch (error) {
    console.error("Error updating platform settings:", error);
    return errorResponse(res, "Failed to update platform settings", error);
  }
};

// Get tier rate for a specific tier (used by sales calculations)
const getTierRate = async (req, res) => {
  try {
    const { tierName } = req.params;

    if (!tierName || !["bronze", "silver", "gold"].includes(tierName.toLowerCase())) {
      return errorResponse(res, "Invalid tier name", null, 400);
    }

    const rates = await PlatformSettings.getTierRate(tierName);

    return successResponse(res, {
      tier: tierName,
      ...rates,
      royaltyRatePercent: Math.round(rates.royaltyRate * 100),
      platformFeePercent: Math.round(rates.platformFee * 100),
    }, "Tier rate retrieved");
  } catch (error) {
    console.error("Error fetching tier rate:", error);
    return errorResponse(res, "Failed to fetch tier rate", error);
  }
};

// ==================== General Settings ====================

// Get general settings (public endpoint for logo, site name, etc.)
const getGeneralSettings = async (req, res) => {
  try {
    const settings = await GeneralSettings.getSettings();

    return successResponse(res, {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      logo: settings.logo,
      favicon: settings.favicon,
      contactEmail: settings.contactEmail,
      supportEmail: settings.supportEmail,
      phoneNumber: settings.phoneNumber,
      address: settings.address,
      socialLinks: settings.socialLinks,
      copyrightText: settings.copyrightText,
      updatedAt: settings.updatedAt,
    }, "General settings retrieved successfully");
  } catch (error) {
    console.error("Error fetching general settings:", error);
    return errorResponse(res, "Failed to fetch general settings", error);
  }
};

// Update general settings (admin only)
const updateGeneralSettings = async (req, res) => {
  try {
    const adminId = req.user._id;
    const updates = { ...req.body };

    // Handle file uploads
    if (req.files) {
      // Handle logo upload
      if (req.files.logo && req.files.logo[0]) {
        const logoFile = req.files.logo[0];
        const logoResult = await uploadToCloudinary(logoFile.buffer, {
          folder: "site-assets",
          public_id: "site-logo",
          overwrite: true,
          resource_type: "image",
        });
        updates.logo = logoResult.secure_url;
      }

      // Handle favicon upload
      if (req.files.favicon && req.files.favicon[0]) {
        const faviconFile = req.files.favicon[0];
        const faviconResult = await uploadToCloudinary(faviconFile.buffer, {
          folder: "site-assets",
          public_id: "site-favicon",
          overwrite: true,
          resource_type: "image",
        });
        updates.favicon = faviconResult.secure_url;
      }
    }

    // Parse socialLinks if it's a string
    if (updates.socialLinks && typeof updates.socialLinks === "string") {
      try {
        updates.socialLinks = JSON.parse(updates.socialLinks);
      } catch (e) {
        console.error("Failed to parse socialLinks:", e);
      }
    }

    const updatedSettings = await GeneralSettings.updateSettings(updates, adminId);

    return successResponse(res, {
      siteName: updatedSettings.siteName,
      siteDescription: updatedSettings.siteDescription,
      logo: updatedSettings.logo,
      favicon: updatedSettings.favicon,
      contactEmail: updatedSettings.contactEmail,
      supportEmail: updatedSettings.supportEmail,
      phoneNumber: updatedSettings.phoneNumber,
      address: updatedSettings.address,
      socialLinks: updatedSettings.socialLinks,
      copyrightText: updatedSettings.copyrightText,
      updatedAt: updatedSettings.updatedAt,
    }, "General settings updated successfully");
  } catch (error) {
    console.error("Error updating general settings:", error);
    return errorResponse(res, "Failed to update general settings", error);
  }
};

module.exports = {
  getPlatformSettings,
  updateTierSettings,
  updateVatSettings,
  updateMinimumPayout,
  updateAllSettings,
  getTierRate,
  getGeneralSettings,
  updateGeneralSettings,
};
