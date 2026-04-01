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
const { connectDB, disconnectDB, getDatabaseClient } = require('../config/database');

const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');
const emailFlag = args.indexOf('--email');
const defaultEmail = emailFlag !== -1 && args[emailFlag + 1]
  ? args[emailFlag + 1]
  : null;

async function migrate() {
  console.log(isDryRun ? '=== DRY RUN (no changes will be written) ===' : '=== EXECUTING MIGRATION ===');
  await connectDB();
  const db = getDatabaseClient();
  console.log('Connected to Supabase\n');

  let defaultUser;

  if (defaultEmail) {
    const { data, error } = await db.from('users').select('*').eq('email', defaultEmail.toLowerCase().trim()).maybeSingle();
    if (error) throw error;
    defaultUser = data;
    if (!defaultUser) {
      console.error(`No user found with email: ${defaultEmail}`);
      process.exit(1);
    }
  } else {
    const { data, error } = await db.from('users').select('*').eq('is_active', true).order('created_at', { ascending: true }).limit(1);
    if (error) throw error;
    defaultUser = data?.[0];
  }

  if (!defaultUser) {
    console.log('No existing user found. Creating a default migration user...');
    if (!isDryRun) {
      const payload = {
        name: 'Migrated User',
        email: 'migrated@aidietplanner.local',
        provider: 'local',
        password_hash: null,
        is_active: true
      };
      const { data, error } = await db.from('users').insert(payload).select('*').single();
      if (error) throw error;
      defaultUser = data;
      console.log(`  Created user: ${defaultUser.email} (ID: ${defaultUser.id})`);
    } else {
      console.log('  [dry run] Would create a default migration user');
    }
  } else {
    console.log(`Using existing user: ${defaultUser.email || defaultUser.name} (ID: ${defaultUser.id})`);
  }

  const { data: orphanedLogRows, error: logsCountError } = await db.from('nutrition_logs').select('id').is('user_id', null);
  if (logsCountError) throw logsCountError;
  const orphanedLogs = orphanedLogRows?.length || 0;
  console.log(`\nNutritionLog documents without userId: ${orphanedLogs}`);

  if (orphanedLogs > 0 && !isDryRun && defaultUser) {
    const { error } = await db.from('nutrition_logs').update({ user_id: defaultUser.id }).is('user_id', null);
    if (error) throw error;
    console.log(`  Updated ${orphanedLogs} NutritionLog documents`);
  } else if (orphanedLogs > 0) {
    console.log(`  [dry run] Would assign ${orphanedLogs} logs to user ${defaultUser?.id || '<new user>'}`);
  }

  const { data: orphanedPlanRows, error: plansCountError } = await db.from('meal_plans').select('id').is('user_id', null);
  if (plansCountError) throw plansCountError;
  const orphanedPlans = orphanedPlanRows?.length || 0;
  console.log(`\nMealPlan documents without userId: ${orphanedPlans}`);

  if (orphanedPlans > 0 && !isDryRun && defaultUser) {
    const { error } = await db.from('meal_plans').update({ user_id: defaultUser.id }).is('user_id', null);
    if (error) throw error;
    console.log(`  Updated ${orphanedPlans} MealPlan documents`);
  } else if (orphanedPlans > 0) {
    console.log(`  [dry run] Would assign ${orphanedPlans} plans to user ${defaultUser?.id || '<new user>'}`);
  }

  console.log('\n--- Summary ---');
  console.log(`NutritionLogs migrated: ${isDryRun ? `${orphanedLogs} (pending)` : orphanedLogs}`);
  console.log(`MealPlans migrated:     ${isDryRun ? `${orphanedPlans} (pending)` : orphanedPlans}`);

  if (isDryRun && (orphanedLogs > 0 || orphanedPlans > 0)) {
    console.log('\nRun with --execute to apply changes:');
    console.log('  node scripts/migrate-to-users.js --execute');
  }

  await disconnectDB();
  console.log('\nDone.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
