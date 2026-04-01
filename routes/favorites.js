const express = require('express');
const router = express.Router();
const favoriteRepository = require('../repositories/favoriteRepository');
const nutritionRepository = require('../repositories/nutritionRepository');
const { isDatabaseConnected } = require('../config/database');
const { apiAuth } = require('../middleware/auth');

function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseNumber(value, defaultVal = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}

router.use(apiAuth);

router.get('/', async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const { mealType } = req.query;
    
    let favorites;
    if (mealType && ['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
      favorites = await favoriteRepository.listByUser(req.user.id, mealType);
    } else {
      favorites = await favoriteRepository.listByUser(req.user.id);
    }

    res.json({ 
      success: true, 
      favorites: favorites.map(f => ({
        id: f.id,
        name: f.name,
        mealType: f.mealType,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        fiber: f.fiber,
        ingredients: f.ingredients,
        servingSize: f.servingSize,
        notes: f.notes,
        createdAt: f.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, mealType, calories, protein, carbs, fat, fiber, ingredients, servingSize, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Meal name is required' });
    }

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(mealType)) {
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const existingFavorite = await favoriteRepository.findDuplicate(req.user.id, name.trim().toLowerCase());

    if (existingFavorite) {
      return res.status(409).json({ 
        error: 'A favorite with this name already exists',
        existingId: existingFavorite.id
      });
    }

    const favorite = await favoriteRepository.create({
      userId: req.user.id,
      name: name.trim(),
      mealType,
      calories: parseNumber(calories),
      protein: parseNumber(protein),
      carbs: parseNumber(carbs),
      fat: parseNumber(fat),
      fiber: parseNumber(fiber),
      ingredients: Array.isArray(ingredients) ? ingredients.filter(i => i && i.trim()) : [],
      servingSize: servingSize || '1 serving',
      notes: notes || ''
    });

    res.status(201).json({ 
      success: true, 
      favorite: {
        id: favorite.id,
        name: favorite.name,
        mealType: favorite.mealType,
        calories: favorite.calories,
        protein: favorite.protein,
        carbs: favorite.carbs,
        fat: favorite.fat,
        fiber: favorite.fiber,
        ingredients: favorite.ingredients,
        servingSize: favorite.servingSize,
        notes: favorite.notes,
        createdAt: favorite.createdAt
      },
      message: 'Meal saved to favorites!'
    });
  } catch (error) {
    console.error('Error saving favorite:', error);
    res.status(500).json({ error: 'Failed to save favorite' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const favorite = await favoriteRepository.findById(req.params.id, req.user.id);

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ 
      success: true, 
      favorite: {
        id: favorite._id,
        name: favorite.name,
        mealType: favorite.mealType,
        calories: favorite.calories,
        protein: favorite.protein,
        carbs: favorite.carbs,
        fat: favorite.fat,
        fiber: favorite.fiber,
        ingredients: favorite.ingredients,
        servingSize: favorite.servingSize,
        notes: favorite.notes,
        createdAt: favorite.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching favorite:', error);
    res.status(500).json({ error: 'Failed to fetch favorite' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, mealType, calories, protein, carbs, fat, fiber, ingredients, servingSize, notes } = req.body;

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const existing = await favoriteRepository.findById(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    const patch = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Meal name cannot be empty' });
      }
      patch.name = name.trim();
    }

    if (mealType !== undefined) {
      const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      if (!validMealTypes.includes(mealType)) {
        return res.status(400).json({ error: 'Invalid meal type' });
      }
      patch.mealType = mealType;
    }

    if (calories !== undefined) patch.calories = parseNumber(calories);
    if (protein !== undefined) patch.protein = parseNumber(protein);
    if (carbs !== undefined) patch.carbs = parseNumber(carbs);
    if (fat !== undefined) patch.fat = parseNumber(fat);
    if (fiber !== undefined) patch.fiber = parseNumber(fiber);
    if (ingredients !== undefined) {
      patch.ingredients = Array.isArray(ingredients) ? ingredients.filter(i => i && i.trim()) : [];
    }
    if (servingSize !== undefined) patch.servingSize = servingSize;
    if (notes !== undefined) patch.notes = notes;

    const favorite = await favoriteRepository.update(req.params.id, req.user.id, patch);

    res.json({ 
      success: true, 
      favorite: {
        id: favorite._id,
        name: favorite.name,
        mealType: favorite.mealType,
        calories: favorite.calories,
        protein: favorite.protein,
        carbs: favorite.carbs,
        fat: favorite.fat,
        fiber: favorite.fiber,
        ingredients: favorite.ingredients,
        servingSize: favorite.servingSize,
        notes: favorite.notes,
        createdAt: favorite.createdAt
      },
      message: 'Favorite updated!'
    });
  } catch (error) {
    console.error('Error updating favorite:', error);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const favorite = await favoriteRepository.remove(req.params.id, req.user.id);

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ 
      success: true, 
      message: 'Favorite removed successfully'
    });
  } catch (error) {
    console.error('Error deleting favorite:', error);
    res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

router.post('/:id/log', async (req, res) => {
  try {
    const { date } = req.body;
    const dateString = date || getDateString();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const favorite = await favoriteRepository.findById(req.params.id, req.user.id);

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    const log = await nutritionRepository.getOrCreateForDate(req.user.id, dateString);
    
    log.meals.push({
      mealType: favorite.mealType,
      name: favorite.name,
      servingSize: favorite.servingSize,
      calories: favorite.calories,
      protein: favorite.protein,
      carbs: favorite.carbs,
      fat: favorite.fat,
      fiber: favorite.fiber,
      time: new Date()
    });

    await nutritionRepository.save(log);

    res.json({ 
      success: true, 
      log,
      message: `${favorite.name} logged to your nutrition tracker!`
    });
  } catch (error) {
    console.error('Error logging favorite:', error);
    res.status(500).json({ error: 'Failed to log favorite meal' });
  }
});

module.exports = router;
