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
    name: row.name,
    mealType: row.meal_type,
    calories: row.calories || 0,
    protein: row.protein || 0,
    carbs: row.carbs || 0,
    fat: row.fat || 0,
    fiber: row.fiber || 0,
    ingredients: row.ingredients || [],
    servingSize: row.serving_size || '1 serving',
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

const favoriteRepository = {
  async listByUser(userId, mealType = null) {
    let query = getClient().from('favorite_meals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (mealType) query = query.eq('meal_type', mealType);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(fromRow);
  },

  async findById(id, userId) {
    const { data, error } = await getClient().from('favorite_meals').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return fromRow(data);
  },

  async findDuplicate(userId, normalizedName) {
    const { data, error } = await getClient().from('favorite_meals').select('*').eq('user_id', userId).ilike('name', normalizedName).maybeSingle();
    if (error) throw error;
    return fromRow(data);
  },

  async create(payload) {
    const { data, error } = await getClient().from('favorite_meals').insert({
      user_id: payload.userId,
      name: payload.name,
      meal_type: payload.mealType,
      calories: payload.calories || 0,
      protein: payload.protein || 0,
      carbs: payload.carbs || 0,
      fat: payload.fat || 0,
      fiber: payload.fiber || 0,
      ingredients: payload.ingredients || [],
      serving_size: payload.servingSize || '1 serving',
      notes: payload.notes || ''
    }).select('*').single();
    if (error) throw error;
    return fromRow(data);
  },

  async update(id, userId, patch) {
    const payload = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.mealType !== undefined) payload.meal_type = patch.mealType;
    if (patch.calories !== undefined) payload.calories = patch.calories;
    if (patch.protein !== undefined) payload.protein = patch.protein;
    if (patch.carbs !== undefined) payload.carbs = patch.carbs;
    if (patch.fat !== undefined) payload.fat = patch.fat;
    if (patch.fiber !== undefined) payload.fiber = patch.fiber;
    if (patch.ingredients !== undefined) payload.ingredients = patch.ingredients;
    if (patch.servingSize !== undefined) payload.serving_size = patch.servingSize;
    if (patch.notes !== undefined) payload.notes = patch.notes;
    const { data, error } = await getClient().from('favorite_meals').update(payload).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
    if (error) throw error;
    return fromRow(data);
  },

  async remove(id, userId) {
    const { data, error } = await getClient().from('favorite_meals').delete().eq('id', id).eq('user_id', userId).select('*').maybeSingle();
    if (error) throw error;
    return fromRow(data);
  }
};

module.exports = favoriteRepository;
