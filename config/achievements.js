const achievements = {
  first_log: {
    id: 'first_log',
    name: 'First Log',
    description: 'Log your first meal',
    icon: 'bi-journal-plus',
    category: 'logging',
    color: '#22c55e'
  },
  week_warrior: {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Log meals for 7 consecutive days',
    icon: 'bi-calendar-week',
    category: 'logging',
    color: '#3b82f6'
  },
  month_master: {
    id: 'month_master',
    name: 'Month Master',
    description: 'Log meals for 30 consecutive days',
    icon: 'bi-calendar-check',
    category: 'logging',
    color: '#8b5cf6'
  },
  first_weigh_in: {
    id: 'first_weigh_in',
    name: 'First Weigh-In',
    description: 'Log your first weight',
    icon: 'bi-speedometer',
    category: 'weight',
    color: '#06b6d4'
  },
  lost_1kg: {
    id: 'lost_1kg',
    name: 'Getting Started',
    description: 'Lose 1 kg',
    icon: 'bi-arrow-down-circle',
    category: 'weight',
    color: '#10b981'
  },
  lost_5kg: {
    id: 'lost_5kg',
    name: 'Making Progress',
    description: 'Lose 5 kg',
    icon: 'bi-graph-down-arrow',
    category: 'weight',
    color: '#14b8a6'
  },
  lost_10kg: {
    id: 'lost_10kg',
    name: 'Transformation',
    description: 'Lose 10 kg',
    icon: 'bi-trophy',
    category: 'weight',
    color: '#f59e0b'
  },
  goal_reached: {
    id: 'goal_reached',
    name: 'Goal Crusher',
    description: 'Reach your target weight',
    icon: 'bi-bullseye',
    category: 'weight',
    color: '#ec4899'
  },
  protein_pro: {
    id: 'protein_pro',
    name: 'Protein Pro',
    description: 'Hit protein goal 7 days in a row',
    icon: 'bi-egg-fried',
    category: 'nutrition',
    color: '#ef4444'
  },
  calorie_counter: {
    id: 'calorie_counter',
    name: 'Calorie Counter',
    description: 'Stay within calorie goal for 7 days',
    icon: 'bi-fire',
    category: 'nutrition',
    color: '#f97316'
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Log breakfast before 8 AM',
    icon: 'bi-sunrise',
    category: 'misc',
    color: '#fbbf24'
  },
  meal_planner: {
    id: 'meal_planner',
    name: 'Meal Planner',
    description: 'Generate 5 meal plans',
    icon: 'bi-card-checklist',
    category: 'misc',
    color: '#a855f7'
  }
};

const categories = {
  logging: { name: 'Logging', icon: 'bi-journal-text' },
  weight: { name: 'Weight', icon: 'bi-speedometer2' },
  nutrition: { name: 'Nutrition', icon: 'bi-heart-pulse' },
  misc: { name: 'Miscellaneous', icon: 'bi-star' }
};

function getAchievement(id) {
  return achievements[id] || null;
}

function getAllAchievements() {
  return Object.values(achievements);
}

function getAchievementsByCategory(category) {
  return Object.values(achievements).filter(a => a.category === category);
}

function getCategories() {
  return categories;
}

module.exports = {
  achievements,
  categories,
  getAchievement,
  getAllAchievements,
  getAchievementsByCategory,
  getCategories
};
