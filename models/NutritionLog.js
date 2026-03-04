const mongoose = require('mongoose');

const mealLogSchema = new mongoose.Schema({
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  servingSize: {
    type: String,
    default: '1 serving'
  },
  calories: {
    type: Number,
    default: 0
  },
  protein: {
    type: Number,
    default: 0
  },
  carbs: {
    type: Number,
    default: 0
  },
  fat: {
    type: Number,
    default: 0
  },
  fiber: {
    type: Number,
    default: 0
  },
  sugar: {
    type: Number,
    default: 0
  },
  sodium: {
    type: Number,
    default: 0
  },
  time: {
    type: Date,
    default: Date.now
  }
});

const exerciseLogSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  caloriesBurned: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    enum: ['cardio', 'strength', 'flexibility', 'other'],
    default: 'other'
  },
  time: {
    type: Date,
    default: Date.now
  }
});

const nutritionLogSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  dateString: {
    type: String,
    required: true,
    index: true
  },
  meals: [mealLogSchema],
  exercises: [exerciseLogSchema],
  dailyTotals: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: 0 },
    sodium: { type: Number, default: 0 }
  },
  caloriesBurned: {
    type: Number,
    default: 0
  },
  goals: {
    calories: { type: Number, default: 2000 },
    protein: { type: Number, default: 50 },
    carbs: { type: Number, default: 250 },
    fat: { type: Number, default: 65 },
    fiber: { type: Number, default: 25 }
  },
  biometrics: {
    weight: { type: Number },
    bodyFat: { type: Number },
    waist: { type: Number },
    notes: { type: String }
  },
  notes: {
    type: String,
    default: ''
  },
  water: {
    type: Number,
    default: 0
  },
  mood: {
    type: String,
    enum: ['great', 'good', 'okay', 'tired', 'stressed', ''],
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

nutritionLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Recalculate daily totals from meals
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  this.meals.forEach(meal => {
    totals.calories += meal.calories || 0;
    totals.protein += meal.protein || 0;
    totals.carbs += meal.carbs || 0;
    totals.fat += meal.fat || 0;
    totals.fiber += meal.fiber || 0;
    totals.sugar += meal.sugar || 0;
    totals.sodium += meal.sodium || 0;
  });
  this.dailyTotals = totals;
  
  // Recalculate calories burned from exercises
  let burned = 0;
  if (this.exercises) {
    this.exercises.forEach(ex => {
      burned += ex.caloriesBurned || 0;
    });
  }
  this.caloriesBurned = burned;
  
  next();
});

nutritionLogSchema.statics.getOrCreateForDate = async function(dateString) {
  let log = await this.findOne({ dateString });
  if (!log) {
    const date = new Date(dateString + 'T00:00:00');
    log = new this({
      date,
      dateString,
      meals: [],
      dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    });
    await log.save();
  }
  return log;
};

module.exports = mongoose.model('NutritionLog', nutritionLogSchema);
