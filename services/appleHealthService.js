const crypto = require('crypto');
const NutritionLog = require('../models/NutritionLog');
const userRepository = require('../repositories/userRepository');

const TOKEN_BYTES = 32;
const DEFAULT_STEPS_GOAL = 10000;

const SAMPLE_TYPES = new Set([
  'steps',
  'heartRate',
  'weight',
  'activeEnergy',
  'sleep',
  'dietaryEnergy',
  'dietaryProtein',
  'dietaryCarbs',
  'dietaryFat',
  'dietaryFiber',
  'water',
  'bodyFat'
]);

function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateSyncToken() {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

function timingSafeEqualHash(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

async function findUserByAppleHealthToken(bearerToken) {
  if (!bearerToken || bearerToken.length < 16) return null;
  const tokenHash = hashToken(bearerToken);
  const { getDatabaseClient } = require('../config/database');
  const client = getDatabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('users')
    .select('*')
    .filter('biometric_connections->appleHealth->>tokenHash', 'eq', tokenHash)
    .maybeSingle();

  if (error) {
    console.error('Apple Health token lookup error:', error);
    return null;
  }
  if (!data) return null;

  const storedHash = data.biometric_connections?.appleHealth?.tokenHash;
  if (!timingSafeEqualHash(storedHash, tokenHash)) return null;

  return userRepository.findById(data.id);
}

function normalizeHeartRate(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    const v = Math.round(value);
    return { avg: v, min: v, max: v };
  }
  if (typeof value === 'object') {
    const avg = Math.round(value.avg ?? value.average ?? value.value ?? 0);
    if (!avg) return null;
    return {
      avg,
      min: Math.round(value.min ?? avg - 10),
      max: Math.round(value.max ?? avg + 20)
    };
  }
  return null;
}

function mergeDailyMap(existing = {}, incoming = {}) {
  const merged = { ...(existing || {}) };
  for (const [date, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null) {
      merged[date] = value;
    }
  }
  return merged;
}

function mergeHeartRateMaps(existing = {}, incoming = {}) {
  const merged = { ...(existing || {}) };
  for (const [date, value] of Object.entries(incoming)) {
    const hr = normalizeHeartRate(value);
    if (hr) merged[date] = hr;
  }
  return merged;
}

/**
 * Convert Apple Health sync payload samples into biometricData shape (matches Google Fit).
 */
function samplesToBiometricPatch(samples = []) {
  const patch = {
    steps: {},
    heartRate: {},
    weight: {},
    sleep: {},
    calories: {},
    sources: {}
  };

  for (const sample of samples) {
    if (!sample || !SAMPLE_TYPES.has(sample.type)) continue;
    const date = sample.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    switch (sample.type) {
      case 'steps':
        patch.steps[date] = Math.round(Number(sample.value) || 0);
        break;
      case 'heartRate': {
        const hr = normalizeHeartRate(sample.value);
        if (hr) patch.heartRate[date] = hr;
        break;
      }
      case 'weight': {
        let kg = Number(sample.value);
        if (sample.unit === 'lb' || sample.unit === 'lbs') {
          kg = kg * 0.453592;
        }
        if (kg > 0) patch.weight[date] = Math.round(kg * 10) / 10;
        break;
      }
      case 'activeEnergy':
        patch.calories[date] = Math.round(Number(sample.value) || 0);
        break;
      case 'sleep':
        patch.sleep[date] = Math.round(Number(sample.value) * 10) / 10;
        break;
      default:
        break;
    }
  }

  return patch;
}

function mergeBiometricData(current = {}, applePatch) {
  const merged = {
    ...current,
    steps: mergeDailyMap(current.steps, applePatch.steps),
    heartRate: mergeHeartRateMaps(current.heartRate, applePatch.heartRate),
    weight: mergeDailyMap(current.weight, applePatch.weight),
    sleep: mergeDailyMap(current.sleep, applePatch.sleep),
    calories: mergeDailyMap(current.calories, applePatch.calories),
    lastSync: new Date(),
    lastSyncSources: {
      ...(current.lastSyncSources || {}),
      appleHealth: new Date().toISOString()
    }
  };
  return merged;
}

async function applyWeightFromAppleHealth(user, weightByDate) {
  if (!weightByDate || typeof weightByDate !== 'object') return;
  const dates = Object.keys(weightByDate).sort();
  if (dates.length === 0) return;

  let changed = false;
  for (const date of dates) {
    const weight = weightByDate[date];
    if (!weight || weight <= 0) continue;

    const entryDate = new Date(`${date}T12:00:00.000Z`);
    const hasEntry = (user.weightHistory || []).some((e) => {
      const d = new Date(e.date).toISOString().split('T')[0];
      return d === date && Math.abs(e.weight - weight) < 0.05;
    });

    if (!hasEntry) {
      user.weightHistory = user.weightHistory || [];
      user.weightHistory.push({
        weight,
        date: entryDate,
        note: 'Synced from Apple Health'
      });
      changed = true;
    }
  }

  if (changed) {
    const sorted = [...user.weightHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    user.currentWeight = sorted[0].weight;
    if (!user.startWeight) {
      user.startWeight = sorted[sorted.length - 1].weight;
      user.startDate = sorted[sorted.length - 1].date;
    }
    await user.save();
  }
}

async function getGoalsForAppleHealth(user) {
  const today = getDateString();
  const userId = userRepository.getId(user);
  let nutritionGoals = { calories: 2000, protein: 50, carbs: 250, fat: 65, fiber: 25 };

  try {
    const log = await NutritionLog.getOrCreateForDate(userId, today);
    if (log?.goals) nutritionGoals = { ...nutritionGoals, ...log.goals };
  } catch (e) {
    console.error('Apple Health goals fetch:', e.message);
  }

  const applePrefs = user.biometricConnections?.appleHealth?.preferences || {};

  const goals = {
    calories: nutritionGoals.calories,
    protein: nutritionGoals.protein,
    carbs: nutritionGoals.carbs,
    fat: nutritionGoals.fat,
    fiber: nutritionGoals.fiber,
    targetWeight: user.targetWeight ?? null,
    steps: applePrefs.stepsGoal ?? DEFAULT_STEPS_GOAL,
    activeEnergyBurned: applePrefs.activeEnergyGoal ?? null
  };

  const goalsVersion =
    user.biometricConnections?.appleHealth?.goalsVersion ||
    new Date(user.updatedAt || Date.now()).toISOString();

  let nutritionLoggedToday = null;
  try {
    const log = await NutritionLog.getOrCreateForDate(userId, today);
    nutritionLoggedToday = {
      date: today,
      consumed: log.dailyTotals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      water: log.water || 0
    };
  } catch (_) {
    /* ignore */
  }

  return {
    goals,
    goalsVersion,
    weightProgress: user.getWeightProgress?.() ?? null,
    nutritionLoggedToday,
    syncPreferences: {
      writeGoalsToHealth: applePrefs.writeGoalsToHealth !== false,
      readNutritionFromHealth: !!applePrefs.readNutritionFromHealth
    }
  };
}

async function applyNutritionSamplesFromHealth(user, samples = []) {
  const userId = userRepository.getId(user);
  const byDate = {};

  for (const sample of samples) {
    if (!sample?.date || !/^\d{4}-\d{2}-\d{2}$/.test(sample.date)) continue;
    if (!['dietaryEnergy', 'dietaryProtein', 'dietaryCarbs', 'dietaryFat', 'dietaryFiber', 'water'].includes(sample.type)) {
      continue;
    }
    if (!byDate[sample.date]) {
      byDate[sample.date] = { dietary: {}, water: 0 };
    }
    const v = Number(sample.value) || 0;
    switch (sample.type) {
      case 'dietaryEnergy':
        byDate[sample.date].dietary.calories = Math.round(v);
        break;
      case 'dietaryProtein':
        byDate[sample.date].dietary.protein = Math.round(v);
        break;
      case 'dietaryCarbs':
        byDate[sample.date].dietary.carbs = Math.round(v);
        break;
      case 'dietaryFat':
        byDate[sample.date].dietary.fat = Math.round(v);
        break;
      case 'dietaryFiber':
        byDate[sample.date].dietary.fiber = Math.round(v);
        break;
      case 'water':
        byDate[sample.date].water = Math.max(byDate[sample.date].water, Math.round(v));
        break;
      default:
        break;
    }
  }

  for (const [dateString, payload] of Object.entries(byDate)) {
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    const hasDietary = Object.keys(payload.dietary).length > 0;
    if (hasDietary) {
      const name = 'Apple Health sync';
      const existing = (log.meals || []).find((m) => m.name === name && m.mealType === 'snack');
      const meal = {
        mealType: 'snack',
        name,
        calories: payload.dietary.calories || 0,
        protein: payload.dietary.protein || 0,
        carbs: payload.dietary.carbs || 0,
        fat: payload.dietary.fat || 0,
        fiber: payload.dietary.fiber || 0
      };
      if (existing) {
        Object.assign(existing, meal);
      } else {
        log.meals.push(meal);
      }
    }
    if (payload.water > 0 && (log.water || 0) < payload.water) {
      log.water = payload.water;
    }
    await log.save();
  }
}

function bumpGoalsVersion(user) {
  const version = new Date().toISOString();
  return {
  ...user.biometricConnections,
    appleHealth: {
      ...(user.biometricConnections?.appleHealth || {}),
      goalsVersion: version
    }
  };
}

module.exports = {
  DEFAULT_STEPS_GOAL,
  SAMPLE_TYPES,
  generateSyncToken,
  hashToken,
  findUserByAppleHealthToken,
  samplesToBiometricPatch,
  mergeBiometricData,
  applyWeightFromAppleHealth,
  getGoalsForAppleHealth,
  applyNutritionSamplesFromHealth,
  bumpGoalsVersion,
  getDateString
};