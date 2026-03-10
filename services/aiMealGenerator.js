const { GoogleGenAI } = require('@google/genai');
const { getGuidelinesForCondition } = require('../config/healthConditions');

// Ordered fallback list: preferred model first, then progressively safer picks.
// The env var GEMINI_MODEL (if set and not already in the list) is prepended at runtime.
const DEFAULT_MODEL_CHAIN = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
];

function buildModelChain() {
  const preferred = process.env.GEMINI_MODEL;
  if (preferred && !DEFAULT_MODEL_CHAIN.includes(preferred)) {
    return [preferred, ...DEFAULT_MODEL_CHAIN];
  }
  if (preferred) {
    // Move the preferred model to the front
    return [preferred, ...DEFAULT_MODEL_CHAIN.filter(m => m !== preferred)];
  }
  return [...DEFAULT_MODEL_CHAIN];
}

// Track models that recently failed with 503 so we skip them on the next request
// Map<modelName, timestampWhenFailed> — entries expire after 5 minutes
const unavailableModels = new Map();
const UNAVAILABLE_TTL_MS = 5 * 60 * 1000;

function markModelUnavailable(model) {
  unavailableModels.set(model, Date.now());
}

function getAvailableModelChain() {
  const now = Date.now();
  const chain = buildModelChain();
  const available = chain.filter(m => {
    const failedAt = unavailableModels.get(m);
    if (!failedAt) return true;
    if (now - failedAt > UNAVAILABLE_TTL_MS) {
      unavailableModels.delete(m);
      return true;
    }
    return false;
  });
  // Never return an empty list — fall back to the full chain if everything was marked
  return available.length > 0 ? available : chain;
}

// Initialize Gemini AI
let ai = null;
let isInitialized = false;

function initializeGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY not found. AI meal generation will be disabled.');
    return false;
  }

  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('✅ Gemini AI initialized successfully');
    console.log(`   Model fallback chain: ${buildModelChain().join(' → ')}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini:', error.message);
    return false;
  }
}

// Initialize on module load
isInitialized = initializeGemini();

function createSingleDayPrompt(weight, height, healthConditions, dailyCalories, dayName, dietPreference = 'non-vegetarian') {
  const conditionsList = healthConditions && healthConditions.length > 0 ? healthConditions : [];
  const conditionNames = conditionsList.length > 0 ? conditionsList.join(', ') : 'none';
  const guidelines = conditionsList.map(c => getGuidelinesForCondition(c)).join(' ')
    || getGuidelinesForCondition(null);

  const isVeg = dietPreference === 'vegetarian';
  const dietLabel = isVeg ? 'Vegetarian' : 'Non-Vegetarian';
  const dietRule = isVeg
    ? 'ALL meals MUST be vegetarian. No meat, poultry, fish, or seafood.'
    : 'Meals can include both vegetarian and non-vegetarian options.';

  return `Generate meals for ${dayName} only. Return JSON with breakfast, lunch, dinner, and snacks.

User: ${weight}kg, ${height}cm, Conditions: ${conditionNames}, Target: ${dailyCalories} kcal/day, Diet: ${dietLabel}
Guidelines: ${guidelines}
Diet Rule: ${dietRule}

Return ONLY valid JSON (no markdown):
{
  "breakfast": {"name": "...", "ingredients": ["..."], "calories": 300, "protein": 20, "carbs": 40, "fat": 10, "fiber": 5},
  "lunch": {"name": "...", "ingredients": ["..."], "calories": 500, "protein": 30, "carbs": 50, "fat": 15, "fiber": 8},
  "dinner": {"name": "...", "ingredients": ["..."], "calories": 500, "protein": 30, "carbs": 50, "fat": 15, "fiber": 8},
  "snacks": [{"name": "...", "ingredients": ["..."], "calories": 150, "protein": 5, "carbs": 20, "fat": 5, "fiber": 3}]
}`;
}

function createSwapMealPrompt(weight, height, healthConditions, mealType, currentMealName, dailyCalories, dietPreference = 'non-vegetarian') {
  const conditionsList = healthConditions && healthConditions.length > 0 ? healthConditions : [];
  const conditionNames = conditionsList.length > 0 ? conditionsList.join(', ') : 'none';
  const guidelines = conditionsList.map(c => getGuidelinesForCondition(c)).join(' ')
    || getGuidelinesForCondition(null);

  const isVeg = dietPreference === 'vegetarian';
  const dietLabel = isVeg ? 'Vegetarian' : 'Non-Vegetarian';
  const dietRule = isVeg
    ? 'The meal MUST be vegetarian. No meat, poultry, fish, or seafood.'
    : 'The meal can be vegetarian or non-vegetarian.';

  const calorieTargets = {
    breakfast: Math.round(dailyCalories * 0.25),
    lunch: Math.round(dailyCalories * 0.35),
    dinner: Math.round(dailyCalories * 0.30),
    snack: Math.round(dailyCalories * 0.10)
  };
  const targetCals = calorieTargets[mealType] || 400;

  return `Generate ONE alternative ${mealType} meal to replace "${currentMealName}".

User: ${weight}kg, ${height}cm, Conditions: ${conditionNames}, Diet: ${dietLabel}
Target calories for this ${mealType}: ~${targetCals} kcal
Guidelines: ${guidelines}
Diet Rule: ${dietRule}

Provide a DIFFERENT meal with similar nutritional value but different ingredients/cuisine.

Return ONLY valid JSON (no markdown):
{"name": "...", "ingredients": ["..."], "calories": ${targetCals}, "protein": 20, "carbs": 40, "fat": 10, "fiber": 5}`;
}

function createMealPlanPrompt(weight, height, healthConditions, dailyCalories, dietPreference = 'non-vegetarian') {
  const conditionsList = healthConditions && healthConditions.length > 0 ? healthConditions : [];
  const conditionNames = conditionsList.length > 0 ? conditionsList.join(', ') : 'none';
  const guidelines = conditionsList.map(c => getGuidelinesForCondition(c)).join(' ')
    || getGuidelinesForCondition(null);
  
  const heightInMeters = height / 100;
  const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);

  const isVeg = dietPreference === 'vegetarian';
  const dietLabel = isVeg ? 'Vegetarian (no meat, poultry, or fish)' : 'Non-Vegetarian';
  const dietRule = isVeg
    ? 'ALL meals and snacks MUST be 100% vegetarian. Do NOT include any meat, poultry, fish, or seafood. Use plant-based proteins (lentils, beans, chickpeas, tofu, paneer, nuts, seeds, dairy, eggs) instead.'
    : 'Meals can include both vegetarian and non-vegetarian options.';

  return `You are a professional nutritionist. Generate a detailed weekly meal plan (7 days) in JSON format.

User Profile:
- Weight: ${weight} kg
- Height: ${height} cm (${(height / 2.54).toFixed(1)} inches)
- BMI: ${bmi}
- Health Condition(s): ${conditionNames}
- Target Daily Calories: ${dailyCalories} kcal
- Diet Preference: ${dietLabel}
- Dietary Guidelines: ${guidelines}

Requirements:
1. Generate meals for all 7 days (Monday through Sunday)
2. Each day must have: breakfast, lunch, dinner, and snacks (1-2 snacks per day)
3. IMPORTANT DIET RULE: ${dietRule}
4. Each meal must include:
   - name: Meal name (string)
   - ingredients: Array of ingredient names (strings)
   - calories: Number (integer)
   - protein: Number in grams (integer)
   - carbs: Number in grams (integer)
   - fat: Number in grams (integer)
   - fiber: Number in grams (integer, optional)

5. Ensure daily totals are approximately ${dailyCalories} calories
6. Follow the dietary guidelines for the health condition
7. Provide variety across the week
8. Use common, accessible ingredients

9. Generate a consolidated grocery list with all unique ingredients categorized

Return ONLY valid JSON in this exact format (no markdown, no code blocks, just JSON):
{
  "weeklyPlan": {
    "monday": {
      "breakfast": {
        "name": "Meal name",
        "ingredients": ["ingredient1", "ingredient2"],
        "calories": 300,
        "protein": 20,
        "carbs": 40,
        "fat": 10,
        "fiber": 5
      },
      "lunch": { ... },
      "dinner": { ... },
      "snacks": [
        {
          "name": "Snack name",
          "ingredients": ["ingredient1"],
          "calories": 150,
          "protein": 5,
          "carbs": 20,
          "fat": 5,
          "fiber": 3
        }
      ]
    },
    "tuesday": { ... },
    "wednesday": { ... },
    "thursday": { ... },
    "friday": { ... },
    "saturday": { ... },
    "sunday": { ... }
  },
  "groceryList": [
    { "item": "Chicken breast", "quantity": "1.5 lbs", "category": "Protein" },
    { "item": "Spinach", "quantity": "2 bunches", "category": "Produce" },
    { "item": "Brown rice", "quantity": "1 lb", "category": "Grains" }
  ]
}`;
}

// Helper to create user-friendly error messages
function createUserFriendlyError(errorType, details = '') {
  const errors = {
    'NO_API_KEY': {
      message: 'AI service not configured',
      details: 'The GEMINI_API_KEY environment variable is not set. Please add it to your Vercel environment variables.',
      code: 'NO_API_KEY'
    },
    'NOT_INITIALIZED': {
      message: 'AI service failed to initialize',
      details: 'The Gemini AI client could not be initialized. Check your API key is valid.',
      code: 'NOT_INITIALIZED'
    },
    'API_ERROR': {
      message: 'AI service request failed',
      details: details || 'The request to Google Gemini API failed.',
      code: 'API_ERROR'
    },
    'RATE_LIMIT': {
      message: 'AI service rate limit exceeded',
      details: 'Too many requests. Please wait a moment and try again.',
      code: 'RATE_LIMIT'
    },
    'QUOTA_EXCEEDED': {
      message: 'AI service quota exceeded',
      details: 'The API quota has been exceeded. Check your Google Cloud billing or wait for quota reset.',
      code: 'QUOTA_EXCEEDED'
    },
    'INVALID_RESPONSE': {
      message: 'AI returned invalid response',
      details: details || 'The AI response could not be parsed. Please try again.',
      code: 'INVALID_RESPONSE'
    },
    'MODEL_NOT_FOUND': {
      message: 'AI model not available',
      details: 'The requested model is not available. This may be a temporary issue.',
      code: 'MODEL_NOT_FOUND'
    },
    'NETWORK_ERROR': {
      message: 'Network error',
      details: 'Could not connect to AI service. Check your internet connection.',
      code: 'NETWORK_ERROR'
    }
  };

  const errorInfo = errors[errorType] || {
    message: 'Unknown error',
    details: details || 'An unexpected error occurred.',
    code: 'UNKNOWN'
  };

  const error = new Error(errorInfo.message);
  error.userMessage = errorInfo.message;
  error.userDetails = errorInfo.details;
  error.errorCode = errorInfo.code;
  return error;
}

// Classify error type from error message
function classifyError(error) {
  const msg = error.message?.toLowerCase() || '';
  
  if (msg.includes('api key') || msg.includes('apikey') || msg.includes('unauthorized') || msg.includes('401')) {
    return 'NO_API_KEY';
  }
  if (msg.includes('quota') || msg.includes('billing')) {
    return 'QUOTA_EXCEEDED';
  }
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
    return 'RATE_LIMIT';
  }
  if (msg.includes('not found') || msg.includes('404') || msg.includes('model')) {
    return 'MODEL_NOT_FOUND';
  }
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout') || msg.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  if (msg.includes('json') || msg.includes('parse') || msg.includes('syntax')) {
    return 'INVALID_RESPONSE';
  }
  return 'API_ERROR';
}

// Returns true when the error indicates the *model* is unavailable / overloaded
// but our API key and quota are fine — so a different model might succeed.
function isModelUnavailableError(error) {
  const msg = (error.message || '').toLowerCase();
  const code = error.status || error.code || error.httpCode;
  if (code === 503 || code === '503') return true;
  if (msg.includes('unavailable') || msg.includes('high demand') || msg.includes('overloaded')) return true;
  if (msg.includes('not found') && msg.includes('model')) return true;
  if (code === 404 || code === '404') return true;
  return false;
}

async function callModelWithRetry(modelName, prompt, retries = 1) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   🔄 ${modelName} (attempt ${attempt}/${retries})...`);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const text = typeof response.text === 'function' ? response.text() : response.text;
      if (!text) throw new Error('Empty response from model');
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`   ⚠️ ${modelName} attempt ${attempt} failed: ${err.message?.substring(0, 120)}`);

      if (isModelUnavailableError(err)) {
        markModelUnavailable(modelName);
        throw err; // break out to try next model
      }

      // For non-model errors (parse, quota, auth) don't retry with same model
      const errorType = classifyError(err);
      if (['NO_API_KEY', 'QUOTA_EXCEEDED'].includes(errorType)) throw err;
      if (errorType === 'RATE_LIMIT') {
        // Brief pause then retry on same model once
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        throw err;
      }

      // Generic/transient error — wait and retry on same model
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

async function generateMealPlanWithAI(weight, height, healthConditions, dailyCalories, dietPreference = 'non-vegetarian') {
  if (!process.env.GEMINI_API_KEY) {
    throw createUserFriendlyError('NO_API_KEY');
  }
  if (!isInitialized || !ai) {
    throw createUserFriendlyError('NOT_INITIALIZED');
  }

  const prompt = createMealPlanPrompt(weight, height, healthConditions, dailyCalories, dietPreference);
  const modelChain = getAvailableModelChain();

  console.log(`🤖 Generating meal plan — will try up to ${modelChain.length} models`);
  console.log(`   User: ${weight}kg, ${height}cm, condition: ${healthConditions?.[0] || 'none'}`);
  console.log(`   Models: ${modelChain.join(' → ')}`);

  let lastError;

  for (const modelName of modelChain) {
    try {
      const text = await callModelWithRetry(modelName, prompt);

      console.log(`✅ ${modelName} responded (${text.length} chars)`);

      // Clean markdown fences
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let mealPlanData;
      try {
        mealPlanData = JSON.parse(jsonText);
      } catch (parseError) {
        console.error(`❌ JSON parse error from ${modelName}:`, parseError.message);
        console.error('   Raw (first 500 chars):', jsonText.substring(0, 500));
        // Bad JSON from this model — try the next one
        lastError = createUserFriendlyError('INVALID_RESPONSE', 'AI response was not valid JSON. Trying next model...');
        continue;
      }

      // Validate structure
      if (!mealPlanData.weeklyPlan) {
        lastError = createUserFriendlyError('INVALID_RESPONSE', 'AI response missing weeklyPlan structure');
        continue;
      }

      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const missingDays = days.filter(day => !mealPlanData.weeklyPlan[day]);
      if (missingDays.length > 0) {
        lastError = createUserFriendlyError('INVALID_RESPONSE', `AI response missing days: ${missingDays.join(', ')}`);
        continue;
      }

      const invalidDays = days.filter(day => {
        const d = mealPlanData.weeklyPlan[day];
        return !d?.breakfast || !d?.lunch || !d?.dinner || !Array.isArray(d?.snacks);
      });
      if (invalidDays.length > 0) {
        lastError = createUserFriendlyError('INVALID_RESPONSE', `Incomplete meals for: ${invalidDays.join(', ')}`);
        continue;
      }

      let groceryList = [];
      if (Array.isArray(mealPlanData.groceryList)) {
        groceryList = mealPlanData.groceryList
          .filter(item => item && item.item)
          .map(item => ({
            item: String(item.item || '').trim(),
            quantity: String(item.quantity || '1 unit').trim(),
            category: String(item.category || 'Other').trim()
          }));
      }

      console.log(`✅ Meal plan validated (model: ${modelName})`);
      console.log(`📝 Grocery list: ${groceryList.length} items`);

      return {
        weeklyPlan: mealPlanData.weeklyPlan,
        groceryList
      };

    } catch (error) {
      lastError = error;

      if (error.errorCode) {
        console.error(`❌ ${modelName}: ${error.errorCode} — ${error.userDetails || error.message}`);
      } else {
        console.error(`❌ ${modelName}: ${error.message?.substring(0, 200)}`);
      }

      const errorType = error.errorCode || classifyError(error);

      // Fatal errors — no point trying another model
      if (['NO_API_KEY', 'QUOTA_EXCEEDED', 'NOT_INITIALIZED'].includes(errorType)) {
        throw error.errorCode ? error : createUserFriendlyError(errorType, error.message);
      }

      // Model-specific failure — continue to next model
      console.log(`   ↪ Skipping ${modelName}, trying next model...`);
    }
  }

  // All models exhausted
  console.error('❌ All models in the fallback chain failed');
  throw lastError || createUserFriendlyError('API_ERROR', 'All AI models are currently unavailable. Please try again in a few minutes.');
}

async function regenerateSingleDay(weight, height, healthConditions, dailyCalories, dayName, dietPreference = 'non-vegetarian') {
  if (!process.env.GEMINI_API_KEY) {
    throw createUserFriendlyError('NO_API_KEY');
  }
  if (!isInitialized || !ai) {
    throw createUserFriendlyError('NOT_INITIALIZED');
  }

  const prompt = createSingleDayPrompt(weight, height, healthConditions, dailyCalories, dayName, dietPreference);
  const modelChain = getAvailableModelChain();

  console.log(`🔄 Regenerating ${dayName} — trying up to ${modelChain.length} models`);

  let lastError;

  for (const modelName of modelChain) {
    try {
      const text = await callModelWithRetry(modelName, prompt);
      console.log(`✅ ${modelName} responded for day regen (${text.length} chars)`);

      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let dayData;
      try {
        dayData = JSON.parse(jsonText);
      } catch (parseError) {
        console.error(`❌ JSON parse error from ${modelName}:`, parseError.message);
        lastError = createUserFriendlyError('INVALID_RESPONSE', 'AI response was not valid JSON.');
        continue;
      }

      if (!dayData.breakfast || !dayData.lunch || !dayData.dinner || !Array.isArray(dayData.snacks)) {
        lastError = createUserFriendlyError('INVALID_RESPONSE', 'Missing required meal fields');
        continue;
      }

      console.log(`✅ Day "${dayName}" regenerated successfully`);
      return dayData;

    } catch (error) {
      lastError = error;
      const errorType = error.errorCode || classifyError(error);
      if (['NO_API_KEY', 'QUOTA_EXCEEDED', 'NOT_INITIALIZED'].includes(errorType)) {
        throw error.errorCode ? error : createUserFriendlyError(errorType, error.message);
      }
      console.log(`   ↪ Skipping ${modelName}, trying next model...`);
    }
  }

  throw lastError || createUserFriendlyError('API_ERROR', 'All AI models are currently unavailable.');
}

async function swapMeal(weight, height, healthConditions, mealType, currentMealName, dailyCalories, dietPreference = 'non-vegetarian') {
  if (!process.env.GEMINI_API_KEY) {
    throw createUserFriendlyError('NO_API_KEY');
  }
  if (!isInitialized || !ai) {
    throw createUserFriendlyError('NOT_INITIALIZED');
  }

  const prompt = createSwapMealPrompt(weight, height, healthConditions, mealType, currentMealName, dailyCalories, dietPreference);
  const modelChain = getAvailableModelChain();

  console.log(`🔄 Swapping ${mealType} "${currentMealName}" — trying up to ${modelChain.length} models`);

  let lastError;

  for (const modelName of modelChain) {
    try {
      const text = await callModelWithRetry(modelName, prompt);
      console.log(`✅ ${modelName} responded for meal swap (${text.length} chars)`);

      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let mealData;
      try {
        mealData = JSON.parse(jsonText);
      } catch (parseError) {
        console.error(`❌ JSON parse error from ${modelName}:`, parseError.message);
        lastError = createUserFriendlyError('INVALID_RESPONSE', 'AI response was not valid JSON.');
        continue;
      }

      if (!mealData.name || !Array.isArray(mealData.ingredients)) {
        lastError = createUserFriendlyError('INVALID_RESPONSE', 'Missing required meal fields');
        continue;
      }

      console.log(`✅ Meal swap successful: "${mealData.name}"`);
      return mealData;

    } catch (error) {
      lastError = error;
      const errorType = error.errorCode || classifyError(error);
      if (['NO_API_KEY', 'QUOTA_EXCEEDED', 'NOT_INITIALIZED'].includes(errorType)) {
        throw error.errorCode ? error : createUserFriendlyError(errorType, error.message);
      }
      console.log(`   ↪ Skipping ${modelName}, trying next model...`);
    }
  }

  throw lastError || createUserFriendlyError('API_ERROR', 'All AI models are currently unavailable.');
}

module.exports = {
  generateMealPlanWithAI,
  regenerateSingleDay,
  swapMeal,
  isInitialized: () => isInitialized,
  getStatus: () => ({
    initialized: isInitialized,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    aiReady: !!ai
  })
};

