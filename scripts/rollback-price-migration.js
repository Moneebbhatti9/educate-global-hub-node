/**
 * Rollback Script: Restore from backup after price migration
 *
 * This script restores data from backups created by migrate-price-to-cents.js
 *
 * Run with: node scripts/rollback-price-migration.js --date=YYYYMMDD
 *
 * Options:
 *   --date=YYYYMMDD   Date of the backup to restore (required)
 *   --dry-run         Preview what would be restored without applying
 *   --collection=X    Only restore specific collection (resourcepurchases or sellertiers)
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Extract date argument
const dateArg = args.find(a => a.startsWith('--date='));
const BACKUP_DATE = dateArg ? dateArg.split('=')[1] : null;

// Extract collection argument
const collectionArg = args.find(a => a.startsWith('--collection='));
const SPECIFIC_COLLECTION = collectionArg ? collectionArg.split('=')[1] : null;

if (!BACKUP_DATE) {
  console.error('Error: --date=YYYYMMDD argument is required');
  console.error('Example: node scripts/rollback-price-migration.js --date=20260124');
  process.exit(1);
}

const BACKUP_SUFFIX = `_backup_${BACKUP_DATE}`;

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
 * List available backups
 */
async function listBackups() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const backups = collections.filter(c => c.name.includes('_backup_'));
  console.log('\nAvailable backups:');

  if (backups.length === 0) {
    console.log('  No backups found');
  } else {
    backups.forEach(b => console.log(`  - ${b.name}`));
  }
}

/**
 * Restore a collection from backup
 */
async function restoreCollection(originalName, backupName) {
  const db = mongoose.connection.db;

  // Check if backup exists
  const collections = await db.listCollections({ name: backupName }).toArray();
  if (collections.length === 0) {
    console.log(`  Backup collection '${backupName}' not found, skipping`);
    return { restored: 0, error: null };
  }

  try {
    // Get backup data
    const backupData = await db.collection(backupName).find({}).toArray();
    console.log(`  Found ${backupData.length} documents in backup`);

    if (backupData.length === 0) {
      return { restored: 0, error: null };
    }

    if (!DRY_RUN) {
      // Clear current collection
      await db.collection(originalName).deleteMany({});
      console.log(`  Cleared current ${originalName} collection`);

      // Restore from backup
      await db.collection(originalName).insertMany(backupData);
      console.log(`  Restored ${backupData.length} documents to ${originalName}`);
    } else {
      console.log(`  [DRY RUN] Would restore ${backupData.length} documents`);
    }

    return { restored: backupData.length, error: null };
  } catch (err) {
    return { restored: 0, error: err.message };
  }
}

/**
 * Main rollback function
 */
async function main() {
  console.log('========================================');
  console.log('  Price Migration Rollback Script');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Backup Date: ${BACKUP_DATE}`);
  console.log(`Backup Suffix: ${BACKUP_SUFFIX}`);
  if (SPECIFIC_COLLECTION) {
    console.log(`Restoring only: ${SPECIFIC_COLLECTION}`);
  }
  console.log('');

  try {
    await connectDB();
    await listBackups();

    console.log('\n=== Restoring Collections ===');

    const results = {};

    // Restore Resource if not filtered out
    if (!SPECIFIC_COLLECTION || SPECIFIC_COLLECTION === 'resources') {
      console.log('\nRestoring resources...');
      results.resources = await restoreCollection(
        'resources',
        `resources${BACKUP_SUFFIX}`
      );
    }

    // Restore ResourcePurchase if not filtered out
    if (!SPECIFIC_COLLECTION || SPECIFIC_COLLECTION === 'resourcepurchases') {
      console.log('\nRestoring resourcepurchases...');
      results.resourcePurchases = await restoreCollection(
        'resourcepurchases',
        `resourcepurchases${BACKUP_SUFFIX}`
      );
    }

    // Restore SellerTier if not filtered out
    if (!SPECIFIC_COLLECTION || SPECIFIC_COLLECTION === 'sellertiers') {
      console.log('\nRestoring sellertiers...');
      results.sellerTiers = await restoreCollection(
        'sellertiers',
        `sellertiers${BACKUP_SUFFIX}`
      );
    }

    console.log('\n========================================');
    console.log('  Rollback Results');
    console.log('========================================');

    for (const [name, result] of Object.entries(results)) {
      if (result.error) {
        console.log(`${name}: ERROR - ${result.error}`);
      } else {
        console.log(`${name}: ${result.restored} documents restored`);
      }
    }

    if (DRY_RUN) {
      console.log('\nThis was a DRY RUN. No changes were made.');
    }

  } catch (err) {
    console.error('\nRollback failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the rollback
main();
