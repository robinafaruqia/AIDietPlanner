const { GoogleGenAI } = require('@google/genai');
const { getGuidelinesForCondition } = require('../config/healthConditions');

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
    // Pass API key to GoogleGenAI
    ai = new GoogleGenAI({ apiKey });
    console.log('✅ Gemini AI initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini:', error.message);
    return false;
  }
}

// Initialize on module load (synchronous now)
isInitialized = initializeGemini();

function createMealPlanPrompt(weight, height, healthConditions, dailyCalories) {
  const conditionsList = healthConditions && healthConditions.length > 0 ? healthConditions : [];
  const conditionNames = conditionsList.length > 0 ? conditionsList.join(', ') : 'none';
  const guidelines = conditionsList.map(c => getGuidelinesForCondition(c)).join(' ')
    || getGuidelinesForCondition(null);
  
  // Calculate BMI for context
  const heightInMeters = height / 100;
  const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);

  return `You are a professional nutritionist. Generate a detailed weekly meal plan (7 days) in JSON format.

User Profile:
- Weight: ${weight} kg
- Height: ${height} cm (${(height / 2.54).toFixed(1)} inches)
- BMI: ${bmi}
- Health Condition(s): ${conditionNames}
- Target Daily Calories: ${dailyCalories} kcal
- Dietary Guidelines: ${guidelines}

Requirements:
1. Generate meals for all 7 days (Monday through Sunday)
2. Each day must have: breakfast, lunch, dinner, and snacks (1-2 snacks per day)
3. Each meal must include:
   - name: Meal name (string)
   - ingredients: Array of ingredient names (strings)
   - calories: Number (integer)
   - protein: Number in grams (integer)
   - carbs: Number in grams (integer)
   - fat: Number in grams (integer)
   - fiber: Number in grams (integer, optional)

4. Ensure daily totals are approximately ${dailyCalories} calories
5. Follow the dietary guidelines for the health condition
6. Provide variety across the week
7. Use common, accessible ingredients

8. Generate a consolidated grocery list with all unique ingredients categorized

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

async function generateMealPlanWithAI(weight, height, healthConditions, dailyCalories) {
  // Check API key first
  if (!process.env.GEMINI_API_KEY) {
    throw createUserFriendlyError('NO_API_KEY');
  }

  // Check initialization
  if (!isInitialized || !ai) {
    throw createUserFriendlyError('NOT_INITIALIZED');
  }

  const maxRetries = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = createMealPlanPrompt(weight, height, healthConditions, dailyCalories);
      
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      console.log(`🤖 Calling Gemini API (attempt ${attempt}/${maxRetries})...`);
      console.log(`   Model: ${modelName}`);
      console.log(`   User: ${weight}kg, ${height}cm, condition: ${healthConditions?.[0] || 'none'}`);
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      
      console.log('✅ Gemini API responded');
      
      // Get text from response
      const text = typeof response.text === 'function' ? response.text() : response.text;
      
      if (!text) {
        throw createUserFriendlyError('INVALID_RESPONSE', 'AI returned empty response');
      }

      console.log(`📝 Response length: ${text.length} characters`);

      // Clean the response - remove markdown code blocks if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON
      let mealPlanData;
      try {
        mealPlanData = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError.message);
        console.error('   Raw response (first 500 chars):', jsonText.substring(0, 500));
        throw createUserFriendlyError('INVALID_RESPONSE', 'AI response was not valid JSON. Please try again.');
      }

      // Validate structure
      if (!mealPlanData.weeklyPlan) {
        throw createUserFriendlyError('INVALID_RESPONSE', 'AI response missing weeklyPlan structure');
      }

      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const missingDays = days.filter(day => !mealPlanData.weeklyPlan[day]);
      
      if (missingDays.length > 0) {
        throw createUserFriendlyError('INVALID_RESPONSE', `AI response missing days: ${missingDays.join(', ')}`);
      }

      const invalidDays = days.filter(day => {
        const d = mealPlanData.weeklyPlan[day];
        return !d?.breakfast || !d?.lunch || !d?.dinner || !Array.isArray(d?.snacks);
      });

      if (invalidDays.length > 0) {
        throw createUserFriendlyError('INVALID_RESPONSE', `AI response has incomplete meals for: ${invalidDays.join(', ')}`);
      }

      // Validate and normalize grocery list
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

      console.log('✅ Meal plan validated successfully');
      console.log(`📝 Grocery list: ${groceryList.length} items`);
      
      return {
        weeklyPlan: mealPlanData.weeklyPlan,
        groceryList: groceryList
      };

    } catch (error) {
      lastError = error;
      
      // If it's already a user-friendly error, log and maybe rethrow
      if (error.errorCode) {
        console.error(`❌ Error (${error.errorCode}): ${error.userMessage}`);
        console.error(`   Details: ${error.userDetails}`);
      } else {
        console.error(`❌ Error (attempt ${attempt}/${maxRetries}):`, error.message);
      }
      
      // Classify the error
      const errorType = error.errorCode || classifyError(error);
      
      // Don't retry for certain errors
      if (['NO_API_KEY', 'QUOTA_EXCEEDED', 'NOT_INITIALIZED'].includes(errorType)) {
        throw error.errorCode ? error : createUserFriendlyError(errorType, error.message);
      }
      
      // Rate limit - don't retry immediately
      if (errorType === 'RATE_LIMIT') {
        throw createUserFriendlyError('RATE_LIMIT');
      }
      
      // Last attempt - throw with user-friendly message
      if (attempt === maxRetries) {
        throw error.errorCode ? error : createUserFriendlyError(errorType, error.message);
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting ${attempt}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw lastError || createUserFriendlyError('API_ERROR', 'Failed after multiple retries');
}

module.exports = {
  generateMealPlanWithAI,
  isInitialized: () => isInitialized,
  // For debugging
  getStatus: () => ({
    initialized: isInitialized,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    aiReady: !!ai
  })
};

