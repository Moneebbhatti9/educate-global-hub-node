const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  getNotifications,
  markAsRead,
  deleteNotification,
  getUnreadCount,
} = require("../controllers/forumNotificationController");

// Get notifications for authenticated user
router.get("/", authenticateToken, getNotifications);

// Get unread notification count
router.get("/unread-count", authenticateToken, getUnreadCount);

// Mark notifications as read
router.patch("/mark-read", authenticateToken, markAsRead);

// Delete a notification
router.delete("/:id", authenticateToken, deleteNotification);

module.exports = router;
