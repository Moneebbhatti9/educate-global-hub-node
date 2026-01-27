const mongoose = require("mongoose");

/**
 * DownloadLog Schema
 * Tracks all resource downloads for analytics and audit purposes
 * Enhancement: Added per the documentation requirements for download tracking
 */
const downloadLogSchema = new mongoose.Schema(
  {
    // Resource that was downloaded
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resource",
      required: true,
      index: true,
    },
    // User who downloaded (optional for free resources with no login)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    // Reference to the purchase (if applicable)
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResourcePurchase",
      required: false,
    },
    // Reference to the sale record
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: false,
    },
    // Download type
    downloadType: {
      type: String,
      enum: ["free", "purchased", "owner", "admin"],
      required: true,
    },
    // File that was downloaded
    fileName: {
      type: String,
      required: false,
    },
    // File size in bytes
    fileSize: {
      type: Number,
      required: false,
    },
    // Download timestamp
    downloadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Client information for analytics
    clientInfo: {
      ipAddress: {
        type: String,
        required: false,
      },
      userAgent: {
        type: String,
        required: false,
      },
      country: {
        type: String,
        required: false,
      },
      city: {
        type: String,
        required: false,
      },
      device: {
        type: String,
        enum: ["desktop", "mobile", "tablet", "unknown"],
        default: "unknown",
      },
      browser: {
        type: String,
        required: false,
      },
      os: {
        type: String,
        required: false,
      },
    },
    // Download status
    status: {
      type: String,
      enum: ["initiated", "completed", "failed"],
      default: "completed",
    },
    // Error message if download failed
    errorMessage: {
      type: String,
      required: false,
    },

    // License information for tracking
    licenseInfo: {
      licenseType: {
        type: String,
        enum: ["single", "department", "school", "free", "owner"],
        required: false,
      },
      // Was access validated successfully
      accessValidated: {
        type: Boolean,
        default: false,
      },
      // Access type (direct buyer, school license user, etc.)
      accessType: {
        type: String,
        enum: ["buyer", "school_license", "owner", "admin", "free"],
        required: false,
      },
      // School domain if accessed via school license
      schoolDomain: {
        type: String,
        required: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
downloadLogSchema.index({ resource: 1, downloadedAt: -1 });
downloadLogSchema.index({ user: 1, downloadedAt: -1 });
downloadLogSchema.index({ resource: 1, user: 1 });
downloadLogSchema.index({ downloadType: 1, downloadedAt: -1 });

/**
 * Static method to get download count for a resource
 */
downloadLogSchema.statics.getResourceDownloadCount = async function (resourceId) {
  return this.countDocuments({
    resource: new mongoose.Types.ObjectId(resourceId),
    status: "completed",
  });
};

/**
 * Static method to get user's download history
 */
downloadLogSchema.statics.getUserDownloads = async function (userId, limit = 50) {
  return this.find({
    user: new mongoose.Types.ObjectId(userId),
    status: "completed",
  })
    .populate("resource", "title type coverPhoto")
    .sort({ downloadedAt: -1 })
    .limit(limit);
};

/**
 * Static method to get download analytics for a resource
 */
downloadLogSchema.statics.getResourceAnalytics = async function (resourceId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const analytics = await this.aggregate([
    {
      $match: {
        resource: new mongoose.Types.ObjectId(resourceId),
        status: "completed",
        downloadedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$downloadedAt" },
          month: { $month: "$downloadedAt" },
          day: { $dayOfMonth: "$downloadedAt" },
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: "$user" },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
    },
  ]);

  return analytics.map((item) => ({
    date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(
      item._id.day
    ).padStart(2, "0")}`,
    downloads: item.count,
    uniqueUsers: item.uniqueUsers.filter((u) => u !== null).length,
  }));
};

/**
 * Static method to get download stats by device type
 */
downloadLogSchema.statics.getDeviceBreakdown = async function (resourceId) {
  const result = await this.aggregate([
    {
      $match: {
        resource: new mongoose.Types.ObjectId(resourceId),
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$clientInfo.device",
        count: { $sum: 1 },
      },
    },
  ]);

  return result.reduce((acc, item) => {
    acc[item._id || "unknown"] = item.count;
    return acc;
  }, {});
};

/**
 * Static method to get download stats by country
 */
downloadLogSchema.statics.getCountryBreakdown = async function (resourceId) {
  const result = await this.aggregate([
    {
      $match: {
        resource: new mongoose.Types.ObjectId(resourceId),
        status: "completed",
        "clientInfo.country": { $ne: null },
      },
    },
    {
      $group: {
        _id: "$clientInfo.country",
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  return result;
};

/**
 * Instance method to log a download
 */
downloadLogSchema.statics.logDownload = async function (data) {
  // Parse user agent for device/browser info
  let device = "unknown";
  let browser = "unknown";
  let os = "unknown";

  if (data.userAgent) {
    const ua = data.userAgent.toLowerCase();

    // Detect device
    if (/mobile|android|iphone|ipad|phone/i.test(ua)) {
      device = /tablet|ipad/i.test(ua) ? "tablet" : "mobile";
    } else {
      device = "desktop";
    }

    // Detect browser
    if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) {
      browser = "Chrome";
    } else if (/firefox/i.test(ua)) {
      browser = "Firefox";
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      browser = "Safari";
    } else if (/edge|edg/i.test(ua)) {
      browser = "Edge";
    } else if (/msie|trident/i.test(ua)) {
      browser = "Internet Explorer";
    }

    // Detect OS
    if (/windows/i.test(ua)) {
      os = "Windows";
    } else if (/mac/i.test(ua)) {
      os = "MacOS";
    } else if (/linux/i.test(ua)) {
      os = "Linux";
    } else if (/android/i.test(ua)) {
      os = "Android";
    } else if (/ios|iphone|ipad/i.test(ua)) {
      os = "iOS";
    }
  }

  const log = await this.create({
    resource: data.resourceId,
    user: data.userId || null,
    purchase: data.purchaseId || null,
    sale: data.saleId || null,
    downloadType: data.downloadType,
    fileName: data.fileName,
    fileSize: data.fileSize,
    clientInfo: {
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      country: data.country,
      city: data.city,
      device,
      browser,
      os,
    },
    status: data.status || "completed",
    errorMessage: data.errorMessage,
    licenseInfo: data.licenseInfo || null,
  });

  return log;
};

/**
 * Static method to get license utilization for a purchase
 */
downloadLogSchema.statics.getLicenseUtilization = async function (purchaseId) {
  const result = await this.aggregate([
    {
      $match: {
        purchase: new mongoose.Types.ObjectId(purchaseId),
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$user",
        downloadCount: { $sum: 1 },
        firstDownload: { $min: "$downloadedAt" },
        lastDownload: { $max: "$downloadedAt" },
      },
    },
  ]);

  return {
    uniqueUsers: result.length,
    users: result.map((u) => ({
      userId: u._id,
      downloads: u.downloadCount,
      firstAccess: u.firstDownload,
      lastAccess: u.lastDownload,
    })),
  };
};

const DownloadLog = mongoose.model("DownloadLog", downloadLogSchema);

module.exports = DownloadLog;
