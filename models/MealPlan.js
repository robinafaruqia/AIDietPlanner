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

// Add indexes for better query performance
mealPlanSchema.index({ userId: 1, createdAt: -1 });
mealPlanSchema.index({ createdAt: -1 });
// Index for caching lookups (weight + height + healthConditions)
mealPlanSchema.index({ weight: 1, height: 1, healthConditions: 1, createdAt: -1 });

mealPlanSchema.statics.findCached = async function(weight, height, healthConditions, userId = null, maxAgeDays = 7) {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - maxAgeDays);
  
  const sortedConditions = [...healthConditions].sort();
  
  const query = {
    weight: weight,
    height: height,
    healthConditions: { $size: sortedConditions.length, $all: sortedConditions },
    createdAt: { $gte: minDate }
  };
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.findOne(query).sort({ createdAt: -1 });
};

module.exports = mongoose.model('MealPlan', mealPlanSchema);

