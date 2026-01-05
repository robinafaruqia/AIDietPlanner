const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  name: String,
  ingredients: [String],
  calories: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
  fiber: Number
});

const dayMealPlanSchema = new mongoose.Schema({
  breakfast: mealSchema,
  lunch: mealSchema,
  dinner: mealSchema,
  snacks: [mealSchema]
});

const mealPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  weight: Number,
  height: Number,
  healthConditions: [String],
  weeklyPlan: {
    monday: dayMealPlanSchema,
    tuesday: dayMealPlanSchema,
    wednesday: dayMealPlanSchema,
    thursday: dayMealPlanSchema,
    friday: dayMealPlanSchema,
    saturday: dayMealPlanSchema,
    sunday: dayMealPlanSchema
  },
  groceryList: [{
    item: String,
    quantity: String,
    category: String
  }],
  totalCalories: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MealPlan', mealPlanSchema);

