const cron = require("node-cron");
const AdRequest = require("../models/AdRequest");
const JobNotification = require("../models/JobNotification");

let cronTask = null;

/**
 * Send ad expiration notification to the school owner
 */
const sendExpirationNotification = async (adRequest) => {
  try {
    await JobNotification.create({
      userId: adRequest.schoolId,
      jobId: adRequest.jobId,
      type: "ad_expired",
      title: "Your Ad Has Expired",
      message: `Your advertisement has expired. You can submit a new ad request to continue promoting your job.`,
      priority: "medium",
      category: "advertisement",
      actionRequired: false,
      actionUrl: "/dashboard/school/my-advertisements",
      actionText: "View Advertisements",
    });
  } catch (error) {
    console.error("Failed to send ad expiration notification:", error);
  }
};

/**
 * Run the ad expiration check
 * Finds active ads past their expiresAt date, expires them, and notifies owners
 */
const runExpirationCheck = async () => {
  try {
    // Find ads that are about to be expired (before updateMany wipes the data)
    const expiredAds = await AdRequest.find({
      status: "ACTIVE",
      expiresAt: { $lte: new Date() },
    }).select("schoolId jobId");

    // Expire them
    const count = await AdRequest.expireOverdueAds();

    if (count > 0) {
      console.log(`[AdCron] Expired ${count} overdue ad(s)`);

      // Send notifications
      for (const ad of expiredAds) {
        await sendExpirationNotification(ad);
      }
    }
  } catch (error) {
    console.error("[AdCron] Error during expiration check:", error);
  }
};

/**
 * Start the ad expiration cron job
 * Runs every hour at minute 0
 */
const startAdCron = () => {
  cronTask = cron.schedule("0 * * * *", runExpirationCheck);
  console.log("Ad expiration cron started (runs every hour)");
};

/**
 * Stop the ad expiration cron job
 */
const stopAdCron = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("Ad expiration cron stopped");
  }
};

module.exports = { startAdCron, stopAdCron };
