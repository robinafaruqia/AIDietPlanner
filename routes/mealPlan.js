const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const MealPlan = require('../models/MealPlan');
const { generateWeeklyMealPlan } = require('../services/mealPlanner');

// Background function to save meal plan to database (non-blocking)
async function saveMealPlanToDatabase(weight, height, conditions, mealPlanData) {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not connected, skipping database save');
      return;
    }

    // Create or update user
    let user = await User.findOne({ 
      weight: parseFloat(weight),
      height: parseFloat(height),
      healthConditions: { $all: conditions }
    });

    if (!user) {
      user = new User({
        weight: parseFloat(weight),
        height: parseFloat(height),
        healthConditions: conditions
      });
      await user.save();
    }

    // Create meal plan
    if (mealPlanData) {
      const mealPlan = new MealPlan({
        userId: user._id,
        weight: parseFloat(weight),
        height: parseFloat(height),
        healthConditions: conditions,
        weeklyPlan: mealPlanData.weeklyPlan,
        groceryList: mealPlanData.groceryList,
        totalCalories: mealPlanData.totalCalories
      });

      await mealPlan.save();

      // Add meal plan to user
      user.mealPlans.push(mealPlan._id);
      await user.save();
      
      // console.log('✅ Meal plan saved to database:', mealPlan._id);
    }
  } catch (error) {
    // Log error but don't throw - this is background operation
    console.error('❌ Error saving meal plan to database (background):', error.message);
  }
}

// Generate meal plan
router.post('/generate', async (req, res) => {
  try {
    const { weight, height, healthConditions, includeGroceryList = true } = req.body;

    if (!weight || weight <= 0) {
      return res.status(400).json({ error: 'Valid weight is required' });
    }

    if (!height || height <= 0) {
      return res.status(400).json({ error: 'Valid height is required' });
    }

    const conditions = Array.isArray(healthConditions) 
      ? healthConditions 
      : (healthConditions ? [healthConditions] : []);

    const startTime = Date.now();
    
    // Generate meal plan (this is the main operation - AI call)
    // Pass includeGroceryList option
    const mealPlanData = await generateWeeklyMealPlan(
      parseFloat(weight), 
      parseFloat(height), 
      conditions,
      includeGroceryList
    );
    
    const generationTime = Date.now() - startTime;
    console.log(`⏱️  Meal plan generated in ${generationTime}ms`);

    // Prepare response data
    const responseData = {
      success: true,
      mealPlan: {
        id: 'temp-' + Date.now(), // Temporary ID, will be updated if saved
        weeklyPlan: mealPlanData.weeklyPlan,
        groceryList: mealPlanData.groceryList || [], // Empty array if not generated
        totalCalories: mealPlanData.totalCalories,
        healthConditions: conditions,
        weight: parseFloat(weight),
        height: parseFloat(height)
      }
    };

    // Send response immediately - user gets instant feedback!
    res.json(responseData);

    // Save to database in background (fire-and-forget)
    // This happens after response is sent, so user doesn't wait
    saveMealPlanToDatabase(parseFloat(weight), parseFloat(height), conditions, mealPlanData)
      .catch(err => {
        // Already handled in function, but log here too
        console.error('Background save failed:', err.message);
      });
  } catch (error) {
    console.error('❌ Error generating meal plan:', error);
    console.error('   Message:', error.message);
    console.error('   Code:', error.errorCode || 'N/A');
    console.error('   Stack:', error.stack);
    
    // Return user-friendly error message
    res.status(500).json({ 
      error: error.userMessage || 'Failed to generate meal plan',
      details: error.userDetails || error.message,
      code: error.errorCode || 'UNKNOWN_ERROR',
      // Help text based on error code
      help: getErrorHelp(error.errorCode)
    });
  }
});

// Helper function to provide actionable help based on error code
function getErrorHelp(errorCode) {
  const helpText = {
    'NO_API_KEY': 'Add GEMINI_API_KEY to your Vercel environment variables: Settings → Environment Variables → Add GEMINI_API_KEY',
    'NOT_INITIALIZED': 'Check that your GEMINI_API_KEY is valid. Get a new key from https://aistudio.google.com/app/apikey',
    'RATE_LIMIT': 'Wait 1 minute and try again. Consider upgrading your Google AI plan for higher limits.',
    'QUOTA_EXCEEDED': 'Your free quota is used up. Either wait for reset (usually daily) or upgrade at https://console.cloud.google.com',
    'MODEL_NOT_FOUND': 'The AI model may have been updated. Contact support or check for app updates.',
    'INVALID_RESPONSE': 'The AI returned an unexpected response. Try again - this is usually temporary.',
    'NETWORK_ERROR': 'Check your internet connection and try again.',
    'API_ERROR': 'An error occurred with the AI service. Please try again in a moment.'
  };
  
  return helpText[errorCode] || 'Please try again. If the problem persists, contact support.';
}

// Get meal plan by ID
router.get('/:id', async (req, res) => {
  try {
    const mealPlan = await MealPlan.findById(req.params.id);
    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    res.json({ success: true, mealPlan });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).json({ error: 'Failed to fetch meal plan' });
  }
});

// Get all meal plans
router.get('/', async (req, res) => {
  try {
    const mealPlans = await MealPlan.find().sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, mealPlans });
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    res.status(500).json({ error: 'Failed to fetch meal plans' });
  }
});

module.exports = router;

