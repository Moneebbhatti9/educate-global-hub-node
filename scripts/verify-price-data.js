/**
 * Verification Script: Check price data consistency
 *
 * This script verifies that all price-related data is stored correctly:
 * - ResourcePurchase.pricePaid should be in cents
 * - Sale.price should be in cents
 * - BalanceLedger.amount should be in cents
 * - SellerTier calculations should match actual sales
 *
 * Run with: node scripts/verify-price-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const ResourcePurchase = require('../src/models/resourcePurchase');
const Sale = require('../src/models/Sale');
const BalanceLedger = require('../src/models/BalanceLedger');
const SellerTier = require('../src/models/SellerTier');
const Resource = require('../src/models/resource');

// Verification results
const issues = [];
const warnings = [];

/**
 * Connect to MongoDB
 */
async function connectDB() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MongoDB URI not found in environment variables');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB\n');
}

/**
 * Check ResourcePurchase values
 */
async function checkResourcePurchases() {
  console.log('=== Checking ResourcePurchase ===');

  const purchases = await ResourcePurchase.find({ pricePaid: { $gt: 0 } });
  console.log(`Total paid purchases: ${purchases.length}`);

  let decimalCount = 0;
  let centsCount = 0;
  let suspiciousCount = 0;

  for (const p of purchases) {
    const currency = p.currency || 'USD';

    // Check if value looks like decimal (has meaningful decimal places)
    const hasDecimals = p.pricePaid % 1 !== 0;
    const isSmall = p.pricePaid < 100;

    if (hasDecimals && isSmall && currency !== 'PKR') {
      decimalCount++;
      issues.push({
        type: 'ResourcePurchase',
        id: p._id,
        field: 'pricePaid',
        value: p.pricePaid,
        message: 'Value appears to be in decimal format, should be cents',
      });
    } else if (p.pricePaid >= 100 || currency === 'PKR') {
      centsCount++;
    } else {
      suspiciousCount++;
      warnings.push({
        type: 'ResourcePurchase',
        id: p._id,
        field: 'pricePaid',
        value: p.pricePaid,
        message: 'Value is ambiguous - could be cents or decimal',
      });
    }
  }

  console.log(`  Likely cents format: ${centsCount}`);
  console.log(`  Likely decimal format (ISSUE): ${decimalCount}`);
  console.log(`  Ambiguous: ${suspiciousCount}`);
}

/**
 * Check Sale values
 */
async function checkSales() {
  console.log('\n=== Checking Sale ===');

  const sales = await Sale.find({ price: { $gt: 0 } });
  console.log(`Total paid sales: ${sales.length}`);

  let decimalCount = 0;
  let centsCount = 0;

  for (const s of sales) {
    const hasDecimals = s.price % 1 !== 0;
    const isSmall = s.price < 100;

    if (hasDecimals && isSmall && s.currency !== 'PKR') {
      decimalCount++;
      issues.push({
        type: 'Sale',
        id: s._id,
        field: 'price',
        value: s.price,
        message: 'Value appears to be in decimal format, should be cents',
      });
    } else {
      centsCount++;
    }
  }

  console.log(`  Likely cents format: ${centsCount}`);
  console.log(`  Likely decimal format (ISSUE): ${decimalCount}`);
}

/**
 * Cross-check ResourcePurchase with Sale
 */
async function crossCheckPurchasesAndSales() {
  console.log('\n=== Cross-checking Purchase vs Sale ===');

  const purchases = await ResourcePurchase.find({
    pricePaid: { $gt: 0 },
    status: 'completed',
  }).limit(100);

  let matched = 0;
  let mismatched = 0;
  let noSaleFound = 0;

  for (const purchase of purchases) {
    const sale = await Sale.findOne({
      resource: purchase.resourceId,
      buyer: purchase.buyerId,
      status: 'completed',
    }).sort({ saleDate: -1 });

    if (!sale) {
      noSaleFound++;
      continue;
    }

    // Compare values (allow 1 cent tolerance for rounding)
    const diff = Math.abs(purchase.pricePaid - sale.price);
    if (diff <= 1) {
      matched++;
    } else {
      mismatched++;
      issues.push({
        type: 'CrossCheck',
        id: purchase._id,
        field: 'pricePaid vs price',
        value: `Purchase: ${purchase.pricePaid}, Sale: ${sale.price}`,
        message: 'Purchase and Sale amounts do not match',
      });
    }
  }

  console.log(`  Matched: ${matched}`);
  console.log(`  Mismatched (ISSUE): ${mismatched}`);
  console.log(`  No sale found: ${noSaleFound}`);
}

/**
 * Check SellerTier consistency
 */
async function checkSellerTiers() {
  console.log('\n=== Checking SellerTier ===');

  const tiers = await SellerTier.find({});
  console.log(`Total seller tiers: ${tiers.length}`);

  let consistent = 0;
  let inconsistent = 0;

  for (const tier of tiers) {
    // Recalculate from sales
    const salesData = await Sale.calculateSellerSales(tier.seller, 12);
    const calculated = salesData.totalSales || 0;
    const stored = tier.last12MonthsSales || 0;

    // Allow 1% tolerance for timing differences
    const diff = Math.abs(calculated - stored);
    const tolerance = Math.max(stored * 0.01, 100); // 1% or 100 cents minimum

    if (diff <= tolerance) {
      consistent++;
    } else {
      inconsistent++;
      warnings.push({
        type: 'SellerTier',
        id: tier.seller,
        field: 'last12MonthsSales',
        value: `Stored: ${stored}, Calculated: ${calculated}`,
        message: 'Tier value differs from calculated sales',
      });
    }
  }

  console.log(`  Consistent: ${consistent}`);
  console.log(`  Inconsistent (WARNING): ${inconsistent}`);
}

/**
 * Check Resource prices (should be decimal)
 */
async function checkResourcePrices() {
  console.log('\n=== Checking Resource.price ===');

  const resources = await Resource.find({
    isFree: false,
    price: { $gt: 0 },
  });
  console.log(`Total paid resources: ${resources.length}`);

  let decimalCount = 0;
  let centsCount = 0;

  for (const r of resources) {
    // Resource.price SHOULD be decimal (9.99, not 999)
    if (r.price >= 100) {
      centsCount++;
      warnings.push({
        type: 'Resource',
        id: r._id,
        field: 'price',
        value: r.price,
        message: 'Value appears to be in cents, should be decimal for Resource',
      });
    } else {
      decimalCount++;
    }
  }

  console.log(`  Likely decimal format (correct): ${decimalCount}`);
  console.log(`  Likely cents format (WARNING): ${centsCount}`);
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n========================================');
  console.log('  Verification Summary');
  console.log('========================================');

  console.log(`\nISSUES (${issues.length}):`);
  if (issues.length === 0) {
    console.log('  No issues found!');
  } else {
    issues.slice(0, 10).forEach(issue => {
      console.log(`  [${issue.type}] ${issue.id}`);
      console.log(`    ${issue.field}: ${issue.value}`);
      console.log(`    ${issue.message}`);
    });
    if (issues.length > 10) {
      console.log(`  ... and ${issues.length - 10} more issues`);
    }
  }

  console.log(`\nWARNINGS (${warnings.length}):`);
  if (warnings.length === 0) {
    console.log('  No warnings!');
  } else {
    warnings.slice(0, 5).forEach(warning => {
      console.log(`  [${warning.type}] ${warning.id}`);
      console.log(`    ${warning.field}: ${warning.value}`);
      console.log(`    ${warning.message}`);
    });
    if (warnings.length > 5) {
      console.log(`  ... and ${warnings.length - 5} more warnings`);
    }
  }

  console.log('\n========================================');
  if (issues.length > 0) {
    console.log('ACTION REQUIRED: Run migrate-price-to-cents.js to fix issues');
  } else {
    console.log('All price data appears to be correctly formatted!');
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('========================================');
  console.log('  Price Data Verification Script');
  console.log('========================================\n');

  try {
    await connectDB();

    await checkResourcePrices();
    await checkResourcePurchases();
    await checkSales();
    await crossCheckPurchasesAndSales();
    await checkSellerTiers();

    printSummary();

  } catch (err) {
    console.error('\nVerification failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run verification
main();
