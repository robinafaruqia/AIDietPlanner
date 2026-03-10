const mongoose = require('mongoose');

const favoriteMealSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    required: true
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
  ingredients: [{
    type: String,
    trim: true
  }],
  servingSize: {
    type: String,
    default: '1 serving'
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

favoriteMealSchema.index({ userId: 1, name: 1 });
favoriteMealSchema.index({ userId: 1, mealType: 1 });

favoriteMealSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

favoriteMealSchema.statics.findByUserAndType = function(userId, mealType) {
  return this.find({ userId, mealType }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('FavoriteMeal', favoriteMealSchema);
