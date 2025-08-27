const JobNotification = require("../models/JobNotification");
const { sendEmail } = require("../config/email");

class NotificationService {
  /**
   * Create a notification
   */
  static async createNotification(notificationData) {
    try {
      const notification = await JobNotification.createNotification(notificationData);
      return notification;
    } catch (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Create bulk notifications
   */
  static async createBulkNotifications(notificationsData) {
    try {
      const notifications = await JobNotification.createBulkNotifications(notificationsData);
      return notifications;
    } catch (error) {
      throw new Error(`Failed to create bulk notifications: ${error.message}`);
    }
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(userId, filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10, type, category, priority, isRead } = filters;
      const skip = (page - 1) * limit;
      
      const query = { userId };
      
      if (type) {
        query.type = type;
      }
      
      if (category) {
        query.category = category;
      }
      
      if (priority) {
        query.priority = priority;
      }
      
      if (isRead !== undefined) {
        query.isRead = isRead;
      }
      
      const [notifications, total] = await Promise.all([
        JobNotification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        JobNotification.countDocuments(query),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      
      return {
        notifications: notifications.map(notification => this.sanitizeNotification(notification)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get user notifications: ${error.message}`);
    }
  }

  /**
   * Get unread notifications count
   */
  static async getUnreadCount(userId) {
    try {
      const count = await JobNotification.countDocuments({ userId, isRead: false });
      return count;
    } catch (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await JobNotification.findOne({ _id: notificationId, userId });
      
      if (!notification) {
        throw new Error("Notification not found or access denied");
      }
      
      await notification.markAsRead();
      return notification;
    } catch (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    try {
      const result = await JobNotification.markAllAsRead(userId);
      return result;
    } catch (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  /**
   * Mark notification as unread
   */
  static async markAsUnread(notificationId, userId) {
    try {
      const notification = await JobNotification.findOne({ _id: notificationId, userId });
      
      if (!notification) {
        throw new Error("Notification not found or access denied");
      }
      
      await notification.markAsUnread();
      return notification;
    } catch (error) {
      throw new Error(`Failed to mark notification as unread: ${error.message}`);
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId, userId) {
    try {
      const notification = await JobNotification.findOne({ _id: notificationId, userId });
      
      if (!notification) {
        throw new Error("Notification not found or access denied");
      }
      
      await JobNotification.findByIdAndDelete(notificationId);
      return { message: "Notification deleted successfully" };
    } catch (error) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  }

  /**
   * Get notification by ID
   */
  static async getNotificationById(notificationId, userId) {
    try {
      const notification = await JobNotification.findOne({ _id: notificationId, userId });
      
      if (!notification) {
        throw new Error("Notification not found or access denied");
      }
      
      return notification;
    } catch (error) {
      throw new Error(`Failed to get notification: ${error.message}`);
    }
  }

  /**
   * Get urgent notifications
   */
  static async getUrgentNotifications(userId, limit = 10) {
    try {
      const notifications = await JobNotification.findUrgent(userId);
      return notifications.slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to get urgent notifications: ${error.message}`);
    }
  }

  /**
   * Get notifications by type
   */
  static async getNotificationsByType(userId, type, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;
      
      const [notifications, total] = await Promise.all([
        JobNotification.findByType(userId, type)
          .skip(skip)
          .limit(limit)
          .lean(),
        JobNotification.countDocuments({ userId, type }),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      
      return {
        notifications: notifications.map(notification => this.sanitizeNotification(notification)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get notifications by type: ${error.message}`);
    }
  }

  /**
   * Get notifications by category
   */
  static async getNotificationsByCategory(userId, category, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;
      
      const [notifications, total] = await Promise.all([
        JobNotification.findByCategory(userId, category)
          .skip(skip)
          .limit(limit)
          .lean(),
        JobNotification.countDocuments({ userId, category }),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      
      return {
        notifications: notifications.map(notification => this.sanitizeNotification(notification)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get notifications by category: ${error.message}`);
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(userId) {
    try {
      const stats = await JobNotification.getUserStats(userId);
      return stats;
    } catch (error) {
      throw new Error(`Failed to get notification stats: ${error.message}`);
    }
  }

  /**
   * Send email notification
   */
  static async sendEmailNotification(notification, userEmail) {
    try {
      const emailData = this.buildEmailData(notification);
      
      await sendEmail({
        to: userEmail,
        subject: emailData.subject,
        template: emailData.template,
        context: emailData.context,
      });
      
      // Mark email as sent
      await notification.markEmailSent();
      
      return true;
    } catch (error) {
      console.error("Failed to send email notification:", error);
      return false;
    }
  }

  /**
   * Build email data from notification
   */
  static buildEmailData(notification) {
    const emailTemplates = {
      job_posted: {
        subject: "New Job Posted",
        template: "job-posted",
        context: {
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
        },
      },
      job_updated: {
        subject: "Job Updated",
        template: "job-updated",
        context: {
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
        },
      },
      application_submitted: {
        subject: "Application Submitted",
        template: "application-submitted",
        context: {
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
        },
      },
      application_reviewed: {
        subject: "Application Status Updated",
        template: "application-status-update",
        context: {
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
        },
      },
      reminder_apply: {
        subject: "Job Application Reminder",
        template: "application-reminder",
        context: {
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
        },
      },
      new_candidate: {
        subject: "New Job Application Received",
        template: "new-application",
        context: {
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
        },
      },
    };
    
    return emailTemplates[notification.type] || {
      subject: notification.title,
      template: "generic-notification",
      context: {
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
      },
    };
  }

  /**
   * Process notification queue
   */
  static async processNotificationQueue() {
    try {
      // Get notifications that need email sending
      const notificationsToEmail = await JobNotification.find({
        isEmailSent: false,
        type: { $in: ["job_posted", "application_submitted", "application_reviewed", "reminder_apply"] },
      }).populate("userId", "email");
      
      const results = [];
      
      for (const notification of notificationsToEmail) {
        try {
          if (notification.userId && notification.userId.email) {
            const success = await this.sendEmailNotification(notification, notification.userId.email);
            results.push({
              notificationId: notification._id,
              success,
              email: notification.userId.email,
            });
          }
        } catch (error) {
          results.push({
            notificationId: notification._id,
            success: false,
            error: error.message,
          });
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to process notification queue: ${error.message}`);
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications(daysToKeep = 90) {
    try {
      const result = await JobNotification.deleteOldNotifications(daysToKeep);
      return result;
    } catch (error) {
      throw new Error(`Failed to cleanup old notifications: ${error.message}`);
    }
  }

  /**
   * Get notifications for a specific job
   */
  static async getJobNotifications(userId, jobId, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;
      
      const [notifications, total] = await Promise.all([
        JobNotification.findByJob(userId, jobId)
          .skip(skip)
          .limit(limit)
          .lean(),
        JobNotification.countDocuments({ userId, jobId }),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      
      return {
        notifications: notifications.map(notification => this.sanitizeNotification(notification)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get job notifications: ${error.message}`);
    }
  }

  /**
   * Create job-related notifications
   */
  static async createJobNotifications(jobId, type, recipients, data = {}) {
    try {
      const notificationsData = recipients.map(recipient => ({
        userId: recipient.userId,
        jobId,
        type,
        title: data.title || this.getDefaultTitle(type),
        message: data.message || this.getDefaultMessage(type, data),
        category: this.getCategoryFromType(type),
        priority: data.priority || "medium",
        actionRequired: data.actionRequired || false,
        actionUrl: data.actionUrl,
        actionText: data.actionText,
        metadata: data.metadata || {},
      }));
      
      const notifications = await this.createBulkNotifications(notificationsData);
      return notifications;
    } catch (error) {
      throw new Error(`Failed to create job notifications: ${error.message}`);
    }
  }

  /**
   * Get default title for notification type
   */
  static getDefaultTitle(type) {
    const titles = {
      job_posted: "New Job Posted",
      job_updated: "Job Updated",
      job_closed: "Job Closed",
      job_expired: "Job Expired",
      application_submitted: "Application Submitted",
      application_reviewed: "Application Reviewed",
      application_shortlisted: "Application Shortlisted",
      application_interviewed: "Interview Scheduled",
      application_accepted: "Application Accepted",
      application_rejected: "Application Rejected",
      application_withdrawn: "Application Withdrawn",
      reminder_apply: "Job Application Reminder",
      deadline_approaching: "Application Deadline Approaching",
      new_candidate: "New Candidate Applied",
      profile_viewed: "Profile Viewed",
      job_recommendation: "Job Recommendation",
      system_alert: "System Alert",
    };
    
    return titles[type] || "Notification";
  }

  /**
   * Get default message for notification type
   */
  static getDefaultMessage(type, data = {}) {
    const messages = {
      job_posted: `A new job "${data.jobTitle || "has been posted"}" and is now accepting applications.`,
      job_updated: `The job "${data.jobTitle || "has been updated"}" with new information.`,
      job_closed: `The job "${data.jobTitle || "has been closed"}" and is no longer accepting applications.`,
      job_expired: `The job "${data.jobTitle || "has expired"}" and is no longer accepting applications.`,
      application_submitted: `Your application for "${data.jobTitle || "the job"}" has been submitted successfully.`,
      application_reviewed: `Your application for "${data.jobTitle || "the job"}" has been reviewed.`,
      application_shortlisted: `Congratulations! Your application for "${data.jobTitle || "the job"}" has been shortlisted.`,
      application_interviewed: `An interview has been scheduled for your application to "${data.jobTitle || "the job"}".`,
      application_accepted: `Congratulations! Your application for "${data.jobTitle || "the job"}" has been accepted.`,
      application_rejected: `Your application for "${data.jobTitle || "the job"}" has been rejected.`,
      application_withdrawn: `Your application for "${data.jobTitle || "the job"}" has been withdrawn.`,
      reminder_apply: `Don't forget to apply for "${data.jobTitle || "the job"}" before the deadline.`,
      deadline_approaching: `The application deadline for "${data.jobTitle || "the job"}" is approaching.`,
      new_candidate: `A new candidate has applied for "${data.jobTitle || "your job posting"}".`,
      profile_viewed: `Your profile has been viewed by a potential employer.`,
      job_recommendation: `We found a job that matches your profile: "${data.jobTitle || "Check it out"}".`,
      system_alert: "A system alert has been generated. Please review the details.",
    };
    
    return messages[type] || "You have a new notification.";
  }

  /**
   * Get category from notification type
   */
  static getCategoryFromType(type) {
    if (type.includes("job_")) return "job";
    if (type.includes("application_")) return "application";
    if (type.includes("reminder") || type.includes("deadline")) return "reminder";
    if (type.includes("profile") || type.includes("recommendation")) return "recommendation";
    if (type.includes("system")) return "system";
    return "other";
  }

  /**
   * Sanitize notification data
   */
  static sanitizeNotification(notification) {
    const sanitized = { ...notification };
    
    // Add computed fields
    sanitized.hoursSinceCreated = this.calculateHoursSinceCreated(notification.createdAt);
    sanitized.isExpired = this.isNotificationExpired(notification.expiresAt);
    sanitized.isUrgent = this.isNotificationUrgent(notification);
    
    return sanitized;
  }

  /**
   * Calculate hours since notification was created
   */
  static calculateHoursSinceCreated(createdAt) {
    if (!createdAt) return null;
    
    const now = new Date();
    const diffTime = Math.abs(now - createdAt);
    return Math.ceil(diffTime / (1000 * 60 * 60));
  }

  /**
   * Check if notification is expired
   */
  static isNotificationExpired(expiresAt) {
    if (!expiresAt) return false;
    return new Date() > expiresAt;
  }

  /**
   * Check if notification is urgent
   */
  static isNotificationUrgent(notification) {
    return notification.priority === "urgent" || notification.actionRequired;
  }
}

module.exports = NotificationService;
