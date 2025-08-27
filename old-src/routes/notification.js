const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { validateObjectId } = require("../middleware/validation");
const JobNotification = require("../models/JobNotification");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's notifications with pagination and filtering
 * @access  Private
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isRead,
      type,
      category,
      priority,
      jobId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const userId = req.user.userId;
    const query = { userId };

    // Apply filters
    if (isRead !== undefined) {
      query.isRead = isRead === "true";
    }
    if (type) {
      query.type = type;
    }
    if (category) {
      query.category = category;
    }
    if (priority) {
      query.priority = priority;
    }
    if (jobId) {
      query.jobId = jobId;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await JobNotification.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Get notifications
    const notifications = await JobNotification.find(query)
      .populate("jobId", "title company location")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Transform notifications to include computed fields
    const transformedNotifications = notifications.map((notification) => ({
      ...notification,
      hoursSinceCreated: Math.ceil(
        (Date.now() - new Date(notification.createdAt).getTime()) /
          (1000 * 60 * 60)
      ),
      isExpired: notification.expiresAt
        ? new Date() > notification.expiresAt
        : false,
      isUrgent:
        notification.priority === "urgent" || notification.actionRequired,
    }));

    return successResponse(res, {
      notifications: transformedNotifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return errorResponse(res, "Failed to fetch notifications", 500);
  }
});

// Specific routes must come BEFORE parameterized routes
/**
 * @route   GET /api/v1/notifications/stats
 * @desc    Get user's notification statistics
 * @access  Private
 */
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await JobNotification.getUserStats(userId);

    return successResponse(res, { stats });
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    return errorResponse(res, "Failed to fetch notification statistics", 500);
  }
});

/**
 * @route   GET /api/v1/notifications/unread/count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get("/unread/count", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const count = await JobNotification.countDocuments({
      userId,
      isRead: false,
    });

    return successResponse(res, { unreadCount: count });
  } catch (error) {
    console.error("Error counting unread notifications:", error);
    return errorResponse(res, "Failed to count unread notifications", 500);
  }
});

/**
 * @route   GET /api/v1/notifications/urgent
 * @desc    Get urgent notifications for user
 * @access  Private
 */
router.get("/urgent", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const urgentNotifications = await JobNotification.findUrgent(userId)
      .populate("jobId", "title company location")
      .limit(parseInt(limit))
      .lean();

    // Transform notifications to include computed fields
    const transformedNotifications = urgentNotifications.map(
      (notification) => ({
        ...notification,
        hoursSinceCreated: Math.ceil(
          (Date.now() - new Date(notification.createdAt).getTime()) /
            (1000 * 60 * 60)
        ),
        isExpired: notification.expiresAt
          ? new Date() > notification.expiresAt
          : false,
        isUrgent: true,
      })
    );

    return successResponse(res, {
      urgentNotifications: transformedNotifications,
      count: transformedNotifications.length,
    });
  } catch (error) {
    console.error("Error fetching urgent notifications:", error);
    return errorResponse(res, "Failed to fetch urgent notifications", 500);
  }
});

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all user's notifications as read
 * @access  Private
 */
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await JobNotification.markAllAsRead(userId);

    return successResponse(res, {
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return errorResponse(res, "Failed to mark notifications as read", 500);
  }
});

/**
 * @route   GET /api/v1/notifications/:id
 * @desc    Get a specific notification by ID
 * @access  Private
 */
router.get("/:id", authenticateToken, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await JobNotification.findOne({ _id: id, userId })
      .populate("jobId", "title company location")
      .lean();

    if (!notification) {
      return errorResponse(res, "Notification not found", 404);
    }

    // Add computed fields
    notification.hoursSinceCreated = Math.ceil(
      (Date.now() - new Date(notification.createdAt).getTime()) /
        (1000 * 60 * 60)
    );
    notification.isExpired = notification.expiresAt
      ? new Date() > notification.expiresAt
      : false;
    notification.isUrgent =
      notification.priority === "urgent" || notification.actionRequired;

    return successResponse(res, { notification });
  } catch (error) {
    console.error("Error fetching notification:", error);
    return errorResponse(res, "Failed to fetch notification", 500);
  }
});

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put(
  "/:id/read",
  authenticateToken,
  validateObjectId,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const notification = await JobNotification.findOne({ _id: id, userId });

      if (!notification) {
        return errorResponse(res, "Notification not found", 404);
      }

      if (notification.isRead) {
        return successResponse(res, {
          message: "Notification is already marked as read",
        });
      }

      await notification.markAsRead();

      return successResponse(res, {
        message: "Notification marked as read",
        notification: notification.toSafeObject(),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return errorResponse(res, "Failed to mark notification as read", 500);
    }
  }
);

/**
 * @route   PUT /api/v1/notifications/:id/unread
 * @desc    Mark a notification as unread
 * @access  Private
 */
router.put(
  "/:id/unread",
  authenticateToken,
  validateObjectId,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const notification = await JobNotification.findOne({ _id: id, userId });

      if (!notification) {
        return errorResponse(res, "Notification not found", 404);
      }

      if (!notification.isRead) {
        return successResponse(res, {
          message: "Notification is already marked as unread",
        });
      }

      await notification.markAsUnread();

      return successResponse(res, {
        message: "Notification marked as unread",
        notification: notification.toSafeObject(),
      });
    } catch (error) {
      console.error("Error marking notification as unread:", error);
      return errorResponse(res, "Failed to mark notification as unread", 500);
    }
  }
);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a specific notification
 * @access  Private
 */
router.delete("/:id", authenticateToken, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await JobNotification.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!notification) {
      return errorResponse(res, "Notification not found", 404);
    }

    return successResponse(res, {
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return errorResponse(res, "Failed to delete notification", 500);
  }
});

/**
 * @route   DELETE /api/v1/notifications
 * @desc    Delete multiple notifications
 * @access  Private
 */
router.delete("/", authenticateToken, async (req, res) => {
  try {
    const { ids, isRead, olderThan } = req.body;
    const userId = req.user.userId;

    let query = { userId };

    // Build query based on provided filters
    if (ids && Array.isArray(ids) && ids.length > 0) {
      query._id = { $in: ids };
    }
    if (isRead !== undefined) {
      query.isRead = isRead;
    }
    if (olderThan) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));
      query.createdAt = { $lt: cutoffDate };
    }

    const result = await JobNotification.deleteMany(query);

    return successResponse(res, {
      message: `${result.deletedCount} notifications deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    return errorResponse(res, "Failed to delete notifications", 500);
  }
});

module.exports = router;
