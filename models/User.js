const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  weight: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  healthConditions: [{
    type: String,
    required: true
  }],
  mealPlans: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MealPlan'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add compound index for user lookup
userSchema.index({ weight: 1, height: 1 });

module.exports = mongoose.model('User', userSchema);

