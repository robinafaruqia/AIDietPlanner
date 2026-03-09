const { generateMealPlanWithAI, isInitialized } = require('./aiMealGenerator');
const Redis = require('ioredis');

// Redis configuration
const CACHE_PREFIX = 'mealplan:';
const CACHE_DURATION = 24 * 60 * 60; // 24 hours in seconds (for Redis TTL)

// Initialize Redis client
let redis = null;
let redisConnected = false;

function initializeRedis() {
  const redisUrl = process.env.REDIS_URL;
  
  // Only try Redis if REDIS_URL is explicitly set
  if (!redisUrl) {
    console.log('ℹ️ REDIS_URL not set, using in-memory cache');
    return;
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      connectTimeout: 5000
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
      redisConnected = true;
    });

    redis.on('error', (err) => {
      console.warn('⚠️ Redis error:', err.message);
      redisConnected = false;
    });

    redis.on('close', () => {
      console.warn('⚠️ Redis connection closed');
      redisConnected = false;
    });

    redis.connect().catch(err => {
      console.warn('⚠️ Redis connection failed, using in-memory fallback:', err.message);
    });

  } catch (error) {
    console.warn('⚠️ Redis initialization failed, using in-memory fallback:', error.message);
  }
}

// Initialize Redis on module load
initializeRedis();

// Graceful Redis shutdown
async function closeRedis() {
  if (redis) {
    try {
      await redis.quit();
      console.log('Redis connection closed.');
    } catch (err) {
      console.error('Error closing Redis:', err.message);
    }
  }
}

// Fallback in-memory cache (used when Redis is unavailable)
const memoryCache = new Map();
const MAX_MEMORY_ENTRIES = 50;

function pruneMemoryCache() {
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return;
  const entries = Array.from(memoryCache.entries());
  entries.sort((a, b) => (a[1]?.timestamp || 0) - (b[1]?.timestamp || 0));
  const removeCount = Math.max(0, memoryCache.size - MAX_MEMORY_ENTRIES);
  for (let i = 0; i < removeCount; i++) {
    memoryCache.delete(entries[i][0]);
  }
}

// Cache operations with Redis + memory fallback
async function getFromCache(key) {
  // Try Redis first
  if (redis && redisConnected) {
    try {
      const data = await redis.get(CACHE_PREFIX + key);
      if (data) {
        console.log('📦 Cache hit (Redis):', key);
        return JSON.parse(data);
      }
    } catch (err) {
      console.warn('Redis get error:', err.message);
    }
  }

  // Fallback to memory cache
  const cached = memoryCache.get(key);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION * 1000) {
    console.log('📦 Cache hit (memory):', key);
    return cached.data;
  }

  return null;
}

async function setToCache(key, data) {
  // Try Redis first
  if (redis && redisConnected) {
    try {
      await redis.setex(CACHE_PREFIX + key, CACHE_DURATION, JSON.stringify(data));
      console.log('💾 Cached to Redis:', key);
    } catch (err) {
      console.warn('Redis set error:', err.message);
    }
  }

  // Also store in memory cache as fallback
  memoryCache.set(key, {
    data: data,
    timestamp: Date.now()
  });
  pruneMemoryCache();
}


function calculateDailyCalories(weight, height, age = 30) {
  // Using Mifflin-St Jeor Equation for BMR (Basal Metabolic Rate)
  // BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5 (for men)
  // BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161 (for women)
  // Using average (assuming gender-neutral calculation)
  // Then multiply by activity factor (1.5 for moderate activity)
  
  // Simplified version: BMR = 10 * weight + 6.25 * height - 5 * age + 5
  // Using average age of 30 and moderate activity factor of 1.5
  const bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  const activityFactor = 1.5; // Moderate activity
  const dailyCalories = bmr * activityFactor;
  
  return Math.round(dailyCalories);
}

// Fallback grocery list generator - extracts ingredients from meals
// Used only if AI doesn't return a grocery list
function generateGroceryList(weeklyPlan) {
  const groceryMap = new Map();
  const categories = {
    'Produce': ['spinach', 'broccoli', 'carrots', 'tomatoes', 'cucumber', 'bell peppers', 'zucchini', 'asparagus', 'celery', 'onions', 'garlic', 'lettuce', 'mixed greens', 'romaine lettuce', 'banana', 'apple', 'blueberries', 'strawberries', 'avocado', 'lemon', 'lime', 'berries', 'sweet potatoes', 'mushrooms'],
    'Protein': ['chicken breast', 'turkey breast', 'ground turkey', 'salmon', 'cod', 'tuna', 'eggs', 'egg whites', 'lean beef', 'chicken thighs', 'greek yogurt', 'cottage cheese', 'protein powder'],
    'Grains': ['oats', 'quinoa', 'brown rice', 'whole wheat bread', 'whole wheat pasta', 'whole wheat tortilla', 'steel cut oats', 'whole grain crackers', 'rice cakes', 'granola'],
    'Dairy': ['almond milk', 'cheese', 'feta', 'parmesan', 'hummus'],
    'Pantry': ['black beans', 'chickpeas', 'kidney beans', 'lentils', 'olive oil', 'balsamic vinaigrette', 'marinara sauce', 'vegetable broth', 'coconut milk', 'honey', 'cinnamon', 'vanilla', 'pesto', 'mayo', 'caesar dressing'],
    'Nuts & Seeds': ['almonds', 'walnuts', 'cashews', 'chia seeds', 'almond butter', 'peanut butter', 'pine nuts', 'nuts'],
    'Other': ['salt', 'pepper', 'dark chocolate', 'dried fruits']
  };

  function categorizeIngredient(ingredientStr) {
    const lower = ingredientStr.toLowerCase();
    for (const [category, items] of Object.entries(categories)) {
      if (items.some(item => lower.includes(item) || item.includes(lower))) {
        return category;
      }
    }
    return 'Other';
  }

  function processIngredients(ingredients) {
    if (!ingredients || !Array.isArray(ingredients)) return;
    ingredients.forEach(ingredient => {
      if (ingredient === null || ingredient === undefined) return;
      const ingredientStr = String(ingredient).trim();
      if (!ingredientStr) return;
      const lowerIngredient = ingredientStr.toLowerCase();
      const existing = groceryMap.get(lowerIngredient) || { 
        item: ingredientStr, 
        quantity: 0, 
        category: categorizeIngredient(ingredientStr) 
      };
      existing.quantity += 1;
      groceryMap.set(lowerIngredient, existing);
    });
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach(day => {
    const dayPlan = weeklyPlan[day];
    if (!dayPlan) return;
    
    // Process all meal types
    ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
      if (dayPlan[mealType]?.ingredients) {
        processIngredients(dayPlan[mealType].ingredients);
      }
    });
    
    // Process snacks
    if (Array.isArray(dayPlan.snacks)) {
      dayPlan.snacks.forEach(snack => {
        if (snack?.ingredients) {
          processIngredients(snack.ingredients);
        }
      });
    }
  });

  // Convert to array and format quantities
  const groceryList = Array.from(groceryMap.values()).map(item => {
    const itemStr = String(item.item || '').trim();
    return {
      item: itemStr ? (itemStr.charAt(0).toUpperCase() + itemStr.slice(1)) : '',
      quantity: item.quantity > 1 ? `${item.quantity} units` : '1 unit',
      category: item.category
    };
  }).filter(i => i.item);

  // Sort by category
  const categoryOrder = ['Produce', 'Protein', 'Grains', 'Dairy', 'Pantry', 'Nuts & Seeds', 'Other'];
  return groceryList.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
}


async function generateWeeklyMealPlan(weight, height, healthConditions, includeGroceryList = true) {
  const dailyCalories = calculateDailyCalories(weight, height);
  
  // Create cache key (include all conditions and grocery list option)
  const conditionKey = healthConditions && healthConditions.length > 0 
    ? healthConditions.map(c => c.toLowerCase()).sort().join('|')
    : 'none';
  const cacheKey = `${weight}_${height}_${conditionKey}_${includeGroceryList}`;
  
  // Check cache (Redis with memory fallback)
  const cached = await getFromCache(cacheKey);
  if (cached) {
    console.log('✅ Returning cached meal plan');
    return cached;
  }

  // Try AI generation if available
  if (isInitialized() && process.env.GEMINI_API_KEY) {
    try {
      console.log('🤖 Generating meal plan with AI...');
      const aiResponse = await generateMealPlanWithAI(weight, height, healthConditions, dailyCalories);
      const { weeklyPlan: aiWeeklyPlan, groceryList: aiGroceryList } = aiResponse;
      
      // Calculate total calories
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      let totalCalories = 0;
      
      days.forEach(day => {
        const dayPlan = aiWeeklyPlan[day];
        if (dayPlan) {
          const dayCal = (dayPlan.breakfast?.calories || 0) + 
                       (dayPlan.lunch?.calories || 0) + 
                       (dayPlan.dinner?.calories || 0) + 
                       (dayPlan.snacks?.reduce((sum, snack) => sum + (snack.calories || 0), 0) || 0);
          totalCalories += dayCal;
        }
      });

      // Use AI-generated grocery list, or fall back to extracting from meals
      let groceryList = [];
      if (includeGroceryList) {
        groceryList = aiGroceryList && aiGroceryList.length > 0 
          ? aiGroceryList 
          : generateGroceryList(aiWeeklyPlan);
      }
      
      const result = {
        weeklyPlan: aiWeeklyPlan,
        groceryList,
        totalCalories: Math.round(totalCalories / 7)
      };

      // Cache the result (Redis with memory fallback)
      await setToCache(cacheKey, result);

      console.log('✅ AI meal plan generated and cached successfully');
      return result;
    } catch (error) {
      console.error('AI generation failed:', error.message);
      // Preserve user-friendly error properties if they exist
      if (error.errorCode) {
        throw error; // Already a user-friendly error
      }
      // Wrap in a generic error
      const wrappedError = new Error(error.message);
      wrappedError.userMessage = 'Failed to generate meal plan';
      wrappedError.userDetails = error.message;
      wrappedError.errorCode = 'AI_GENERATION_FAILED';
      throw wrappedError;
    }
  } else {
    // AI not available - throw error with user-friendly message
    console.error('AI not available. GEMINI_API_KEY not configured.');
    const error = new Error('AI not configured');
    error.userMessage = 'AI service not configured';
    error.userDetails = 'The GEMINI_API_KEY environment variable is not set.';
    error.errorCode = 'NO_API_KEY';
    throw error;
  }
}

module.exports = {
  generateWeeklyMealPlan,
  calculateDailyCalories,
  closeRedis
};

