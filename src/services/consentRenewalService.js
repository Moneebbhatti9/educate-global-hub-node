const cron = require("node-cron");
const ConsentRecord = require("../models/ConsentRecord");
const User = require("../models/User");
const { sendEmail } = require("../config/email");

let cronTask = null;

/**
 * Check for expiring talent pool consents and send renewal reminders.
 * Finds consents expiring within 30 days that haven't been reminded
 * in the last 7 days (prevents spam).
 */
const checkConsentExpiry = async () => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiringConsents = await ConsentRecord.find({
      consentType: "talent_pool",
      action: "granted",
      isActive: true,
      expiresAt: {
        $gte: now,
        $lte: thirtyDaysFromNow,
      },
      $or: [
        { "metadata.renewalReminderSentAt": null },
        { "metadata.renewalReminderSentAt": { $exists: false } },
        { "metadata.renewalReminderSentAt": { $lte: sevenDaysAgo } },
      ],
    }).populate("userId", "email firstName");

    if (expiringConsents.length === 0) {
      return;
    }

    console.log(
      `[ConsentRenewal] Found ${expiringConsents.length} expiring consent(s)`
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    for (const consent of expiringConsents) {
      if (!consent.userId || !consent.userId.email) {
        continue;
      }

      const daysUntilExpiry = Math.ceil(
        (consent.expiresAt - now) / (1000 * 60 * 60 * 24)
      );

      try {
        await sendEmail(
          consent.userId.email,
          "Talent Pool Consent Renewal Reminder - Educate Link",
          `<h2>Talent Pool Consent Renewal</h2>
           <p>Dear ${consent.userId.firstName},</p>
           <p>Your consent to appear in the Educate Link talent pool expires in <strong>${daysUntilExpiry} days</strong>.</p>
           <p>To continue being visible to schools, please renew your consent:</p>
           <p><a href="${frontendUrl}/dashboard/teacher/teacher-profile">Renew Consent</a></p>
           <p>If you do not wish to renew, no action is needed. Your profile will be removed from the talent pool automatically.</p>
           <p>Best regards,<br>Educate Link Team</p>`
        );

        // Track reminder sent to prevent spam
        consent.metadata = consent.metadata || {};
        consent.metadata.renewalReminderSentAt = new Date();
        consent.markModified("metadata");
        await consent.save();
      } catch (emailError) {
        console.error(
          `[ConsentRenewal] Failed to send reminder to ${consent.userId.email}:`,
          emailError.message
        );
        // Don't fail the entire batch if one email fails
      }
    }
  } catch (error) {
    console.error("[ConsentRenewal] Error during consent expiry check:", error);
  }
};

/**
 * Start the consent renewal cron job
 * Runs daily at 2 AM
 */
const startConsentRenewalCron = () => {
  cronTask = cron.schedule("0 2 * * *", checkConsentExpiry);
  console.log("Consent renewal cron started (runs daily at 2 AM)");
};

/**
 * Stop the consent renewal cron job
 */
const stopConsentRenewalCron = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("Consent renewal cron stopped");
  }
};

module.exports = { startConsentRenewalCron, stopConsentRenewalCron };
