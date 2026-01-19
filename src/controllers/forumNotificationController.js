const ForumNotification = require("../models/ForumNotification");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Get all notifications for the authenticated user
 * LinkedIn-style: Returns paginated list with unread count
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const skip = (pageNum - 1) * pageSize;

    const query = { recipient: userId };
    if (unreadOnly === "true") {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      ForumNotification.find(query)
        .populate("sender", "firstName lastName avatarUrl role")
        .populate("discussion", "title")
        .populate("comment", "content")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      ForumNotification.countDocuments(query),
      ForumNotification.countDocuments({ recipient: userId, isRead: false }),
    ]);

    return successResponse(res, {
      notifications,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      unreadCount,
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    return errorResponse(res, "Failed to fetch notifications", 500);
  }
};

/**
 * Mark notification(s) as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationIds } = req.body; // Array of notification IDs or "all"

    if (notificationIds === "all") {
      await ForumNotification.updateMany(
        { recipient: userId, isRead: false },
        { isRead: true }
      );
      return successResponse(res, null, "All notifications marked as read");
    }

    if (!Array.isArray(notificationIds)) {
      return errorResponse(res, "Invalid notification IDs", 400);
    }

    await ForumNotification.updateMany(
      { _id: { $in: notificationIds }, recipient: userId },
      { isRead: true }
    );

    return successResponse(res, null, "Notifications marked as read");
  } catch (err) {
    console.error("markAsRead error:", err);
    return errorResponse(res, "Failed to mark notifications as read", 500);
  }
};

/**
 * Delete notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const notification = await ForumNotification.findOneAndDelete({
      _id: id,
      recipient: userId,
    });

    if (!notification) {
      return errorResponse(res, "Notification not found", 404);
    }

    return successResponse(res, null, "Notification deleted");
  } catch (err) {
    console.error("deleteNotification error:", err);
    return errorResponse(res, "Failed to delete notification", 500);
  }
};

/**
 * Helper function to create a notification
 * Called from other controllers (discussion, reply)
 */
exports.createNotification = async ({
  recipient,
  sender,
  type,
  discussion,
  comment,
  message,
}) => {
  try {
    // Don't notify yourself
    if (recipient.toString() === sender.toString()) {
      return null;
    }

    const notification = await ForumNotification.create({
      recipient,
      sender,
      type,
      discussion,
      comment,
      message,
    });

    await notification.populate("sender", "firstName lastName avatarUrl role");
    await notification.populate("discussion", "title");

    return notification;
  } catch (err) {
    console.error("createNotification error:", err);
    return null;
  }
};

/**
 * Get unread notification count
 * For displaying badge in navbar
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await ForumNotification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return successResponse(res, { count });
  } catch (err) {
    console.error("getUnreadCount error:", err);
    return errorResponse(res, "Failed to fetch unread count", 500);
  }
};
