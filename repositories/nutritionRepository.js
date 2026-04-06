const { randomUUID } = require('crypto');
const { getDatabaseClient } = require('../config/database');
const userRepository = require('./userRepository');

function normUserId(userId) {
  if (userId == null) return null;
  return userRepository.normalizeUserId(userId);
}

function getClient() {
  const client = getDatabaseClient();
  if (!client) throw new Error('Database client not initialized');
  return client;
}

function ensureIds(items = []) {
  return items.map((item) => ({ _id: item._id || randomUUID(), ...item }));
}

function recalculate(log) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  (log.meals || []).forEach((meal) => {
    totals.calories += meal.calories || 0;
    totals.protein += meal.protein || 0;
    totals.carbs += meal.carbs || 0;
    totals.fat += meal.fat || 0;
    totals.fiber += meal.fiber || 0;
    totals.sugar += meal.sugar || 0;
    totals.sodium += meal.sodium || 0;
  });
  log.dailyTotals = totals;
  log.caloriesBurned = (log.exercises || []).reduce((sum, ex) => sum + (ex.caloriesBurned || 0), 0);
  return log;
}

function fromRow(row) {
  if (!row) return null;
  const log = {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    date: row.date,
    dateString: row.date_string,
    meals: ensureIds(row.meals || []),
    exercises: ensureIds(row.exercises || []),
    dailyTotals: row.daily_totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    caloriesBurned: row.calories_burned || 0,
    goals: row.goals || { calories: 2000, protein: 50, carbs: 250, fat: 65, fiber: 25 },
    biometrics: row.biometrics || {},
    notes: row.notes || '',
    water: row.water || 0,
    mood: row.mood || '',
    fastingLog: row.fasting_log || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  log.save = async () => nutritionRepository.save(log);
  return log;
}

function toRow(log) {
  return {
    user_id: normUserId(log.userId),
    date: log.date,
    date_string: log.dateString,
    meals: ensureIds(log.meals || []),
    exercises: ensureIds(log.exercises || []),
    daily_totals: log.dailyTotals || {},
    calories_burned: log.caloriesBurned || 0,
    goals: log.goals || {},
    biometrics: log.biometrics || {},
    notes: log.notes || '',
    water: log.water || 0,
    mood: log.mood || '',
    fasting_log: log.fastingLog || null,
    updated_at: new Date().toISOString()
  };
}

const nutritionRepository = {
  async getOrCreateForDate(userId, dateString) {
    const uid = normUserId(userId);
    let query = getClient().from('nutrition_logs').select('*').eq('date_string', dateString);
    query = uid ? query.eq('user_id', uid) : query.is('user_id', null);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (data) return fromRow(data);
    const row = {
      user_id: uid,
      date: `${dateString}T00:00:00.000Z`,
      date_string: dateString,
      meals: [],
      exercises: [],
      daily_totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
      goals: { calories: 2000, protein: 50, carbs: 250, fat: 65, fiber: 25 },
      water: 0
    };
    const { data: inserted, error: insertError } = await getClient().from('nutrition_logs').insert(row).select('*').single();
    if (insertError) throw insertError;
    return fromRow(inserted);
  },

  async save(log) {
    recalculate(log);
    const payload = toRow(log);
    let data;
    let error;
    if (log.id) {
      ({ data, error } = await getClient().from('nutrition_logs').update(payload).eq('id', log.id).select('*').single());
    } else {
      ({ data, error } = await getClient().from('nutrition_logs').insert(payload).select('*').single());
    }
    if (error) throw error;
    Object.assign(log, fromRow(data));
    return log;
  },

  async findOneByDate(userId, dateString) {
    const uid = normUserId(userId);
    let query = getClient().from('nutrition_logs').select('*').eq('date_string', dateString);
    query = uid ? query.eq('user_id', uid) : query.is('user_id', null);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return fromRow(data);
  },

  async findByRange(userId, startDate, endDate, ascending = false) {
    const uid = normUserId(userId);
    let query = getClient().from('nutrition_logs')
      .select('*')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending });
    query = uid ? query.eq('user_id', uid) : query.is('user_id', null);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(fromRow);
  },

  async countMeals(userId) {
    const uid = normUserId(userId);
    if (!uid) return 0;
    const { data, error } = await getClient().from('nutrition_logs').select('meals').eq('user_id', uid);
    if (error) throw error;
    return (data || []).reduce((sum, row) => sum + (row.meals?.length || 0), 0);
  },

  async find(query = {}) {
    let q = getClient().from('nutrition_logs').select('*');
    if (query.userId != null) {
      const uid = normUserId(query.userId);
      if (!uid) return [];
      q = q.eq('user_id', uid);
    }
    if (query.dateString) q = q.eq('date_string', query.dateString);
    if (query.date?.$gte) q = q.gte('date', query.date.$gte.toISOString());
    if (query.date?.$lte) q = q.lte('date', query.date.$lte.toISOString());
    const { data, error } = await q;
    if (error) throw error;
    let logs = (data || []).map(fromRow);
    if (query['meals.0']?.$exists) logs = logs.filter((log) => (log.meals || []).length > 0);
    if (query['biometrics.weight']?.$exists) logs = logs.filter((log) => Number(log.biometrics?.weight || 0) > 0);
    if (query['fastingLog.startedAt']?.$exists) logs = logs.filter((log) => !!log.fastingLog?.startedAt);
    return logs;
  },

  async findOne(query = {}) {
    const rows = await this.find(query);
    if (!rows.length) return null;
    return rows[0];
  },

  async aggregate(pipeline = []) {
    if (!pipeline.length) return [];
    const match = pipeline.find((s) => s.$match)?.$match || {};
    const logs = await this.find(match);
    const hasUnwindMeals = pipeline.some((s) => s.$unwind === '$meals');
    const hasCount = pipeline.find((s) => s.$count);
    if (hasUnwindMeals && hasCount) {
      const total = logs.reduce((sum, log) => sum + (log.meals?.length || 0), 0);
      return [{ [hasCount.$count]: total }];
    }
    return [];
  }
};

module.exports = nutritionRepository;
