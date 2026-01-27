const mongoose = require("mongoose");

const generalSettingsSchema = new mongoose.Schema(
  {
    // Unique key for settings document (singleton pattern)
    key: {
      type: String,
      default: "general_settings",
      unique: true,
      required: true,
    },

    // Site Identity
    siteName: {
      type: String,
      default: "Educate Link",
    },
    siteDescription: {
      type: String,
      default: "Connecting educators worldwide with resources and opportunities",
    },
    logo: {
      type: String,
      default: "",
    },
    favicon: {
      type: String,
      default: "",
    },

    // Contact Information
    contactEmail: {
      type: String,
      default: "",
    },
    supportEmail: {
      type: String,
      default: "",
    },
    phoneNumber: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },

    // Social Media Links
    socialLinks: {
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },

    // Footer
    copyrightText: {
      type: String,
      default: "",
    },

    // Track who last updated
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
generalSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: "general_settings" });

  if (!settings) {
    settings = await this.create({ key: "general_settings" });
  }

  return settings;
};

// Static method to update settings
generalSettingsSchema.statics.updateSettings = async function (updates, adminId) {
  const settings = await this.getSettings();

  // Update fields
  if (updates.siteName !== undefined) settings.siteName = updates.siteName;
  if (updates.siteDescription !== undefined) settings.siteDescription = updates.siteDescription;
  if (updates.logo !== undefined) settings.logo = updates.logo;
  if (updates.favicon !== undefined) settings.favicon = updates.favicon;
  if (updates.contactEmail !== undefined) settings.contactEmail = updates.contactEmail;
  if (updates.supportEmail !== undefined) settings.supportEmail = updates.supportEmail;
  if (updates.phoneNumber !== undefined) settings.phoneNumber = updates.phoneNumber;
  if (updates.address !== undefined) settings.address = updates.address;
  if (updates.copyrightText !== undefined) settings.copyrightText = updates.copyrightText;

  // Update social links
  if (updates.socialLinks) {
    if (typeof updates.socialLinks === "string") {
      updates.socialLinks = JSON.parse(updates.socialLinks);
    }
    if (updates.socialLinks.facebook !== undefined)
      settings.socialLinks.facebook = updates.socialLinks.facebook;
    if (updates.socialLinks.twitter !== undefined)
      settings.socialLinks.twitter = updates.socialLinks.twitter;
    if (updates.socialLinks.linkedin !== undefined)
      settings.socialLinks.linkedin = updates.socialLinks.linkedin;
    if (updates.socialLinks.instagram !== undefined)
      settings.socialLinks.instagram = updates.socialLinks.instagram;
  }

  settings.lastUpdatedBy = adminId;
  return settings.save();
};

const GeneralSettings = mongoose.model("GeneralSettings", generalSettingsSchema);

module.exports = GeneralSettings;
