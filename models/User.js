const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const weightEntrySchema = new mongoose.Schema({
  weight: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  }
});

const achievementSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  profileImage: {
    type: String
  },
  height: {
    type: Number
  },
  healthConditions: [{
    type: String
  }],
  startWeight: {
    type: Number
  },
  currentWeight: {
    type: Number
  },
  targetWeight: {
    type: Number
  },
  weightHistory: [weightEntrySchema],
  startDate: {
    type: Date
  },
  mealPlans: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MealPlan'
  }],
  achievements: {
    type: [achievementSchema],
    default: []
  },
  mealPlansGenerated: {
    type: Number,
    default: 0
  },
  fastingEnabled: {
    type: Boolean,
    default: false
  },
  fastingSchedule: {
    type: {
      type: String,
      enum: ['16:8', '18:6', '20:4', 'custom'],
      default: '16:8'
    },
    eatingWindowStart: {
      type: String,
      default: '12:00'
    },
    eatingWindowEnd: {
      type: String,
      default: '20:00'
    }
  },
  // Biometric Connections
  biometricConnections: {
    googleFit: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      refreshToken: String,
      tokenExpiry: Date,
      connectedAt: Date,
      lastSync: Date
    },
    fitbit: {
      connected: { type: Boolean, default: false },
      accessToken: String,
      refreshToken: String,
      tokenExpiry: Date,
      connectedAt: Date,
      lastSync: Date
    }
  },
  // Biometric Data
  biometricData: {
    steps: { type: Map, of: Number },
    heartRate: { type: Map, of: Object },
    weight: { type: Map, of: Number },
    sleep: { type: Map, of: Number },
    calories: { type: Map, of: Number },
    lastSync: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
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

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.setPassword = async function(password) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(password, salt);
};

userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    provider: this.provider,
    profileImage: this.profileImage,
    height: this.height,
    healthConditions: this.healthConditions,
    startWeight: this.startWeight,
    currentWeight: this.currentWeight,
    targetWeight: this.targetWeight,
    startDate: this.startDate,
    createdAt: this.createdAt,
    fastingEnabled: this.fastingEnabled,
    fastingSchedule: this.fastingSchedule
  };
};

userSchema.methods.addWeightEntry = async function(weight, note = '') {
  const entry = { weight, date: new Date(), note };
  this.weightHistory.push(entry);
  this.currentWeight = weight;
  
  if (!this.startWeight) {
    this.startWeight = weight;
    this.startDate = new Date();
  }
  
  await this.save();
  return entry;
};

userSchema.methods.getWeightProgress = function() {
  if (!this.startWeight || !this.currentWeight) {
    return null;
  }
  
  const lost = this.startWeight - this.currentWeight;
  const toGo = this.targetWeight ? this.currentWeight - this.targetWeight : null;
  const percentToGoal = this.targetWeight && this.startWeight !== this.targetWeight
    ? ((this.startWeight - this.currentWeight) / (this.startWeight - this.targetWeight)) * 100
    : null;
  
  return {
    startWeight: this.startWeight,
    currentWeight: this.currentWeight,
    targetWeight: this.targetWeight,
    lost: Math.round(lost * 10) / 10,
    toGo: toGo ? Math.round(toGo * 10) / 10 : null,
    percentToGoal: percentToGoal ? Math.round(percentToGoal) : null,
    startDate: this.startDate,
    daysOnPlan: this.startDate ? Math.floor((Date.now() - this.startDate) / (1000 * 60 * 60 * 24)) : 0
  };
};

userSchema.methods.hasAchievement = function(achievementId) {
  return this.achievements.some(a => a.id === achievementId);
};

userSchema.methods.unlockAchievement = async function(achievementId) {
  if (this.hasAchievement(achievementId)) {
    return null;
  }
  
  const achievement = {
    id: achievementId,
    unlockedAt: new Date()
  };
  
  this.achievements.push(achievement);
  await this.save();
  return achievement;
};

userSchema.methods.getUnlockedAchievementIds = function() {
  return this.achievements.map(a => a.id);
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ googleId });
};

module.exports = mongoose.model('User', userSchema);
