const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const NutritionLog = require('../models/NutritionLog');
const { optionalAuth } = require('../middleware/auth');
const https = require('https');
const http = require('http');

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

function getUserId(req) {
  return req.user ? req.user._id : null;
}

function buildQuery(userId, extra = {}) {
  if (userId) {
    return { userId, ...extra };
  }
  return { userId: { $exists: false }, ...extra };
}

router.use(optionalAuth);

router.get('/log/:date?', async (req, res) => {
  try {
    const dateString = req.params.date || getDateString();
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        log: {
          dateString,
          meals: [],
          dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          goals: { calories: 2000, protein: 50, carbs: 250, fat: 65, fiber: 25 },
          water: 0
        },
        message: 'Database not connected - showing empty log'
      });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    res.json({ success: true, log });
  } catch (error) {
    console.error('Error fetching nutrition log:', error);
    res.status(500).json({ error: 'Failed to fetch nutrition log' });
  }
});

router.get('/history/:days?', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.params.days) || 7, 1), 90);
    
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, history: [], message: 'Database not connected' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userId = getUserId(req);
    const query = buildQuery(userId, {
      date: { $gte: startDate, $lte: endDate }
    });

    const logs = await NutritionLog.find(query).sort({ date: -1 });

    res.json({ success: true, history: logs });
  } catch (error) {
    console.error('Error fetching nutrition history:', error);
    res.status(500).json({ error: 'Failed to fetch nutrition history' });
  }
});

router.post('/log/meal', async (req, res) => {
  try {
    const { date, mealType, name, calories, protein, carbs, fat, fiber } = req.body;
    const dateString = date || getDateString();

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Meal name is required' });
    }

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(mealType)) {
      return res.status(400).json({ error: 'Invalid meal type' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    
    log.meals.push({
      mealType,
      name: name.trim(),
      calories: parseNumber(calories),
      protein: parseNumber(protein),
      carbs: parseNumber(carbs),
      fat: parseNumber(fat),
      fiber: parseNumber(fiber),
      time: new Date()
    });

    await log.save();
    res.json({ success: true, log });
  } catch (error) {
    console.error('Error adding meal:', error);
    res.status(500).json({ error: 'Failed to add meal' });
  }
});

router.post('/log/from-plan', async (req, res) => {
  try {
    const { date, mealType, meal } = req.body;
    const dateString = date || getDateString();

    if (!meal || !meal.name) {
      return res.status(400).json({ error: 'Meal data is required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    
    log.meals.push({
      mealType: mealType || 'snack',
      name: meal.name,
      calories: parseNumber(meal.calories),
      protein: parseNumber(meal.protein),
      carbs: parseNumber(meal.carbs),
      fat: parseNumber(meal.fat),
      fiber: parseNumber(meal.fiber),
      time: new Date()
    });

    await log.save();
    res.json({ success: true, log, message: `${meal.name} logged successfully!` });
  } catch (error) {
    console.error('Error logging meal from plan:', error);
    res.status(500).json({ error: 'Failed to log meal' });
  }
});

router.delete('/log/meal/:date/:mealId', async (req, res) => {
  try {
    const { date, mealId } = req.params;

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const query = buildQuery(userId, { dateString: date });
    const log = await NutritionLog.findOne(query);
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    log.meals = log.meals.filter(m => m._id.toString() !== mealId);
    await log.save();

    res.json({ success: true, log });
  } catch (error) {
    console.error('Error removing meal:', error);
    res.status(500).json({ error: 'Failed to remove meal' });
  }
});

router.put('/goals', async (req, res) => {
  try {
    const { date, goals } = req.body;
    const dateString = date || getDateString();

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    
    if (goals) {
      log.goals = {
        calories: parseNumber(goals.calories, log.goals.calories),
        protein: parseNumber(goals.protein, log.goals.protein),
        carbs: parseNumber(goals.carbs, log.goals.carbs),
        fat: parseNumber(goals.fat, log.goals.fat),
        fiber: parseNumber(goals.fiber, log.goals.fiber)
      };
    }

    await log.save();
    res.json({ success: true, log });
  } catch (error) {
    console.error('Error updating goals:', error);
    res.status(500).json({ error: 'Failed to update goals' });
  }
});

router.put('/water', async (req, res) => {
  try {
    const { date, glasses } = req.body;
    const dateString = date || getDateString();

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    log.water = parseNumber(glasses, 0);
    await log.save();

    res.json({ success: true, log });
  } catch (error) {
    console.error('Error updating water intake:', error);
    res.status(500).json({ error: 'Failed to update water intake' });
  }
});

router.post('/log/exercise', async (req, res) => {
  try {
    const { date, name, duration, caloriesBurned, type } = req.body;
    const dateString = date || getDateString();

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    
    log.exercises.push({
      name: name.trim(),
      duration: parseNumber(duration),
      caloriesBurned: parseNumber(caloriesBurned),
      type: type || 'other',
      time: new Date()
    });

    await log.save();
    res.json({ success: true, log });
  } catch (error) {
    console.error('Error adding exercise:', error);
    res.status(500).json({ error: 'Failed to add exercise' });
  }
});

router.delete('/log/exercise/:date/:exerciseId', async (req, res) => {
  try {
    const { date, exerciseId } = req.params;

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const query = buildQuery(userId, { dateString: date });
    const log = await NutritionLog.findOne(query);
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    log.exercises = log.exercises.filter(e => e._id.toString() !== exerciseId);
    await log.save();

    res.json({ success: true, log });
  } catch (error) {
    console.error('Error removing exercise:', error);
    res.status(500).json({ error: 'Failed to remove exercise' });
  }
});

router.put('/biometrics', async (req, res) => {
  try {
    const { date, weight, bodyFat, waist, notes } = req.body;
    const dateString = date || getDateString();

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    
    log.biometrics = {
      weight: weight !== undefined ? parseNumber(weight) : log.biometrics?.weight,
      bodyFat: bodyFat !== undefined ? parseNumber(bodyFat) : log.biometrics?.bodyFat,
      waist: waist !== undefined ? parseNumber(waist) : log.biometrics?.waist,
      notes: notes !== undefined ? notes : log.biometrics?.notes
    };

    await log.save();
    res.json({ success: true, log });
  } catch (error) {
    console.error('Error updating biometrics:', error);
    res.status(500).json({ error: 'Failed to update biometrics' });
  }
});

router.put('/mood', async (req, res) => {
  try {
    const { date, mood } = req.body;
    const dateString = date || getDateString();

    const validMoods = ['great', 'good', 'okay', 'tired', 'stressed', ''];
    if (!validMoods.includes(mood)) {
      return res.status(400).json({ error: 'Invalid mood value' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const userId = getUserId(req);
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);
    log.mood = mood;
    await log.save();

    res.json({ success: true, log });
  } catch (error) {
    console.error('Error updating mood:', error);
    res.status(500).json({ error: 'Failed to update mood' });
  }
});

router.get('/biometrics/history/:days?', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.params.days) || 30, 1), 365);
    
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, history: [], message: 'Database not connected' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userId = getUserId(req);
    const query = buildQuery(userId, {
      date: { $gte: startDate, $lte: endDate },
      'biometrics.weight': { $exists: true, $gt: 0 }
    });

    const logs = await NutritionLog.find(query).sort({ date: 1 }).select('dateString biometrics');

    const history = logs.map(log => ({
      date: log.dateString,
      weight: log.biometrics?.weight,
      bodyFat: log.biometrics?.bodyFat,
      waist: log.biometrics?.waist
    }));

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching biometrics history:', error);
    res.status(500).json({ error: 'Failed to fetch biometrics history' });
  }
});

router.post('/calculate-goals', (req, res) => {
  try {
    const { weight, height, age, gender, activityLevel, goal } = req.body;
    
    if (!weight || !height) {
      return res.status(400).json({ error: 'Weight and height are required' });
    }

    const w = parseNumber(weight);
    const h = parseNumber(height);
    const a = parseNumber(age, 30);
    
    let bmr;
    if (gender === 'female') {
      bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
    } else {
      bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
    }
    
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryActive: 1.9
    };
    
    const multiplier = activityMultipliers[activityLevel] || 1.55;
    let tdee = Math.round(bmr * multiplier);
    
    if (goal === 'lose') {
      tdee -= 500;
    } else if (goal === 'gain') {
      tdee += 300;
    }
    
    const protein = Math.round(w * 1.6);
    const fat = Math.round((tdee * 0.25) / 9);
    const carbs = Math.round((tdee - (protein * 4) - (fat * 9)) / 4);
    
    const goals = {
      calories: Math.max(1200, tdee),
      protein: protein,
      carbs: Math.max(100, carbs),
      fat: fat,
      fiber: gender === 'female' ? 25 : 30
    };
    
    res.json({ success: true, goals, bmr: Math.round(bmr), tdee });
  } catch (error) {
    console.error('Error calculating goals:', error);
    res.status(500).json({ error: 'Failed to calculate goals' });
  }
});

router.get('/streak', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, streak: 0, message: 'Database not connected' });
    }

    const userId = getUserId(req);
    const today = new Date();
    let streak = 0;
    let checkDate = new Date(today);
    
    while (true) {
      const dateString = getDateString(checkDate);
      const query = buildQuery(userId, {
        dateString,
        'meals.0': { $exists: true }
      });
      const log = await NutritionLog.findOne(query);
      
      if (!log) break;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      
      if (streak > 365) break;
    }
    
    res.json({ success: true, streak });
  } catch (error) {
    console.error('Error getting streak:', error);
    res.status(500).json({ error: 'Failed to get streak' });
  }
});

router.get('/summary/weekly', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, summary: null, message: 'Database not connected' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const userId = getUserId(req);
    const query = buildQuery(userId, {
      date: { $gte: startDate, $lte: endDate }
    });

    const logs = await NutritionLog.find(query);

    if (logs.length === 0) {
      return res.json({ success: true, summary: null });
    }

    const summary = {
      daysLogged: logs.length,
      averages: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        water: 0
      },
      totals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        meals: 0
      }
    };

    logs.forEach(log => {
      summary.totals.calories += log.dailyTotals.calories;
      summary.totals.protein += log.dailyTotals.protein;
      summary.totals.carbs += log.dailyTotals.carbs;
      summary.totals.fat += log.dailyTotals.fat;
      summary.totals.fiber += log.dailyTotals.fiber;
      summary.totals.meals += log.meals.length;
      summary.averages.water += log.water || 0;
    });

    const count = logs.length;
    summary.averages.calories = Math.round(summary.totals.calories / count);
    summary.averages.protein = Math.round(summary.totals.protein / count);
    summary.averages.carbs = Math.round(summary.totals.carbs / count);
    summary.averages.fat = Math.round(summary.totals.fat / count);
    summary.averages.fiber = Math.round(summary.totals.fiber / count);
    summary.averages.water = Math.round(summary.averages.water / count * 10) / 10;

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    res.status(500).json({ error: 'Failed to get weekly summary' });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userId = getUserId(req);
    const query = buildQuery(userId, {
      date: { $gte: startDate, $lte: endDate }
    });

    const logs = await NutritionLog.find(query).sort({ date: -1 });

    const csvRows = ['Date,Meal Type,Food Name,Calories,Protein,Carbs,Fat,Fiber'];
    
    logs.forEach(log => {
      if (log.meals && log.meals.length > 0) {
        log.meals.forEach(meal => {
          const row = [
            log.dateString,
            meal.mealType || '',
            `"${(meal.name || '').replace(/"/g, '""')}"`,
            meal.calories || 0,
            meal.protein || 0,
            meal.carbs || 0,
            meal.fat || 0,
            meal.fiber || 0
          ];
          csvRows.push(row.join(','));
        });
      }
    });

    const csv = csvRows.join('\n');
    const filename = `nutrition-log-${getDateString()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting nutrition data:', error);
    res.status(500).json({ error: 'Failed to export nutrition data' });
  }
});

router.get('/barcode/:code', async (req, res) => {
  try {
    const barcode = req.params.code;
    
    if (!barcode || !/^\d{8,14}$/.test(barcode)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid barcode format. Expected 8-14 digits (UPC/EAN).' 
      });
    }

    const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;

    const fetchProduct = () => {
      return new Promise((resolve, reject) => {
        https.get(openFoodFactsUrl, {
          headers: {
            'User-Agent': 'AIDietPlanner/1.0 (https://github.com/aidietplanner)'
          }
        }, (response) => {
          let data = '';
          
          response.on('data', chunk => {
            data += chunk;
          });
          
          response.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Invalid response from Open Food Facts'));
            }
          });
        }).on('error', reject);
      });
    };

    const apiResponse = await fetchProduct();

    if (apiResponse.status === 0 || !apiResponse.product) {
      return res.json({ 
        success: false, 
        error: 'Product not found in Open Food Facts database',
        barcode 
      });
    }

    const product = apiResponse.product;
    const nutriments = product.nutriments || {};

    const servingSize = product.serving_size || product.quantity || '100g';
    const hasServingData = product.serving_size && nutriments['energy-kcal_serving'];

    let calories, protein, carbs, fat, fiber;

    if (hasServingData) {
      calories = Math.round(nutriments['energy-kcal_serving'] || 0);
      protein = Math.round(nutriments.proteins_serving || 0);
      carbs = Math.round(nutriments.carbohydrates_serving || 0);
      fat = Math.round(nutriments.fat_serving || 0);
      fiber = Math.round(nutriments.fiber_serving || 0);
    } else {
      calories = Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0);
      protein = Math.round(nutriments.proteins_100g || nutriments.proteins || 0);
      carbs = Math.round(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0);
      fat = Math.round(nutriments.fat_100g || nutriments.fat || 0);
      fiber = Math.round(nutriments.fiber_100g || nutriments.fiber || 0);
    }

    const productData = {
      success: true,
      barcode,
      name: product.product_name || product.product_name_en || 'Unknown Product',
      brand: product.brands || '',
      calories,
      protein,
      carbs,
      fat,
      fiber,
      servingSize: hasServingData ? servingSize : `100g (${servingSize})`,
      image: product.image_small_url || product.image_url || null,
      categories: product.categories || '',
      nutriscore: product.nutriscore_grade || null
    };

    res.json(productData);

  } catch (error) {
    console.error('Error fetching barcode data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch product information. Please try again.' 
    });
  }
});

module.exports = router;
