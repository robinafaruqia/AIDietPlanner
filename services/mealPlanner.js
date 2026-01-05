const { generateMealPlanWithAI, isInitialized } = require('./aiMealGenerator');

// In-memory cache for AI-generated meal plans
const mealPlanCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Meal database with nutritional information (fallback)
const mealDatabase = {
  // // Low-fat meals (good for gallstones)
  // lowFat: {
  //   breakfast: [
  //     // { name: "Oatmeal with Berries", ingredients: ["oats", "blueberries", "strawberries", "almond milk"], calories: 300, protein: 8, carbs: 55, fat: 5, fiber: 8 },
  //     // { name: "Greek Yogurt Parfait", ingredients: ["greek yogurt", "granola", "honey", "banana"], calories: 280, protein: 15, carbs: 45, fat: 4, fiber: 4 },
  //     // { name: "Scrambled Egg Whites", ingredients: ["egg whites", "spinach", "tomatoes", "whole wheat toast"], calories: 250, protein: 20, carbs: 30, fat: 3, fiber: 5 },
  //     // { name: "Smoothie Bowl", ingredients: ["banana", "spinach", "protein powder", "almond milk", "chia seeds"], calories: 320, protein: 25, carbs: 40, fat: 6, fiber: 10 }
  //   ],
  //   lunch: [
  //     // { name: "Grilled Chicken Salad", ingredients: ["chicken breast", "mixed greens", "cucumber", "tomatoes", "balsamic vinaigrette"], calories: 350, protein: 35, carbs: 20, fat: 8, fiber: 6 },
  //     // { name: "Quinoa Bowl", ingredients: ["quinoa", "black beans", "corn", "avocado", "lime"], calories: 420, protein: 18, carbs: 65, fat: 10, fiber: 12 },
  //     // { name: "Turkey Wrap", ingredients: ["turkey breast", "whole wheat tortilla", "lettuce", "tomatoes", "hummus"], calories: 380, protein: 28, carbs: 45, fat: 9, fiber: 7 },
  //     // { name: "Lentil Soup", ingredients: ["lentils", "carrots", "celery", "onions", "vegetable broth"], calories: 300, protein: 18, carbs: 50, fat: 2, fiber: 15 }
  //   ],
  //   dinner: [
  //     // { name: "Baked Salmon", ingredients: ["salmon", "brown rice", "steamed broccoli", "lemon"], calories: 450, protein: 35, carbs: 45, fat: 12, fiber: 6 },
  //     // { name: "Turkey Meatballs", ingredients: ["ground turkey", "whole wheat pasta", "marinara sauce", "zucchini"], calories: 480, protein: 32, carbs: 55, fat: 10, fiber: 8 },
  //     // { name: "Chicken Stir Fry", ingredients: ["chicken breast", "bell peppers", "broccoli", "brown rice"], calories: 420, protein: 38, carbs: 50, fat: 8, fiber: 7 },
  //     // { name: "Vegetable Curry", ingredients: ["chickpeas", "sweet potatoes", "coconut milk", "brown rice"], calories: 400, protein: 15, carbs: 60, fat: 9, fiber: 14 }
  //   ],
  //   snacks: [
  //     // { name: "Apple with Almond Butter", ingredients: ["apple", "almond butter"], calories: 200, protein: 5, carbs: 30, fat: 8, fiber: 6 },
  //     // { name: "Carrot Sticks with Hummus", ingredients: ["carrots", "hummus"], calories: 150, protein: 6, carbs: 20, fat: 5, fiber: 6 },
  //     // { name: "Greek Yogurt", ingredients: ["greek yogurt", "honey"], calories: 120, protein: 12, carbs: 15, fat: 2, fiber: 0 },
  //     // { name: "Mixed Nuts", ingredients: ["almonds", "walnuts", "cashews"], calories: 180, protein: 6, carbs: 8, fat: 15, fiber: 3 }
  //   ]
  // },
  // // Diabetic-friendly meals
  // diabetic: {
  //   breakfast: [
  //     { name: "Steel Cut Oats", ingredients: ["steel cut oats", "cinnamon", "walnuts", "unsweetened almond milk"], calories: 280, protein: 10, carbs: 40, fat: 8, fiber: 8 },
  //     { name: "Veggie Omelet", ingredients: ["eggs", "spinach", "mushrooms", "bell peppers", "cheese"], calories: 300, protein: 22, carbs: 10, fat: 18, fiber: 3 },
  //     { name: "Chia Pudding", ingredients: ["chia seeds", "unsweetened almond milk", "berries", "vanilla"], calories: 250, protein: 8, carbs: 25, fat: 12, fiber: 15 }
  //   ],
  //   lunch: [
  //     { name: "Grilled Chicken Caesar Salad", ingredients: ["chicken breast", "romaine lettuce", "parmesan", "caesar dressing"], calories: 380, protein: 40, carbs: 12, fat: 18, fiber: 4 },
  //     { name: "Mediterranean Bowl", ingredients: ["chickpeas", "cucumber", "tomatoes", "feta", "olive oil"], calories: 350, protein: 15, carbs: 35, fat: 16, fiber: 10 },
  //     { name: "Zucchini Noodles with Pesto", ingredients: ["zucchini", "pesto", "cherry tomatoes", "pine nuts"], calories: 320, protein: 12, carbs: 20, fat: 22, fiber: 6 }
  //   ],
  //   dinner: [
  //     { name: "Baked Cod", ingredients: ["cod", "quinoa", "asparagus", "lemon butter"], calories: 400, protein: 38, carbs: 40, fat: 10, fiber: 5 },
  //     { name: "Turkey Chili", ingredients: ["ground turkey", "kidney beans", "tomatoes", "peppers"], calories: 420, protein: 35, carbs: 45, fat: 12, fiber: 12 },
  //     { name: "Stuffed Bell Peppers", ingredients: ["bell peppers", "lean ground beef", "brown rice", "tomatoes"], calories: 380, protein: 28, carbs: 35, fat: 14, fiber: 6 }
  //   ],
  //   snacks: [
  //     { name: "Celery with Peanut Butter", ingredients: ["celery", "natural peanut butter"], calories: 150, protein: 6, carbs: 8, fat: 11, fiber: 3 },
  //     { name: "Hard Boiled Eggs", ingredients: ["eggs"], calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
  //     { name: "Cheese and Crackers", ingredients: ["whole grain crackers", "cheese"], calories: 180, protein: 8, carbs: 15, fat: 10, fiber: 3 }
  //   ]
  // },
  // // High protein meals
  // highProtein: {
  //   breakfast: [
  //     { name: "Protein Pancakes", ingredients: ["protein powder", "eggs", "banana", "oats"], calories: 350, protein: 35, carbs: 40, fat: 8, fiber: 6 },
  //     { name: "Egg White Scramble", ingredients: ["egg whites", "turkey", "vegetables", "cheese"], calories: 320, protein: 40, carbs: 15, fat: 10, fiber: 4 }
  //   ],
  //   lunch: [
  //     { name: "Chicken Breast with Sweet Potato", ingredients: ["chicken breast", "sweet potato", "green beans"], calories: 450, protein: 45, carbs: 50, fat: 8, fiber: 8 },
  //     { name: "Tuna Salad", ingredients: ["tuna", "greek yogurt", "celery", "whole grain bread"], calories: 380, protein: 42, carbs: 35, fat: 8, fiber: 6 }
  //   ],
  //   dinner: [
  //     { name: "Lean Beef with Vegetables", ingredients: ["lean beef", "broccoli", "brown rice"], calories: 500, protein: 48, carbs: 45, fat: 12, fiber: 7 },
  //     { name: "Grilled Chicken Thighs", ingredients: ["chicken thighs", "quinoa", "roasted vegetables"], calories: 480, protein: 42, carbs: 40, fat: 15, fiber: 6 }
  //   ],
  //   snacks: [
  //     { name: "Protein Shake", ingredients: ["protein powder", "almond milk", "banana"], calories: 250, protein: 30, carbs: 25, fat: 4, fiber: 4 },
  //     { name: "Cottage Cheese with Berries", ingredients: ["cottage cheese", "blueberries", "almonds"], calories: 200, protein: 20, carbs: 15, fat: 6, fiber: 3 }
  //   ]
  // },
  // // General healthy meals
  // general: {
  //   breakfast: [
  //     { name: "Avocado Toast", ingredients: ["whole grain bread", "avocado", "eggs", "tomatoes"], calories: 350, protein: 15, carbs: 35, fat: 18, fiber: 10 },
  //     { name: "Breakfast Burrito", ingredients: ["whole wheat tortilla", "eggs", "black beans", "salsa", "cheese"], calories: 380, protein: 20, carbs: 45, fat: 14, fiber: 8 }
  //   ],
  //   lunch: [
  //     { name: "Chicken Wrap", ingredients: ["chicken", "whole wheat wrap", "lettuce", "tomatoes", "mayo"], calories: 400, protein: 30, carbs: 40, fat: 14, fiber: 6 },
  //     { name: "Salmon Salad", ingredients: ["salmon", "mixed greens", "quinoa", "dressing"], calories: 420, protein: 32, carbs: 35, fat: 16, fiber: 6 }
  //   ],
  //   dinner: [
  //     { name: "Pasta Primavera", ingredients: ["whole wheat pasta", "vegetables", "olive oil", "parmesan"], calories: 450, protein: 18, carbs: 60, fat: 14, fiber: 8 },
  //     { name: "Beef Stir Fry", ingredients: ["lean beef", "vegetables", "brown rice"], calories: 480, protein: 35, carbs: 50, fat: 14, fiber: 6 }
  //   ],
  //   snacks: [
  //     { name: "Trail Mix", ingredients: ["nuts", "dried fruits", "dark chocolate"], calories: 200, protein: 6, carbs: 20, fat: 12, fiber: 4 },
  //     { name: "Rice Cakes with Avocado", ingredients: ["rice cakes", "avocado", "salt"], calories: 180, protein: 4, carbs: 25, fat: 8, fiber: 6 }
  //   ]
  // }
};

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

function generateWeeklyMealPlanFallback(weight, height, healthConditions, includeGroceryList = true) {
  // Fallback to hardcoded meals if AI fails
  const mealCategory = getMealCategory(healthConditions);
  const meals = mealDatabase[mealCategory];
  const dailyCalories = calculateDailyCalories(weight, height);
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weeklyPlan = {};
  let totalCalories = 0;

  days.forEach(day => {
    const breakfast = getRandomMeal(meals.breakfast);
    const lunch = getRandomMeal(meals.lunch);
    const dinner = getRandomMeal(meals.dinner);
    const snacks = [getRandomMeal(meals.snacks)];

    const dayCalories = breakfast.calories + lunch.calories + dinner.calories + snacks.reduce((sum, snack) => sum + snack.calories, 0);
    totalCalories += dayCalories;

    weeklyPlan[day] = {
      breakfast,
      lunch,
      dinner,
      snacks
    };
  });

  // Generate grocery list only if requested
  const groceryList = includeGroceryList ? generateGroceryList(weeklyPlan) : [];

  return {
    weeklyPlan,
    groceryList,
    totalCalories: Math.round(totalCalories / 7) // Average daily calories
  };
}

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
      console.warn('AI generation failed, using fallback:', error.message);
      // Fall through to fallback
    }
  } else {
    console.log('AI not available, using fallback meals');
  }

  // Fallback to hardcoded meals
  const fallbackResult = generateWeeklyMealPlanFallback(weight, height, healthConditions, includeGroceryList);
  
  // Cache fallback result too
  mealPlanCache.set(cacheKey, {
    data: fallbackResult,
    timestamp: Date.now()
  });

  return fallbackResult;
}

module.exports = {
  generateWeeklyMealPlan,
  calculateDailyCalories
};

