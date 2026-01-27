/**
 * Create Test Notification Script
 *
 * This script creates a test notification for a specific user
 * to verify real-time Socket.IO delivery is working.
 *
 * Usage:
 *   node scripts/create-test-notification.js <userId>
 *
 * Example:
 *   node scripts/create-test-notification.js 507f1f77bcf86cd799439011
 *
 * Prerequisites:
 *   - MongoDB running
 *   - Set MONGODB_URI in .env or environment
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Colors for console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function createTestNotification(userId) {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/educate-link";

  try {
    log("\nConnecting to MongoDB...", "cyan");
    await mongoose.connect(MONGODB_URI);
    log("Connected to MongoDB", "green");

    // Import models after connection
    const JobNotification = require("../src/models/JobNotification");
    const ForumNotification = require("../src/models/ForumNotification");
    const User = require("../src/models/User");

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      log(`User not found: ${userId}`, "red");
      log("\nTo find a valid user ID, run:", "yellow");
      log("  db.users.findOne({}, {_id: 1, email: 1})", "cyan");
      process.exit(1);
    }

    log(`\nFound user: ${user.firstName} ${user.lastName} (${user.email})`, "green");

    // Create Job Notification (without actionUrl to avoid validation issues)
    log("\nCreating test job notification...", "cyan");
    const jobNotification = await JobNotification.create({
      userId: userId,
      type: "system_alert",
      category: "system",
      priority: "high",
      title: "Test Notification",
      message: `This is a test notification created at ${new Date().toLocaleTimeString()}`,
      isRead: false,
      metadata: {
        testId: Date.now().toString(),
        source: "test-script",
      },
    });

    log("Job notification created:", "green");
    console.log({
      id: jobNotification._id.toString(),
      type: jobNotification.type,
      title: jobNotification.title,
      message: jobNotification.message,
      createdAt: jobNotification.createdAt,
    });

    // Create Forum Notification (if user exists as a discussion author)
    log("\nCreating test forum notification...", "cyan");
    const forumNotification = await ForumNotification.create({
      recipient: userId,
      sender: userId, // Self-notification for testing
      type: "mention",
      message: `Test forum notification at ${new Date().toLocaleTimeString()}`,
      isRead: false,
    });

    log("Forum notification created:", "green");
    console.log({
      id: forumNotification._id.toString(),
      type: forumNotification.type,
      message: forumNotification.message,
      createdAt: forumNotification.createdAt,
    });

    log("\n✓ Test notifications created successfully!", "green");
    log("\nTo verify real-time delivery:", "yellow");
    log("1. Open the app in a browser", "cyan");
    log("2. Log in as this user", "cyan");
    log("3. Check the notification bell icon", "cyan");
    log("4. The new notifications should appear", "cyan");

    log("\nTo clean up test notifications:", "yellow");
    log(`  db.jobnotifications.deleteMany({metadata: {testId: "${jobNotification.metadata?.testId}"}})`, "cyan");

  } catch (error) {
    log(`Error: ${error.message}`, "red");
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log("\nDisconnected from MongoDB", "cyan");
  }
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.log(`
Usage: node scripts/create-test-notification.js <userId>

This script creates test notifications for a specific user to verify
the notification system is working correctly.

To find a user ID:
  1. Check MongoDB: db.users.findOne({email: "user@example.com"}, {_id: 1})
  2. Or use the admin dashboard to view user details

Example:
  node scripts/create-test-notification.js 507f1f77bcf86cd799439011
`);
  process.exit(1);
}

// Validate MongoDB ObjectId format
if (!/^[a-fA-F0-9]{24}$/.test(userId)) {
  log("Invalid user ID format. Must be a 24-character hex string.", "red");
  process.exit(1);
}

createTestNotification(userId);
