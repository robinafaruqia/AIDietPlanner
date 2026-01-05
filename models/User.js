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

module.exports = mongoose.model('User', userSchema);

