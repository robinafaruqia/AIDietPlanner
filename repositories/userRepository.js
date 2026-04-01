const bcrypt = require('bcryptjs');
const { getDatabaseClient } = require('../config/database');

function getClient() {
  const client = getDatabaseClient();
  if (!client) throw new Error('Database client not initialized');
  return client;
}

function computeWeightProgress(user) {
  if (!user.startWeight || !user.currentWeight) return null;
  const lost = user.startWeight - user.currentWeight;
  const toGo = user.targetWeight ? user.currentWeight - user.targetWeight : null;
  const percentToGoal = user.targetWeight && user.startWeight !== user.targetWeight
    ? ((user.startWeight - user.currentWeight) / (user.startWeight - user.targetWeight)) * 100
    : null;
  return {
    startWeight: user.startWeight,
    currentWeight: user.currentWeight,
    targetWeight: user.targetWeight,
    lost: Math.round(lost * 10) / 10,
    toGo: toGo ? Math.round(toGo * 10) / 10 : null,
    percentToGoal: percentToGoal ? Math.round(percentToGoal) : null,
    startDate: user.startDate,
    daysOnPlan: user.startDate ? Math.floor((Date.now() - new Date(user.startDate).getTime()) / (1000 * 60 * 60 * 24)) : 0
  };
}

function toPublicJSON(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    profileImage: user.profileImage,
    height: user.height,
    healthConditions: user.healthConditions || [],
    startWeight: user.startWeight,
    currentWeight: user.currentWeight,
    targetWeight: user.targetWeight,
    startDate: user.startDate,
    createdAt: user.createdAt,
    fastingEnabled: !!user.fastingEnabled,
    fastingSchedule: user.fastingSchedule
  };
}

function mapFromRow(row) {
  if (!row) return null;
  const user = {
    id: row.id,
    _id: row.id,
    email: row.email,
    passwordHash: row.password_hash || null,
    name: row.name,
    provider: row.provider || 'local',
    googleId: row.google_id || null,
    profileImage: row.profile_image || null,
    height: row.height,
    healthConditions: row.health_conditions || [],
    startWeight: row.start_weight,
    currentWeight: row.current_weight,
    targetWeight: row.target_weight,
    weightHistory: row.weight_history || [],
    startDate: row.start_date || null,
    achievements: row.achievements || [],
    mealPlansGenerated: row.meal_plans_generated || 0,
    fastingEnabled: !!row.fasting_enabled,
    fastingSchedule: row.fasting_schedule || { type: '16:8', eatingWindowStart: '12:00', eatingWindowEnd: '20:00' },
    biometricConnections: row.biometric_connections || {},
    biometricData: row.biometric_data || {},
    isActive: row.is_active !== false,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  user.comparePassword = async (candidatePassword) => {
    if (!user.passwordHash) return false;
    return bcrypt.compare(candidatePassword, user.passwordHash);
  };
  user.setPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
  };
  user.toPublicJSON = () => toPublicJSON(user);
  user.getWeightProgress = () => computeWeightProgress(user);
  user.hasAchievement = (achievementId) => (user.achievements || []).some((a) => a.id === achievementId);
  user.unlockAchievement = async (achievementId) => {
    if (user.hasAchievement(achievementId)) return null;
    const achievement = { id: achievementId, unlockedAt: new Date().toISOString() };
    user.achievements = [...(user.achievements || []), achievement];
    await userRepository.save(user);
    return achievement;
  };
  user.getUnlockedAchievementIds = () => (user.achievements || []).map((a) => a.id);
  user.save = async () => userRepository.save(user);
  return user;
}

function mapToRow(user) {
  return {
    email: user.email ? user.email.toLowerCase().trim() : null,
    password_hash: user.passwordHash || null,
    name: user.name,
    provider: user.provider || 'local',
    google_id: user.googleId || null,
    profile_image: user.profileImage || null,
    height: user.height ?? null,
    health_conditions: user.healthConditions || [],
    start_weight: user.startWeight ?? null,
    current_weight: user.currentWeight ?? null,
    target_weight: user.targetWeight ?? null,
    weight_history: user.weightHistory || [],
    start_date: user.startDate || null,
    achievements: user.achievements || [],
    meal_plans_generated: user.mealPlansGenerated || 0,
    fasting_enabled: !!user.fastingEnabled,
    fasting_schedule: user.fastingSchedule || null,
    biometric_connections: user.biometricConnections || {},
    biometric_data: user.biometricData || {},
    is_active: user.isActive !== false,
    last_login: user.lastLogin || null,
    updated_at: new Date().toISOString()
  };
}

function setByPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cursor[key] === undefined || cursor[key] === null || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

const userRepository = {
  async findById(id) {
    const { data, error } = await getClient().from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return mapFromRow(data);
  },

  async findByEmail(email) {
    const normalized = String(email || '').toLowerCase().trim();
    const { data, error } = await getClient().from('users').select('*').eq('email', normalized).maybeSingle();
    if (error) throw error;
    return mapFromRow(data);
  },

  async findByGoogleId(googleId) {
    const { data, error } = await getClient().from('users').select('*').eq('google_id', googleId).maybeSingle();
    if (error) throw error;
    return mapFromRow(data);
  },

  create(data) {
    return mapFromRow({ id: data.id, ...mapToRow(data), created_at: new Date().toISOString() });
  },

  async save(user) {
    const payload = mapToRow(user);
    let data;
    let error;
    if (user.id) {
      ({ data, error } = await getClient().from('users').update(payload).eq('id', user.id).select('*').single());
    } else {
      ({ data, error } = await getClient().from('users').insert(payload).select('*').single());
    }
    if (error) throw error;
    Object.assign(user, mapFromRow(data));
    return user;
  },

  async updateById(id, patch) {
    const { data, error } = await getClient().from('users').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return mapFromRow(data);
  },

  async findByIdAndUpdate(id, patch) {
    const user = await this.findById(id);
    if (!user) return null;

    const normalizedPatch = { ...patch };
    for (const [key, value] of Object.entries(normalizedPatch)) {
      if (key.includes('.')) {
        if (key.startsWith('biometricConnections.')) {
          const path = key.replace('biometricConnections.', 'biometricConnections.');
          setByPath(user, path, value);
        } else if (key.startsWith('biometricData.')) {
          const path = key.replace('biometricData.', 'biometricData.');
          setByPath(user, path, value);
        } else {
          setByPath(user, key, value);
        }
      } else {
        user[key] = value;
      }
    }
    if (normalizedPatch.biometricData) {
      user.biometricData = normalizedPatch.biometricData;
    }
    return this.save(user);
  },

  getId(user) {
    return user?._id || user?.id || null;
  }
};

module.exports = userRepository;
