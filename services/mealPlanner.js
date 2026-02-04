const { generateMealPlanWithAI, isInitialized } = require('./aiMealGenerator');

// In-memory cache for AI-generated meal plans
const mealPlanCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Meal database - commented out (AI-only mode)
const mealDatabase = {};

// Health condition meal preferences
const healthConditionPreferences = {
  'gallstones': 'lowFat',
  'diabetes': 'diabetic',
  'high blood pressure': 'lowFat',
  'heart disease': 'lowFat',
  'obesity': 'highProtein',
  'default': 'general'
};

function getMealCategory(healthConditions) {
  if (!healthConditions || healthConditions.length === 0) {
    return 'general';
  }
  
  // Check for specific conditions
  const condition = healthConditions[0].toLowerCase();
  return healthConditionPreferences[condition] || healthConditionPreferences['default'];
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

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach(day => {
    const dayPlan = weeklyPlan[day];
    if (dayPlan) {
      // Process breakfast
      if (dayPlan.breakfast && dayPlan.breakfast.ingredients) {
        dayPlan.breakfast.ingredients.forEach(ingredient => {
          const lowerIngredient = ingredient.toLowerCase();
          const existing = groceryMap.get(lowerIngredient) || { item: ingredient, quantity: 0, category: 'Other' };
          existing.quantity += 1;
          
          // Categorize
          for (const [category, items] of Object.entries(categories)) {
            if (items.some(item => lowerIngredient.includes(item) || item.includes(lowerIngredient))) {
              existing.category = category;
              break;
            }
          }
          groceryMap.set(lowerIngredient, existing);
        });
      }
      
      // Process lunch
      if (dayPlan.lunch && dayPlan.lunch.ingredients) {
        dayPlan.lunch.ingredients.forEach(ingredient => {
          const lowerIngredient = ingredient.toLowerCase();
          const existing = groceryMap.get(lowerIngredient) || { item: ingredient, quantity: 0, category: 'Other' };
          existing.quantity += 1;
          
          for (const [category, items] of Object.entries(categories)) {
            if (items.some(item => lowerIngredient.includes(item) || item.includes(lowerIngredient))) {
              existing.category = category;
              break;
            }
          }
          groceryMap.set(lowerIngredient, existing);
        });
      }
      
      // Process dinner
      if (dayPlan.dinner && dayPlan.dinner.ingredients) {
        dayPlan.dinner.ingredients.forEach(ingredient => {
          const lowerIngredient = ingredient.toLowerCase();
          const existing = groceryMap.get(lowerIngredient) || { item: ingredient, quantity: 0, category: 'Other' };
          existing.quantity += 1;
          
          for (const [category, items] of Object.entries(categories)) {
            if (items.some(item => lowerIngredient.includes(item) || item.includes(lowerIngredient))) {
              existing.category = category;
              break;
            }
          }
          groceryMap.set(lowerIngredient, existing);
        });
      }
      
      // Process snacks
      if (dayPlan.snacks && Array.isArray(dayPlan.snacks)) {
        dayPlan.snacks.forEach(snack => {
          if (snack.ingredients) {
            snack.ingredients.forEach(ingredient => {
              const lowerIngredient = ingredient.toLowerCase();
              const existing = groceryMap.get(lowerIngredient) || { item: ingredient, quantity: 0, category: 'Other' };
              existing.quantity += 1;
              
              for (const [category, items] of Object.entries(categories)) {
                if (items.some(item => lowerIngredient.includes(item) || item.includes(lowerIngredient))) {
                  existing.category = category;
                  break;
                }
              }
              groceryMap.set(lowerIngredient, existing);
            });
          }
        });
      }
    }
  });

  // Convert to array and format quantities
  const groceryList = Array.from(groceryMap.values()).map(item => ({
    item: item.item.charAt(0).toUpperCase() + item.item.slice(1),
    quantity: item.quantity > 1 ? `${item.quantity} units` : '1 unit',
    category: item.category
  }));

  // Sort by category
  return groceryList.sort((a, b) => {
    const categoryOrder = ['Produce', 'Protein', 'Grains', 'Dairy', 'Pantry', 'Nuts & Seeds', 'Other'];
    return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
  });
}

function getRandomMeal(mealArray) {
  return mealArray[Math.floor(Math.random() * mealArray.length)];
}

// Fallback function - disabled (AI-only mode)
// function generateWeeklyMealPlanFallback(weight, height, healthConditions, includeGroceryList = true) {
//   // Uncomment mealDatabase above and this function to enable fallback mode
// }

async function generateWeeklyMealPlan(weight, height, healthConditions, includeGroceryList = true) {
  const dailyCalories = calculateDailyCalories(weight, height);
  
  // Create cache key (include grocery list option in cache key)
  const conditionKey = healthConditions && healthConditions.length > 0 
    ? healthConditions[0].toLowerCase() 
    : 'none';
  const cacheKey = `${weight}_${height}_${conditionKey}_${includeGroceryList}`;
  
  // Check cache
  const cached = mealPlanCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log('Returning cached meal plan');
    return cached.data;
  }

  // Try AI generation if available
  if (isInitialized() && process.env.GEMINI_API_KEY) {
    try {
      console.log('Generating meal plan with AI...');
      const aiWeeklyPlan = await generateMealPlanWithAI(weight, height, healthConditions, dailyCalories);
      
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

      // Generate grocery list only if requested
      const groceryList = includeGroceryList ? generateGroceryList(aiWeeklyPlan) : [];
      
      const result = {
        weeklyPlan: aiWeeklyPlan,
        groceryList,
        totalCalories: Math.round(totalCalories / 7)
      };

      // Cache the result
      mealPlanCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      console.log('AI meal plan generated successfully');
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
  calculateDailyCalories
};

