const mongoose = require("mongoose");

const jobNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null, // Some notifications might not be job-specific
    },
    type: {
      type: String,
      required: true,
      enum: [
        "job_posted",
        "job_updated",
        "job_closed",
        "job_expired",
        "application_submitted",
        "application_reviewed",
        "application_shortlisted",
        "application_interviewed",
        "application_accepted",
        "application_rejected",
        "application_withdrawn",
        "reminder_apply",
        "deadline_approaching",
        "new_candidate",
        "profile_viewed",
        "job_recommendation",
        "system_alert",
        "ad_request_submitted",
        "ad_request_approved",
        "ad_request_rejected",
        "ad_request_changes",
        "ad_request_resubmitted",
        "ad_payment_completed",
        "ad_activated",
        "ad_expired",
      ],
    },
    title: {
      type: String,
      required: true,
      maxlength: 255,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    category: {
      type: String,
      enum: ["job", "application", "reminder", "system", "recommendation", "advertisement"],
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    isEmailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
    isPushSent: {
      type: Boolean,
      default: false,
    },
    pushSentAt: {
      type: Date,
    },
    actionRequired: {
      type: Boolean,
      default: false,
    },
    actionUrl: {
      type: String,
      maxlength: 500,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: "Action URL must be a valid URL",
      },
    },
    actionText: {
      type: String,
      maxlength: 100,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return v > new Date();
        },
        message: "Expiration date must be in the future",
      },
    },
    tags: {
      type: [String],
      default: [],
      maxlength: 10,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
jobNotificationSchema.index({ userId: 1, isRead: 1 });
jobNotificationSchema.index({ userId: 1, createdAt: -1 });
jobNotificationSchema.index({ userId: 1, type: 1 });
jobNotificationSchema.index({ userId: 1, category: 1 });
jobNotificationSchema.index({ userId: 1, priority: 1 });
jobNotificationSchema.index({ jobId: 1 });
jobNotificationSchema.index({ isEmailSent: 1, emailSentAt: 1 });
jobNotificationSchema.index({ isPushSent: 1, pushSentAt: 1 });

// TTL index to automatically delete expired notifications
jobNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for notification age
jobNotificationSchema.virtual("hoursSinceCreated").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60));
});

// Virtual for isExpired
jobNotificationSchema.virtual("isExpired").get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual for isUrgent
jobNotificationSchema.virtual("isUrgent").get(function () {
  return this.priority === "urgent" || this.actionRequired;
});

// Pre-save middleware to handle read status
jobNotificationSchema.pre("save", function (next) {
  if (this.isModified("isRead") && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

// Method to mark as read
jobNotificationSchema.methods.markAsRead = async function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Method to mark as unread
jobNotificationSchema.methods.markAsUnread = async function () {
  this.isRead = false;
  this.readAt = undefined;
  return this.save();
};

// Method to mark email as sent
jobNotificationSchema.methods.markEmailSent = async function () {
  this.isEmailSent = true;
  this.emailSentAt = new Date();
  return this.save();
};

// Method to mark push notification as sent
jobNotificationSchema.methods.markPushSent = async function () {
  this.isPushSent = true;
  this.pushSentAt = new Date();
  return this.save();
};

// Method to add metadata
jobNotificationSchema.methods.addMetadata = async function (key, value) {
  this.metadata.set(key, value);
  return this.save();
};

// Method to remove metadata
jobNotificationSchema.methods.removeMetadata = async function (key) {
  this.metadata.delete(key);
  return this.save();
};

// Method to add tags
jobNotificationSchema.methods.addTags = async function (newTags) {
  const uniqueTags = [...new Set([...this.tags, ...newTags])];
  if (uniqueTags.length > 10) {
    throw new Error("Maximum 10 tags allowed");
  }
  this.tags = uniqueTags;
  return this.save();
};

// Method to remove tags
jobNotificationSchema.methods.removeTags = async function (tagsToRemove) {
  this.tags = this.tags.filter((tag) => !tagsToRemove.includes(tag));
  return this.save();
};

// Method to sanitize notification data
jobNotificationSchema.methods.toSafeObject = function () {
  const notification = this.toObject();

  // Add computed fields
  notification.hoursSinceCreated = this.hoursSinceCreated;
  notification.isExpired = this.isExpired;
  notification.isUrgent = this.isUrgent;

  return notification;
};

// Static method to find unread notifications
jobNotificationSchema.statics.findUnread = function (userId) {
  return this.find({ userId, isRead: false }).sort({ createdAt: -1 });
};

// Static method to find notifications by type
jobNotificationSchema.statics.findByType = function (userId, type) {
  return this.find({ userId, type }).sort({ createdAt: -1 });
};

// Static method to find notifications by category
jobNotificationSchema.statics.findByCategory = function (userId, category) {
  return this.find({ userId, category }).sort({ createdAt: -1 });
};

// Static method to find urgent notifications
jobNotificationSchema.statics.findUrgent = function (userId) {
  return this.find({
    userId,
    $or: [{ priority: "urgent" }, { actionRequired: true }],
  }).sort({ createdAt: -1 });
};

// Static method to find notifications for a specific job
jobNotificationSchema.statics.findByJob = function (userId, jobId) {
  return this.find({ userId, jobId }).sort({ createdAt: -1 });
};

// Static method to mark all notifications as read
jobNotificationSchema.statics.markAllAsRead = async function (userId) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to delete old notifications
jobNotificationSchema.statics.deleteOldNotifications = async function (
  daysToKeep = 90
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true, // Only delete read notifications
  });

  return result;
};

// Static method to get notification statistics
jobNotificationSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: { userId: new mongoose.Types.ObjectId(userId) },
    },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        unreadCount: { $sum: { $cond: ["$isRead", 0, 1] } },
        urgentCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$priority", "urgent"] },
                  { $eq: ["$actionRequired", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        categoryBreakdown: {
          $push: "$category",
        },
        priorityBreakdown: {
          $push: "$priority",
        },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalNotifications: 0,
      unreadCount: 0,
      urgentCount: 0,
      categoryBreakdown: {},
      priorityBreakdown: {},
    };
  }

  const stat = stats[0];
  const categoryBreakdown = stat.categoryBreakdown.reduce((acc, category) => {
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const priorityBreakdown = stat.priorityBreakdown.reduce((acc, priority) => {
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});

  return {
    totalNotifications: stat.totalNotifications,
    unreadCount: stat.unreadCount,
    urgentCount: stat.urgentCount,
    categoryBreakdown,
    priorityBreakdown,
  };
};

// Static method to create notification
jobNotificationSchema.statics.createNotification = async function (
  notificationData
) {
  const notification = new this(notificationData);

  // Set default expiration if not provided
  if (!notification.expiresAt) {
    notification.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  }

  return notification.save();
};

// Static method to create bulk notifications
jobNotificationSchema.statics.createBulkNotifications = async function (
  notificationsData
) {
  const notifications = notificationsData.map((data) => {
    if (!data.expiresAt) {
      data.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
    return data;
  });

  return this.insertMany(notifications);
};

module.exports = mongoose.model("JobNotification", jobNotificationSchema);
