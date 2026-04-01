const { getDatabaseClient } = require('../config/database');

function getClient() {
  const client = getDatabaseClient();
  if (!client) throw new Error('Database client not initialized');
  return client;
}

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    weight: row.weight,
    height: row.height,
    healthConditions: row.health_conditions || [],
    weeklyPlan: row.weekly_plan || {},
    groceryList: row.grocery_list || [],
    totalCalories: row.total_calories || 0,
    createdAt: row.created_at
  };
}

const mealPlanRepository = {
  async create(payload) {
    const { data, error } = await getClient().from('meal_plans').insert({
      user_id: payload.userId || null,
      weight: payload.weight,
      height: payload.height,
      health_conditions: payload.healthConditions || [],
      weekly_plan: payload.weeklyPlan || {},
      grocery_list: payload.groceryList || [],
      total_calories: payload.totalCalories || 0
    }).select('*').single();
    if (error) throw error;
    return fromRow(data);
  },

  async findCached(weight, height, healthConditions, userId = null, maxAgeDays = 7) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - maxAgeDays);
    let query = getClient()
      .from('meal_plans')
      .select('*')
      .eq('weight', weight)
      .eq('height', height)
      .gte('created_at', minDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    const normalized = [...(healthConditions || [])].sort().join('|');
    const match = (data || []).find((item) => ([...(item.health_conditions || [])].sort().join('|') === normalized));
    return fromRow(match || null);
  },

  async list(userId, limit = 10, offset = 0) {
    let query = getClient().from('meal_plans').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(fromRow);
  },

  async count(userId) {
    let query = getClient().from('meal_plans').select('id', { count: 'exact', head: true });
    if (userId) query = query.eq('user_id', userId);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  async findById(id, userId = null) {
    let query = getClient().from('meal_plans').select('*').eq('id', id);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return fromRow(data);
  },

  async deleteById(id, userId = null) {
    let query = getClient().from('meal_plans').delete().eq('id', id).select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return fromRow(data);
  }
};

module.exports = mealPlanRepository;
