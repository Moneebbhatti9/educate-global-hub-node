/**
 * Migration Script: Fix Price Value Storage Inconsistencies
 *
 * This script fixes the price storage inconsistencies:
 * 1. Resource.price was stored in CENTS (999) but should be DECIMAL (9.99)
 * 2. ResourcePurchase.pricePaid was stored as DECIMAL (9.99) but should be CENTS (999)
 *
 * Run with: node scripts/migrate-price-to-cents.js
 *
 * Options:
 *   --dry-run    Preview changes without applying them
 *   --backup     Create backup before migration
 *   --verbose    Show detailed logs
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CREATE_BACKUP = args.includes('--backup');
const VERBOSE = args.includes('--verbose');

// Import models
const Resource = require('../src/models/resource');
const ResourcePurchase = require('../src/models/resourcePurchase');
const Sale = require('../src/models/Sale');
const BalanceLedger = require('../src/models/BalanceLedger');
const SellerTier = require('../src/models/SellerTier');

// Migration stats
const stats = {
  resources: { checked: 0, migrated: 0, skipped: 0, errors: 0 },
  resourcePurchases: { checked: 0, migrated: 0, skipped: 0, errors: 0 },
  sellerTiers: { checked: 0, recalculated: 0, errors: 0 },
  startTime: null,
  endTime: null,
};

// Backup collection names
const BACKUP_SUFFIX = `_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

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
  console.log('Connected to MongoDB');
}

/**
 * Create backup of collections before migration
 */
async function createBackup() {
  console.log('\n=== Creating Backups ===');

  const db = mongoose.connection.db;

  // Backup Resource
  try {
    const resources = await Resource.find({}).lean();
    if (resources.length > 0) {
      await db.collection(`resources${BACKUP_SUFFIX}`).insertMany(resources);
      console.log(`  Backed up ${resources.length} Resource documents`);
    }
  } catch (err) {
    console.error('  Error backing up Resource:', err.message);
  }

  // Backup ResourcePurchase
  try {
    const purchases = await ResourcePurchase.find({}).lean();
    if (purchases.length > 0) {
      await db.collection(`resourcepurchases${BACKUP_SUFFIX}`).insertMany(purchases);
      console.log(`  Backed up ${purchases.length} ResourcePurchase documents`);
    }
  } catch (err) {
    console.error('  Error backing up ResourcePurchase:', err.message);
  }

  // Backup SellerTier
  try {
    const tiers = await SellerTier.find({}).lean();
    if (tiers.length > 0) {
      await db.collection(`sellertiers${BACKUP_SUFFIX}`).insertMany(tiers);
      console.log(`  Backed up ${tiers.length} SellerTier documents`);
    }
  } catch (err) {
    console.error('  Error backing up SellerTier:', err.message);
  }

  console.log(`Backups created with suffix: ${BACKUP_SUFFIX}`);
}

/**
 * Detect if a Resource.price is stored in cents (needs conversion to decimal)
 *
 * Logic:
 * - If price >= 100 and is a whole number, it's likely cents
 * - Typical resource prices are $9.99, $23, $12 (decimal) not 999, 2300, 1200 (cents)
 */
function resourcePriceNeedsConversion(price, currency = 'GBP') {
  if (price === 0 || price === null || price === undefined) {
    return false;
  }

  // PKR doesn't use cents
  if (currency === 'PKR') {
    return false;
  }

  // If price is >= 100 and looks like cents (whole number or ends in 00)
  // Typical resource prices are under $100, so anything >= 100 is likely cents
  if (price >= 100) {
    return true;
  }

  return false;
}

/**
 * Convert cents to decimal for Resource.price
 */
function centsToDecimal(cents, currency = 'GBP') {
  if (currency === 'PKR') {
    return cents;
  }
  return cents / 100;
}

/**
 * Migrate Resource.price from cents to decimal
 * Resource prices should be stored as user-entered values (9.99, not 999)
 */
async function migrateResourcePrices() {
  console.log('\n=== Migrating Resource.price (cents -> decimal) ===');

  const resources = await Resource.find({ isFree: false, price: { $gt: 0 } });
  console.log(`Found ${resources.length} paid resources to check`);

  for (const resource of resources) {
    stats.resources.checked++;

    try {
      const currency = resource.currency || 'GBP';

      if (resourcePriceNeedsConversion(resource.price, currency)) {
        const oldValue = resource.price;
        const newValue = centsToDecimal(oldValue, currency);

        console.log(`  [${resource._id}] "${resource.title}"`);
        console.log(`    ${oldValue} cents -> ${newValue} ${currency}`);

        if (!DRY_RUN) {
          resource.price = newValue;
          await resource.save();
        }

        stats.resources.migrated++;
      } else {
        if (VERBOSE) {
          console.log(`  [${resource._id}] ${resource.price} - already decimal, skipping`);
        }
        stats.resources.skipped++;
      }
    } catch (err) {
      console.error(`  Error migrating resource ${resource._id}:`, err.message);
      stats.resources.errors++;
    }
  }

  console.log(`\nResource Migration Results:`);
  console.log(`  Checked: ${stats.resources.checked}`);
  console.log(`  Migrated: ${stats.resources.migrated}`);
  console.log(`  Skipped (already decimal): ${stats.resources.skipped}`);
  console.log(`  Errors: ${stats.resources.errors}`);
}

/**
 * Detect if a pricePaid value is in decimal format (needs conversion)
 *
 * Logic:
 * - If pricePaid < 100 and pricePaid > 0, it's likely decimal (e.g., 9.99)
 * - If pricePaid >= 100, it could be cents already (e.g., 999)
 * - We also check if it has decimal places
 */
function needsConversion(pricePaid, currency = 'GBP') {
  if (pricePaid === 0 || pricePaid === null || pricePaid === undefined) {
    return false; // Free resources don't need conversion
  }

  // PKR doesn't use cents
  if (currency === 'PKR') {
    return false;
  }

  // If the value has meaningful decimal places, it's likely in pounds/dollars
  const hasDecimals = pricePaid % 1 !== 0;

  // If value is small and has decimals, it's definitely decimal format
  if (hasDecimals && pricePaid < 1000) {
    return true;
  }

  // If value is very small (less than what would be minimum cents), likely decimal
  if (pricePaid > 0 && pricePaid < 1) {
    return true;
  }

  // Values like 9.99, 19.99, etc. need conversion
  if (pricePaid < 100 && hasDecimals) {
    return true;
  }

  return false;
}

/**
 * Convert decimal to cents
 */
function toCents(amount, currency = 'GBP') {
  if (currency === 'PKR') {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

/**
 * Migrate ResourcePurchase.pricePaid from decimal to cents
 * Uses Sale.price as the source of truth since it comes directly from Stripe
 */
async function migrateResourcePurchases() {
  console.log('\n=== Migrating ResourcePurchase.pricePaid (decimal -> cents) ===');

  const purchases = await ResourcePurchase.find({ pricePaid: { $gt: 0 } });
  console.log(`Found ${purchases.length} paid purchases to check`);

  for (const purchase of purchases) {
    stats.resourcePurchases.checked++;

    try {
      const currency = purchase.currency || 'USD';

      // Find the corresponding Sale to get the correct cents value
      const sale = await Sale.findOne({
        resource: purchase.resourceId,
        buyer: purchase.buyerId,
        status: 'completed',
      }).sort({ saleDate: -1 });

      if (sale) {
        // If pricePaid doesn't match Sale.price, it needs fixing
        const salePriceCents = sale.price;
        const currentPricePaid = purchase.pricePaid;

        // Check if they match (within tolerance)
        if (Math.abs(currentPricePaid - salePriceCents) > 1) {
          console.log(`  [${purchase._id}]`);
          console.log(`    Current pricePaid: ${currentPricePaid}`);
          console.log(`    Sale.price (correct): ${salePriceCents} cents`);
          console.log(`    Updating to: ${salePriceCents}`);

          if (!DRY_RUN) {
            purchase.pricePaid = salePriceCents;
            await purchase.save();
          }

          stats.resourcePurchases.migrated++;
        } else {
          if (VERBOSE) {
            console.log(`  [${purchase._id}] ${purchase.pricePaid} - matches Sale, skipping`);
          }
          stats.resourcePurchases.skipped++;
        }
      } else {
        // No sale found, use the old logic
        if (needsConversion(purchase.pricePaid, currency)) {
          const oldValue = purchase.pricePaid;
          const newValue = toCents(oldValue, currency);

          console.log(`  [${purchase._id}] (no Sale found)`);
          console.log(`    ${oldValue} ${currency} -> ${newValue} cents`);

          if (!DRY_RUN) {
            purchase.pricePaid = newValue;
            await purchase.save();
          }

          stats.resourcePurchases.migrated++;
        } else {
          if (VERBOSE) {
            console.log(`  [${purchase._id}] ${purchase.pricePaid} - already in cents, skipping`);
          }
          stats.resourcePurchases.skipped++;
        }
      }
    } catch (err) {
      console.error(`  Error migrating purchase ${purchase._id}:`, err.message);
      stats.resourcePurchases.errors++;
    }
  }

  console.log(`\nResourcePurchase Migration Results:`);
  console.log(`  Checked: ${stats.resourcePurchases.checked}`);
  console.log(`  Migrated: ${stats.resourcePurchases.migrated}`);
  console.log(`  Skipped (already cents): ${stats.resourcePurchases.skipped}`);
  console.log(`  Errors: ${stats.resourcePurchases.errors}`);
}

/**
 * Recalculate SellerTier values from Sale data
 * This ensures tier values are consistent with Sale.price (which is in cents)
 */
async function recalculateSellerTiers() {
  console.log('\n=== Recalculating SellerTier Values ===');

  const tiers = await SellerTier.find({});
  console.log(`Found ${tiers.length} seller tiers to recalculate`);

  for (const tier of tiers) {
    stats.sellerTiers.checked++;

    try {
      // Calculate from Sale data (which stores price in cents)
      const salesData = await Sale.calculateSellerSales(tier.seller, 12);

      // Get lifetime stats
      const lifetimeStats = await Sale.aggregate([
        {
          $match: {
            seller: tier.seller,
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            lifetimeSales: { $sum: { $subtract: ['$price', '$vatAmount'] } },
            lifetimeEarnings: { $sum: '$sellerEarnings' },
            lifetimeSalesCount: { $sum: 1 },
          },
        },
      ]);

      const lifetime = lifetimeStats[0] || { lifetimeSales: 0, lifetimeEarnings: 0, lifetimeSalesCount: 0 };

      if (VERBOSE) {
        console.log(`  [${tier.seller}] Recalculating...`);
        console.log(`    Old last12MonthsSales: ${tier.last12MonthsSales}`);
        console.log(`    New last12MonthsSales: ${salesData.totalSales}`);
      }

      if (!DRY_RUN) {
        // Update tier with recalculated values
        await tier.updateTier(salesData.totalSales);

        // Update lifetime stats
        tier.lifetimeSales = lifetime.lifetimeSales;
        tier.lifetimeEarnings = lifetime.lifetimeEarnings;
        tier.lifetimeSalesCount = lifetime.lifetimeSalesCount;
        tier.last12MonthsCount = salesData.count;
        await tier.save();
      }

      stats.sellerTiers.recalculated++;
    } catch (err) {
      console.error(`  Error recalculating tier for seller ${tier.seller}:`, err.message);
      stats.sellerTiers.errors++;
    }
  }

  console.log(`\nSellerTier Recalculation Results:`);
  console.log(`  Checked: ${stats.sellerTiers.checked}`);
  console.log(`  Recalculated: ${stats.sellerTiers.recalculated}`);
  console.log(`  Errors: ${stats.sellerTiers.errors}`);
}

/**
 * Verify data consistency after migration
 */
async function verifyMigration() {
  console.log('\n=== Verifying Migration ===');

  // Check ResourcePurchase values
  const suspiciousPurchases = await ResourcePurchase.find({
    pricePaid: { $gt: 0, $lt: 50 }, // Very small values might still be decimal
    currency: { $ne: 'PKR' },
  }).limit(10);

  if (suspiciousPurchases.length > 0) {
    console.log('\nWarning: Found potentially unconverted purchases:');
    suspiciousPurchases.forEach(p => {
      console.log(`  [${p._id}] pricePaid: ${p.pricePaid} ${p.currency}`);
    });
  } else {
    console.log('No suspicious values found in ResourcePurchase');
  }

  // Verify a sample of purchases match their sales
  const samplePurchases = await ResourcePurchase.find({ pricePaid: { $gt: 0 } }).limit(5);
  console.log('\nSample verification (Purchase vs Sale):');

  for (const purchase of samplePurchases) {
    const sale = await Sale.findOne({
      resource: purchase.resourceId,
      buyer: purchase.buyerId,
      status: 'completed',
    }).sort({ saleDate: -1 });

    if (sale) {
      const match = Math.abs(purchase.pricePaid - sale.price) < 1; // Allow 1 cent tolerance
      console.log(`  Purchase ${purchase._id}: ${purchase.pricePaid} cents`);
      console.log(`    Sale ${sale._id}: ${sale.price} cents`);
      console.log(`    Match: ${match ? 'YES' : 'NO - CHECK THIS!'}`);
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('========================================');
  console.log('  Price Migration Script');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Backup: ${CREATE_BACKUP ? 'YES' : 'NO'}`);
  console.log(`Verbose: ${VERBOSE ? 'YES' : 'NO'}`);
  console.log('');

  stats.startTime = new Date();

  try {
    await connectDB();

    if (CREATE_BACKUP && !DRY_RUN) {
      await createBackup();
    }

    // Step 1: Fix Resource.price (cents -> decimal)
    await migrateResourcePrices();

    // Step 2: Fix ResourcePurchase.pricePaid (decimal -> cents, using Sale as source of truth)
    await migrateResourcePurchases();

    // Step 3: Recalculate SellerTier values
    await recalculateSellerTiers();

    // Step 4: Verify everything
    await verifyMigration();

    stats.endTime = new Date();
    const duration = (stats.endTime - stats.startTime) / 1000;

    console.log('\n========================================');
    console.log('  Migration Complete');
    console.log('========================================');
    console.log(`Duration: ${duration.toFixed(2)} seconds`);

    if (DRY_RUN) {
      console.log('\nThis was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to apply changes.');
    }

  } catch (err) {
    console.error('\nMigration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
main();
