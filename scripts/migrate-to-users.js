#!/usr/bin/env node

/**
 * Migration script: Associate existing NutritionLogs and MealPlans with a default user.
 *
 * Usage:
 *   node scripts/migrate-to-users.js                   # dry run (default)
 *   node scripts/migrate-to-users.js --execute          # actually write changes
 *   node scripts/migrate-to-users.js --execute --email admin@example.com
 *
 * What it does:
 *   1. Finds or creates a default user to own orphaned records.
 *   2. Updates NutritionLog documents that have no userId.
 *   3. Updates MealPlan documents that have no userId.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const NutritionLog = require('../models/NutritionLog');
const MealPlan = require('../models/MealPlan');
const User = require('../models/User');

const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');
const emailFlag = args.indexOf('--email');
const defaultEmail = emailFlag !== -1 && args[emailFlag + 1]
  ? args[emailFlag + 1]
  : null;

async function migrate() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-diet-planner';

  console.log(isDryRun ? '=== DRY RUN (no changes will be written) ===' : '=== EXECUTING MIGRATION ===');
  console.log(`Connecting to: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  });
  console.log('Connected to MongoDB\n');

  let defaultUser;

  if (defaultEmail) {
    defaultUser = await User.findByEmail(defaultEmail);
    if (!defaultUser) {
      console.error(`No user found with email: ${defaultEmail}`);
      process.exit(1);
    }
  } else {
    defaultUser = await User.findOne({ isActive: true }).sort({ createdAt: 1 });
  }

  if (!defaultUser) {
    console.log('No existing user found. Creating a default migration user...');
    if (!isDryRun) {
      defaultUser = new User({
        name: 'Migrated User',
        email: 'migrated@aidietplanner.local',
        provider: 'local'
      });
      await defaultUser.setPassword('changeme123');
      await defaultUser.save();
      console.log(`  Created user: ${defaultUser.email} (ID: ${defaultUser._id})`);
    } else {
      console.log('  [dry run] Would create a default migration user');
    }
  } else {
    console.log(`Using existing user: ${defaultUser.email || defaultUser.name} (ID: ${defaultUser._id})`);
  }

  const orphanedLogs = await NutritionLog.countDocuments({
    $or: [{ userId: { $exists: false } }, { userId: null }]
  });
  console.log(`\nNutritionLog documents without userId: ${orphanedLogs}`);

  if (orphanedLogs > 0 && !isDryRun && defaultUser) {
    const result = await NutritionLog.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId: defaultUser._id } }
    );
    console.log(`  Updated ${result.modifiedCount} NutritionLog documents`);
  } else if (orphanedLogs > 0) {
    console.log(`  [dry run] Would assign ${orphanedLogs} logs to user ${defaultUser?._id || '<new user>'}`);
  }

  const orphanedPlans = await MealPlan.countDocuments({
    $or: [{ userId: { $exists: false } }, { userId: null }]
  });
  console.log(`\nMealPlan documents without userId: ${orphanedPlans}`);

  if (orphanedPlans > 0 && !isDryRun && defaultUser) {
    const result = await MealPlan.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId: defaultUser._id } }
    );
    console.log(`  Updated ${result.modifiedCount} MealPlan documents`);
  } else if (orphanedPlans > 0) {
    console.log(`  [dry run] Would assign ${orphanedPlans} plans to user ${defaultUser?._id || '<new user>'}`);
  }

  console.log('\n--- Summary ---');
  console.log(`NutritionLogs migrated: ${isDryRun ? `${orphanedLogs} (pending)` : orphanedLogs}`);
  console.log(`MealPlans migrated:     ${isDryRun ? `${orphanedPlans} (pending)` : orphanedPlans}`);

  if (isDryRun && (orphanedLogs > 0 || orphanedPlans > 0)) {
    console.log('\nRun with --execute to apply changes:');
    console.log('  node scripts/migrate-to-users.js --execute');
  }

  await mongoose.connection.close();
  console.log('\nDone.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
