const mongoose = require("mongoose");

const jobViewSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Anonymous users
    },
    viewerType: {
      type: String,
      required: true,
      enum: ["teacher", "school", "anonymous"],
    },
    ipAddress: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true;
          // Basic IP validation (IPv4 and IPv6)
          const ipv4Regex =
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(v) || ipv6Regex.test(v);
        },
        message: "Invalid IP address format",
      },
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
    referrer: {
      type: String,
      maxlength: 500,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: "Referrer must be a valid URL",
      },
    },
    sessionId: {
      type: String,
      maxlength: 100,
    },
    deviceType: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "unknown"],
      default: "unknown",
    },
    browser: {
      type: String,
      maxlength: 100,
    },
    operatingSystem: {
      type: String,
      maxlength: 100,
    },
    country: {
      type: String,
      maxlength: 100,
    },
    city: {
      type: String,
      maxlength: 100,
    },
    timeSpent: {
      type: Number, // in seconds
      min: 0,
      default: 0,
    },
    isUnique: {
      type: Boolean,
      default: true,
    },
    viewSource: {
      type: String,
      enum: ["search", "direct", "referral", "email", "social", "other"],
      default: "other",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
jobViewSchema.index({ jobId: 1, createdAt: -1 });
jobViewSchema.index({ viewerId: 1, jobId: 1 });
jobViewSchema.index({ viewerType: 1, createdAt: -1 });
jobViewSchema.index({ createdAt: 1 });
jobViewSchema.index({ country: 1, city: 1 });
jobViewSchema.index({ deviceType: 1 });
jobViewSchema.index({ viewSource: 1 });

// Compound index for unique views per day per user per job
jobViewSchema.index(
  {
    jobId: 1,
    viewerId: 1,
    createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  },
  {
    unique: true,
    partialFilterExpression: { viewerId: { $ne: null } },
  }
);

// Virtual for view age
jobViewSchema.virtual("hoursSinceViewed").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60));
});

// Pre-save middleware to detect duplicate views
jobViewSchema.pre("save", async function (next) {
  if (this.viewerId) {
    // Check if this user has already viewed this job today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingView = await this.constructor.findOne({
      jobId: this.jobId,
      viewerId: this.viewerId,
      createdAt: { $gte: today },
      _id: { $ne: this._id },
    });

    if (existingView) {
      this.isUnique = false;
    }
  }

  next();
});

// Method to update time spent
jobViewSchema.methods.updateTimeSpent = async function (additionalSeconds) {
  this.timeSpent += additionalSeconds;
  return this.save();
};

// Method to mark as non-unique
jobViewSchema.methods.markAsNonUnique = async function () {
  this.isUnique = false;
  return this.save();
};

// Static method to get view statistics for a job
jobViewSchema.statics.getJobStats = async function (jobId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.aggregate([
    {
      $match: {
        jobId: new mongoose.Types.ObjectId(jobId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        totalViews: { $sum: 1 },
        uniqueViews: { $sum: { $cond: ["$isUnique", 1, 0] } },
        avgTimeSpent: { $avg: "$timeSpent" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return stats;
};

// Static method to get viewer demographics
jobViewSchema.statics.getViewerDemographics = async function (jobId) {
  return this.aggregate([
    {
      $match: {
        jobId: new mongoose.Types.ObjectId(jobId),
      },
    },
    {
      $group: {
        _id: "$viewerType",
        count: { $sum: 1 },
        uniqueCount: { $sum: { $cond: ["$isUnique", 1, 0] } },
      },
    },
  ]);
};

// Static method to get device statistics
jobViewSchema.statics.getDeviceStats = async function (jobId) {
  return this.aggregate([
    {
      $match: {
        jobId: new mongoose.Types.ObjectId(jobId),
      },
    },
    {
      $group: {
        _id: "$deviceType",
        count: { $sum: 1 },
        uniqueCount: { $sum: { $cond: ["$isUnique", 1, 0] } },
      },
    },
  ]);
};

// Static method to get geographic statistics
jobViewSchema.statics.getGeographicStats = async function (jobId) {
  return this.aggregate([
    {
      $match: {
        jobId: new mongoose.Types.ObjectId(jobId),
        country: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$country",
        count: { $sum: 1 },
        cities: { $addToSet: "$city" },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

// Static method to clean old view records
jobViewSchema.statics.cleanOldRecords = async function (daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
  });

  return result;
};

module.exports = mongoose.model("JobView", jobViewSchema);
