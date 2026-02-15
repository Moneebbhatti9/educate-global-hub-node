/**
 * Ad Tier Seeder
 * Populates the database with initial ad pricing tiers from Excel revenue data.
 *
 * Pricing from "Revenue Streams Oct 25.xls":
 * - Featured Job Listing: £100/listing normal, £40/listing launch (60% off)
 * - Display Advertising: £200/month normal, £80/month launch (60% off)
 * - Launch discount applies for first 10 months
 *
 * Run with: node src/seeds/adTierSeeder.js
 * Clear & reseed: node src/seeds/adTierSeeder.js --clear
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/database");
const AdTier = require("../models/AdTier");

// ============================================
// SEEDER FUNCTION
// ============================================

async function seedAdTiers() {
  try {
    console.log("🌱 Starting Ad Tier seeder...");

    await connectDB();
    console.log("✅ Connected to database");

    // Check command line args
    const args = process.argv.slice(2);
    const shouldClear = args.includes("--clear");

    if (shouldClear) {
      console.log("🗑️  Clearing existing ad tiers...");
      await AdTier.deleteMany({});
      console.log("✅ Cleared all ad tiers");
    }

    // Use the model's built-in initializeDefaults method
    console.log("📦 Seeding ad tiers from Excel pricing data...");
    await AdTier.initializeDefaults();

    // Verify seeded data
    const tiers = await AdTier.find({}).sort({ sortOrder: 1 });

    console.log("\n📊 Seeding Summary:");
    console.log(`   Total ad tiers in DB: ${tiers.length}`);
    console.log("");

    for (const tier of tiers) {
      const normalPrice = tier.normalPrice
        ? parseFloat(tier.normalPrice.toString()) / 100
        : 0;
      const launchPrice = tier.launchPrice
        ? parseFloat(tier.launchPrice.toString()) / 100
        : 0;

      console.log(`   📌 ${tier.name}`);
      console.log(`      Slug: ${tier.slug}`);
      console.log(`      Normal: £${normalPrice.toFixed(2)}`);
      console.log(`      Launch: £${launchPrice.toFixed(2)}`);
      console.log(`      Duration: ${tier.durationLabel}`);
      console.log(`      Features: ${tier.features.length}`);
      console.log(`      Active: ${tier.isActive}`);
      console.log("");
    }

    console.log("✅ Ad Tier seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ad Tier seeding failed:", error);
    process.exit(1);
  }
}

// Run seeder
seedAdTiers();
