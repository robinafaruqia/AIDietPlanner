// const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');


// Initialize Gemini AI
// let genAI = null;
let model = null;
let ai = null;

async function initializeGemini() {

   ai = new GoogleGenAI({});


  const apiKey =process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_AI_API_KEY not found. AI meal generation will be disabled.');
    return false;
  }

    // genAI = new GoogleGenerativeAI(apiKey);
  
    // Use gemini-1.5-flash (valid model name, without -latest suffix)
    // Alternative: gemini-pro or gemini-2.5-pro
    // model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    return true;
  
}

// Initialize on module load
const isInitialized =  initializeGemini();

function getHealthConditionGuidelines(condition) {
  const guidelines = {
    'gallstones': 'Low-fat diet. Avoid high-fat foods, fried foods, and fatty meats. Focus on lean proteins, whole grains, fruits, and vegetables.',
    'diabetes': 'Diabetic-friendly diet. Low glycemic index foods, controlled carbohydrates, high fiber. Avoid added sugars and refined carbs.',
    'high blood pressure': 'Heart-healthy, low-sodium diet. Focus on fruits, vegetables, whole grains, lean proteins. Limit sodium and processed foods.',
    'heart disease': 'Heart-healthy diet. Low saturated fat, high fiber, omega-3 rich foods. Focus on fruits, vegetables, whole grains, lean proteins.',
    'obesity': 'High-protein, calorie-controlled diet. Focus on lean proteins, vegetables, whole grains. Moderate portions with balanced macronutrients.',
    'default': 'Balanced, nutritious diet with variety of whole foods, lean proteins, fruits, vegetables, and whole grains.'
  };

  return guidelines[condition?.toLowerCase()] || guidelines['default'];
}

function createMealPlanPrompt(weight, height, healthConditions, dailyCalories) {
  const condition = healthConditions && healthConditions.length > 0 ? healthConditions[0] : 'none';
  const guidelines = getHealthConditionGuidelines(condition);
  
  // Calculate BMI for context
  const heightInMeters = height / 100;
  const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);

  return `You are a professional nutritionist. Generate a detailed weekly meal plan (7 days) in JSON format.

User Profile:
- Weight: ${weight} kg
- Height: ${height} cm (${(height / 2.54).toFixed(1)} inches)
- BMI: ${bmi}
- Health Condition: ${condition}
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
  }
}`;
}

async function generateMealPlanWithAI(weight, height, healthConditions, dailyCalories) {
  if (!isInitialized) {
    throw new Error('Gemini AI not initialized. Check GOOGLE_AI_API_KEY.');
  }

  const maxRetries = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = createMealPlanPrompt(weight, height, healthConditions, dailyCalories);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      // console.log(response.text);
      // const result = await model.generateContent(prompt);
      // const response = await result.response;
      const text = response.text;

      // Clean the response - remove markdown code blocks if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON
      const mealPlanData = JSON.parse(jsonText);

      // Validate structure
      if (!mealPlanData.weeklyPlan) {
        throw new Error('Invalid response structure: missing weeklyPlan');
      }

      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const isValid = days.every(day => 
        mealPlanData.weeklyPlan[day]?.breakfast && 
        mealPlanData.weeklyPlan[day]?.lunch && 
        mealPlanData.weeklyPlan[day]?.dinner && 
        mealPlanData.weeklyPlan[day]?.snacks
      );

      if (!isValid) {
        throw new Error('Invalid meal plan structure: one or more days are missing required meals');
      }
      // for (const day of days) {
      //   if (!mealPlanData.weeklyPlan[day]) {
      //     throw new Error(`Missing day: ${day}`);
      //   }
      //   const dayPlan = mealPlanData.weeklyPlan[day];
      //   if (!dayPlan.breakfast || !dayPlan.lunch || !dayPlan.dinner || !dayPlan.snacks) {
      //     throw new Error(`Invalid structure for ${day}: missing required meals`);
      //   }
      // }

      return mealPlanData.weeklyPlan;
    } catch (error) {
      lastError = error;
      console.error(`Error generating meal plan with AI (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // If it's a rate limit or quota error, don't retry
      if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
        console.error('Rate limit/quota exceeded. Will fallback to hardcoded meals.');
        throw error;
      }
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        if (error.message.includes('JSON')) {
          console.error('Failed to parse AI response as JSON after retries');
        }
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  // Should never reach here, but just in case
  throw lastError || new Error('Failed to generate meal plan after retries');
}

module.exports = {
  generateMealPlanWithAI,
  isInitialized: () => isInitialized
};

