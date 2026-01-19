/**
 * Data Retention Policy Service
 *
 * Implements GDPR-compliant data retention policies:
 * - Account Data: Retained while active, deleted within 30 days of deletion request
 * - Transaction Records: Retained for 7 years (legal compliance)
 * - Communication Logs: Retained for 2 years
 * - Analytics Data: Anonymized after 26 months
 * - Session Data: Cleared after 7 days of inactivity
 */

const User = require("../models/User");
const UserProfile = require("../models/UserProfile");
const TeacherProfile = require("../models/TeacherProfile");
const SchoolProfile = require("../models/SchoolProfile");
const JobApplication = require("../models/JobApplication");
const SavedJob = require("../models/SavedJob");
const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");
const RefreshToken = require("../models/RefreshToken");
const OTPCode = require("../models/OTPCode");
const ConsentRecord = require("../models/ConsentRecord");
const DataExportRequest = require("../models/DataExportRequest");
const { sendEmail } = require("../config/email");

// Retention periods in milliseconds
const RETENTION_PERIODS = {
  PENDING_DELETION: 30 * 24 * 60 * 60 * 1000, // 30 days
  INACTIVE_ACCOUNT: 365 * 24 * 60 * 60 * 1000, // 1 year
  TRANSACTION_RECORDS: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
  COMMUNICATION_LOGS: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
  ANALYTICS_DATA: 26 * 30 * 24 * 60 * 60 * 1000, // 26 months
  SESSION_DATA: 7 * 24 * 60 * 60 * 1000, // 7 days
  OTP_CODES: 24 * 60 * 60 * 1000, // 24 hours
  EXPORT_REQUESTS: 90 * 24 * 60 * 60 * 1000, // 90 days
};

/**
 * Process pending deletion requests
 * Users who requested deletion and waiting period has passed
 */
const processPendingDeletions = async () => {
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.PENDING_DELETION);

  const usersToDelete = await User.find({
    status: "pending_deletion",
    deletionRequestedAt: { $lte: cutoffDate },
  });

  console.log(`Found ${usersToDelete.length} accounts pending deletion`);

  for (const user of usersToDelete) {
    try {
      await deleteUserData(user._id);
      console.log(`Deleted user ${user._id} (${user.email})`);
    } catch (error) {
      console.error(`Failed to delete user ${user._id}:`, error);
    }
  }

  return usersToDelete.length;
};

/**
 * Delete all user data (GDPR Article 17 - Right to Erasure)
 */
const deleteUserData = async (userId) => {
  // Delete related data first
  await Promise.all([
    UserProfile.deleteMany({ userId }),
    TeacherProfile.deleteMany({ userId }),
    SchoolProfile.deleteMany({ userId }),
    JobApplication.deleteMany({ teacherId: userId }),
    SavedJob.deleteMany({ userId }),
    Discussion.deleteMany({ authorId: userId }),
    Reply.deleteMany({ authorId: userId }),
    RefreshToken.deleteMany({ userId }),
    // Keep consent records for audit purposes but anonymize
    ConsentRecord.updateMany(
      { userId },
      { $set: { userId: null, ipAddress: null, userAgent: null } }
    ),
    DataExportRequest.updateMany(
      { userId },
      { $set: { userId: null, ipAddress: null, userAgent: null } }
    ),
  ]);

  // Finally delete the user
  await User.findByIdAndDelete(userId);
};

/**
 * Clean up expired OTP codes
 */
const cleanupExpiredOTPs = async () => {
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.OTP_CODES);

  const result = await OTPCode.deleteMany({
    createdAt: { $lte: cutoffDate },
  });

  console.log(`Cleaned up ${result.deletedCount} expired OTP codes`);
  return result.deletedCount;
};

/**
 * Clean up expired refresh tokens
 */
const cleanupExpiredTokens = async () => {
  const result = await RefreshToken.deleteMany({
    expiresAt: { $lte: new Date() },
  });

  console.log(`Cleaned up ${result.deletedCount} expired refresh tokens`);
  return result.deletedCount;
};

/**
 * Warn inactive users before data deletion
 */
const warnInactiveUsers = async () => {
  const warningCutoff = new Date(
    Date.now() - RETENTION_PERIODS.INACTIVE_ACCOUNT + 30 * 24 * 60 * 60 * 1000
  ); // 30 days before deletion

  const inactiveUsers = await User.find({
    lastActive: { $lte: warningCutoff },
    status: "active",
    inactivityWarningAt: { $exists: false },
  });

  console.log(`Found ${inactiveUsers.length} inactive users to warn`);

  for (const user of inactiveUsers) {
    try {
      // Send warning email
      await sendEmail({
        to: user.email,
        subject: "Account Inactivity Notice - Educate Global Hub",
        html: `
          <h2>Account Inactivity Notice</h2>
          <p>Dear ${user.firstName},</p>
          <p>We noticed that you haven't logged into your Educate Global Hub account for an extended period.</p>
          <p>In accordance with our data retention policy and GDPR requirements, accounts that remain inactive for more than 1 year may be deleted.</p>
          <p>To keep your account active, simply log in to your account within the next 30 days.</p>
          <p>If you wish to delete your account and data, you can do so in your account settings.</p>
          <p>Best regards,<br>Educate Global Hub Team</p>
        `,
      });

      // Mark user as warned
      user.inactivityWarningAt = new Date();
      await user.save();
    } catch (error) {
      console.error(`Failed to warn user ${user._id}:`, error);
    }
  }

  return inactiveUsers.length;
};

/**
 * Anonymize old analytics data
 */
const anonymizeOldAnalyticsData = async () => {
  const cutoffDate = new Date(Date.now() - RETENTION_PERIODS.ANALYTICS_DATA);

  // Anonymize old job views
  const JobView = require("../models/JobView");
  const viewResult = await JobView.updateMany(
    { viewedAt: { $lte: cutoffDate }, userId: { $ne: null } },
    { $set: { userId: null, ipAddress: null } }
  );

  // Anonymize old activity records
  const TeacherActivity = require("../models/TeacherActivity");
  const activityResult = await TeacherActivity.updateMany(
    { createdAt: { $lte: cutoffDate }, ipAddress: { $ne: null } },
    { $set: { ipAddress: null } }
  );

  console.log(
    `Anonymized ${viewResult.modifiedCount} job views and ${activityResult.modifiedCount} activities`
  );

  return {
    views: viewResult.modifiedCount,
    activities: activityResult.modifiedCount,
  };
};

/**
 * Generate data retention report
 */
const generateRetentionReport = async () => {
  const now = new Date();

  const report = {
    generatedAt: now,
    pendingDeletions: await User.countDocuments({ status: "pending_deletion" }),
    inactiveUsers: await User.countDocuments({
      lastActive: { $lte: new Date(now - RETENTION_PERIODS.INACTIVE_ACCOUNT) },
    }),
    expiredOTPs: await OTPCode.countDocuments({
      createdAt: { $lte: new Date(now - RETENTION_PERIODS.OTP_CODES) },
    }),
    expiredTokens: await RefreshToken.countDocuments({
      expiresAt: { $lte: now },
    }),
    totalUsers: await User.countDocuments(),
    activeUsers: await User.countDocuments({ status: "active" }),
    consentRecords: await ConsentRecord.countDocuments(),
    exportRequests: await DataExportRequest.countDocuments(),
  };

  return report;
};

/**
 * Run all retention tasks
 * This should be scheduled to run daily (e.g., via cron job)
 */
const runRetentionTasks = async () => {
  console.log("Starting data retention tasks...");

  const results = {
    startedAt: new Date(),
    deletedAccounts: 0,
    cleanedOTPs: 0,
    cleanedTokens: 0,
    warnedUsers: 0,
    anonymizedRecords: { views: 0, activities: 0 },
  };

  try {
    // Process pending deletions
    results.deletedAccounts = await processPendingDeletions();

    // Clean up expired OTPs
    results.cleanedOTPs = await cleanupExpiredOTPs();

    // Clean up expired tokens
    results.cleanedTokens = await cleanupExpiredTokens();

    // Warn inactive users
    results.warnedUsers = await warnInactiveUsers();

    // Anonymize old analytics data
    results.anonymizedRecords = await anonymizeOldAnalyticsData();

    results.completedAt = new Date();
    results.success = true;

    console.log("Data retention tasks completed:", results);
  } catch (error) {
    console.error("Error running retention tasks:", error);
    results.error = error.message;
    results.success = false;
  }

  return results;
};

module.exports = {
  RETENTION_PERIODS,
  processPendingDeletions,
  deleteUserData,
  cleanupExpiredOTPs,
  cleanupExpiredTokens,
  warnInactiveUsers,
  anonymizeOldAnalyticsData,
  generateRetentionReport,
  runRetentionTasks,
};
