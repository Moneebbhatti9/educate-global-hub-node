const mongoose = require("mongoose");
const { stripe } = require("../config/stripe");
const { verifyCredentials } = require("../config/cloudinary");
const SystemSettings = require("../models/SystemSettings");
const Feature = require("../models/Feature");
const WebhookEvent = require("../models/WebhookEvent");
const UserSubscription = require("../models/UserSubscription");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Helper: wraps a check function with a timeout.
 * Rejects if the check takes longer than timeoutMs.
 */
const checkWithTimeout = (checkFn, timeoutMs = 5000) => {
  return Promise.race([
    checkFn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Health check timed out")), timeoutMs)
    ),
  ]);
};

/**
 * GET /api/v1/admin/system/status
 * Returns connectivity status for MongoDB, Stripe, Cloudinary, and Socket.IO.
 * Admin-only.
 */
const getSystemHealth = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    // Run all 4 dependency checks in parallel
    const [mongoResult, stripeResult, cloudinaryResult, socketResult] =
      await Promise.allSettled([
        // MongoDB check
        checkWithTimeout(async () => {
          const start = Date.now();
          if (mongoose.connection.readyState !== 1) {
            throw new Error("MongoDB not connected");
          }
          await mongoose.connection.db.admin().ping();
          const latency = Date.now() - start;
          return { status: "healthy", latency };
        }),

        // Stripe check
        checkWithTimeout(async () => {
          const start = Date.now();
          await stripe.balance.retrieve();
          const latency = Date.now() - start;
          return { status: "healthy", latency };
        }),

        // Cloudinary check
        checkWithTimeout(async () => {
          const start = Date.now();
          const result = await verifyCredentials();
          const latency = Date.now() - start;
          if (!result.success) {
            throw new Error(result.error || "Cloudinary verification failed");
          }
          return { status: "healthy", latency };
        }),

        // Socket.IO check
        checkWithTimeout(async () => {
          const start = Date.now();
          const io = req.app.get("io");
          if (!io) {
            throw new Error("Socket.IO instance not found");
          }
          const connectedClients = io.engine.clientsCount;
          const latency = Date.now() - start;
          return { status: "healthy", latency, connectedClients };
        }),
      ]);

    // Process results
    const processResult = (result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        status: "unhealthy",
        latency: 0,
        error: result.reason?.message || "Unknown error",
      };
    };

    const checks = {
      mongodb: processResult(mongoResult),
      stripe: processResult(stripeResult),
      cloudinary: processResult(cloudinaryResult),
      socketio: processResult(socketResult),
    };

    const allHealthy = Object.values(checks).every(
      (check) => check.status === "healthy"
    );
    const totalLatency = Object.values(checks).reduce(
      (sum, check) => sum + (check.latency || 0),
      0
    );

    return successResponse(
      res,
      {
        status: allHealthy ? "healthy" : "degraded",
        uptime,
        timestamp,
        checks,
        totalLatency,
      },
      "System health retrieved"
    );
  } catch (error) {
    console.error("Error in getSystemHealth:", error);
    return errorResponse(res, "Failed to retrieve system health", 500);
  }
};

/**
 * GET /api/v1/admin/system/feature-flags
 * Returns system toggles and individual feature flags.
 * Admin-only.
 */
const getFeatureFlags = async (req, res) => {
  try {
    // Read system toggles
    const subscriptions = await SystemSettings.isSubscriptionEnabled();
    const advertisements = await SystemSettings.getValue("ads-enabled", true);

    // Read all features
    const features = await Feature.find({}).sort({ category: 1, sortOrder: 1 });

    const mappedFeatures = features.map((f) => ({
      key: f.key,
      name: f.name,
      category: f.category,
      isActive: f.isActive,
      applicableRoles: f.applicableRoles,
    }));

    return successResponse(
      res,
      {
        systemToggles: {
          subscriptions: Boolean(subscriptions),
          advertisements: Boolean(advertisements),
        },
        features: mappedFeatures,
      },
      "Feature flags retrieved"
    );
  } catch (error) {
    console.error("Error in getFeatureFlags:", error);
    return errorResponse(res, "Failed to retrieve feature flags", 500);
  }
};

/**
 * GET /api/v1/admin/system/data-consistency
 * Returns webhook event processing stats (last 24h) and subscription state
 * comparison (platform vs Stripe). Admin-only.
 */
const getDataConsistency = async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // --- A. Webhook Event Stats (last 24 hours) ---
    const [statusAgg, typeAgg] = await Promise.all([
      // Group by processingResult
      WebhookEvent.aggregate([
        { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
        {
          $group: {
            _id: "$processingResult",
            count: { $sum: 1 },
          },
        },
      ]),
      // Top 10 event types by count
      WebhookEvent.aggregate([
        { $match: { createdAt: { $gte: twentyFourHoursAgo } } },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Build webhook stats object
    const statusMap = {};
    let total = 0;
    for (const entry of statusAgg) {
      statusMap[entry._id] = entry.count;
      total += entry.count;
    }

    const webhookStats = {
      total,
      processed: statusMap.success || 0,
      failed: statusMap.failed || 0,
      pending: statusMap.pending || 0,
      byType: typeAgg.map((t) => ({ type: t._id, count: t.count })),
    };

    // --- B. Subscription State Comparison (platform vs Stripe -- sampled) ---
    const platformSubs = await UserSubscription.find({
      status: { $in: ["active", "trial", "past_due"] },
      stripeSubscriptionId: { $exists: true, $ne: null },
    })
      .select("_id stripeSubscriptionId status")
      .limit(10)
      .lean();

    let subscriptionConsistency = {
      checked: 0,
      matched: 0,
      mismatched: 0,
      errors: 0,
      details: [],
    };

    if (platformSubs.length > 0) {
      // Status mapping: Stripe status -> expected platform status
      const stripeToplatformStatus = {
        active: "active",
        trialing: "trial",
        past_due: "past_due",
        canceled: "cancelled",
        unpaid: "expired",
      };

      const results = await Promise.allSettled(
        platformSubs.map((sub) =>
          checkWithTimeout(async () => {
            const stripeSub = await stripe.subscriptions.retrieve(
              sub.stripeSubscriptionId
            );
            const expectedPlatformStatus =
              stripeToplatformStatus[stripeSub.status] || stripeSub.status;
            const match = sub.status === expectedPlatformStatus;
            return {
              subscriptionId: sub._id.toString(),
              stripeId: sub.stripeSubscriptionId,
              platformStatus: sub.status,
              stripeStatus: stripeSub.status,
              match,
            };
          }, 5000)
        )
      );

      for (const result of results) {
        subscriptionConsistency.checked++;
        if (result.status === "fulfilled") {
          if (result.value.match) {
            subscriptionConsistency.matched++;
          } else {
            subscriptionConsistency.mismatched++;
          }
          subscriptionConsistency.details.push(result.value);
        } else {
          subscriptionConsistency.errors++;
          subscriptionConsistency.details.push({
            subscriptionId: "unknown",
            stripeId: "unknown",
            platformStatus: "unknown",
            stripeStatus: "unknown",
            match: false,
            error: result.reason?.message || "Unknown error",
          });
        }
      }
    }

    return successResponse(
      res,
      {
        webhookStats,
        subscriptionConsistency,
        lastChecked: new Date().toISOString(),
      },
      "Data consistency check complete"
    );
  } catch (error) {
    console.error("Error in getDataConsistency:", error);
    return errorResponse(res, "Failed to retrieve data consistency", 500);
  }
};

module.exports = {
  getSystemHealth,
  getFeatureFlags,
  getDataConsistency,
};
