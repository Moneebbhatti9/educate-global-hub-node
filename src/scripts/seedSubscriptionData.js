/**
 * Seed Script: Subscription System Data
 *
 * Initializes default data for the subscription system:
 * - System settings (global subscription toggle)
 * - Feature definitions
 * - Default subscription plans
 *
 * Run: node src/scripts/seedSubscriptionData.js
 * Or call initializeSubscriptionSystem() during app startup
 */

const mongoose = require("mongoose");
require("dotenv").config();

const SystemSettings = require("../models/SystemSettings");
const Feature = require("../models/Feature");
const SubscriptionPlan = require("../models/SubscriptionPlan");

/**
 * Initialize all subscription system defaults
 * Safe to call multiple times - won't duplicate existing data
 */
const initializeSubscriptionSystem = async () => {
  console.log("🔧 Initializing subscription system data...");

  try {
    // Initialize system settings
    await SystemSettings.initializeDefaults();
    console.log("  ✓ System settings initialized");

    // Initialize features
    await Feature.initializeDefaults();
    console.log("  ✓ Features initialized");

    // Initialize subscription plans
    await SubscriptionPlan.initializeDefaults();
    console.log("  ✓ Subscription plans initialized");

    console.log("✅ Subscription system initialization complete");

    // Log current state
    const toggleState = await SystemSettings.isSubscriptionEnabled();
    const features = await Feature.find({});
    const plans = await SubscriptionPlan.find({});

    console.log(`\n📊 Current State:`);
    console.log(`   Subscriptions Enabled: ${toggleState}`);
    console.log(`   Features: ${features.length}`);
    console.log(`   Subscription Plans: ${plans.length}`);

    return { success: true };
  } catch (error) {
    console.error("❌ Error initializing subscription system:", error);
    return { success: false, error };
  }
};

/**
 * Reset all subscription data (for development/testing)
 * WARNING: This deletes all subscription-related data!
 */
const resetSubscriptionSystem = async () => {
  console.log("⚠️  Resetting subscription system data...");

  try {
    await SystemSettings.deleteMany({});
    await Feature.deleteMany({});
    await SubscriptionPlan.deleteMany({});

    console.log("  ✓ All subscription data cleared");

    // Re-initialize defaults
    await initializeSubscriptionSystem();

    return { success: true };
  } catch (error) {
    console.error("❌ Error resetting subscription system:", error);
    return { success: false, error };
  }
};

/**
 * Display current subscription system status
 */
const displayStatus = async () => {
  const toggleState = await SystemSettings.isSubscriptionEnabled();
  const features = await Feature.find({}).sort({ category: 1, sortOrder: 1 });
  const plans = await SubscriptionPlan.find({}).sort({ targetRole: 1, sortOrder: 1 });

  console.log("\n" + "=".repeat(60));
  console.log("SUBSCRIPTION SYSTEM STATUS");
  console.log("=".repeat(60));

  console.log(`\n🔘 Global Toggle: ${toggleState ? "ENABLED" : "DISABLED"}`);

  console.log("\n📋 Features:");
  for (const feature of features) {
    console.log(
      `   [${feature.category}] ${feature.key}: ${feature.name} (${feature.applicableRoles.join(", ")})`
    );
  }

  console.log("\n💳 Subscription Plans:");
  for (const plan of plans) {
    const price = plan.price ? parseFloat(plan.price.toString()) / 100 : 0;
    console.log(
      `   [${plan.targetRole}] ${plan.name}: £${price.toFixed(2)}/${plan.billingPeriod} (${plan.features.length} features)`
    );
  }

  console.log("\n" + "=".repeat(60));
};

// Run as standalone script
if (require.main === module) {
  const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/educate-link";

  mongoose
    .connect(mongoURI)
    .then(async () => {
      console.log("✅ Connected to MongoDB\n");

      const command = process.argv[2];

      if (command === "reset") {
        await resetSubscriptionSystem();
      } else if (command === "status") {
        await displayStatus();
      } else {
        await initializeSubscriptionSystem();
        await displayStatus();
      }

      await mongoose.disconnect();
      console.log("\n✅ Disconnected from MongoDB");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ MongoDB connection failed:", error);
      process.exit(1);
    });
}

module.exports = {
  initializeSubscriptionSystem,
  resetSubscriptionSystem,
  displayStatus,
};
