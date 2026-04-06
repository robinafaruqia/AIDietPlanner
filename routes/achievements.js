const express = require('express');
const router = express.Router();
const { apiAuth, optionalAuth } = require('../middleware/auth');
const { getAllAchievements, getAchievement, getCategories } = require('../config/achievements');
const NutritionLog = require('../models/NutritionLog');
const User = require('../models/User');
const userRepository = require('../repositories/userRepository');
const { isDatabaseConnected } = require('../config/database');

function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

router.get('/', optionalAuth, (req, res) => {
  try {
    const allAchievements = getAllAchievements();
    const categories = getCategories();
    const userAchievements = req.user?.achievements || [];
    const unlockedIds = userAchievements.map(a => a.id);

    const achievementsWithStatus = allAchievements.map(achievement => {
      const userAchievement = userAchievements.find(a => a.id === achievement.id);
      return {
        ...achievement,
        unlocked: unlockedIds.includes(achievement.id),
        unlockedAt: userAchievement?.unlockedAt || null
      };
    });

    const stats = {
      total: allAchievements.length,
      unlocked: unlockedIds.length,
      percentage: Math.round((unlockedIds.length / allAchievements.length) * 100)
    };

    res.json({
      success: true,
      achievements: achievementsWithStatus,
      categories,
      stats
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

router.post('/check', apiAuth, async (req, res) => {
  try {
    const user = req.user;
    const { context } = req.body;
    const newlyUnlocked = [];

    if (!isDatabaseConnected()) {
      return res.json({ success: true, newlyUnlocked: [], message: 'Database not connected' });
    }

    if (context === 'meal_logged' || context === 'all') {
      const unlocked = await checkLoggingAchievements(user);
      newlyUnlocked.push(...unlocked);
    }

    if (context === 'weight_logged' || context === 'all') {
      const unlocked = await checkWeightAchievements(user);
      newlyUnlocked.push(...unlocked);
    }

    if (context === 'meal_plan_generated' || context === 'all') {
      const unlocked = await checkMealPlanAchievements(user);
      newlyUnlocked.push(...unlocked);
    }

    const achievementsWithDetails = newlyUnlocked.map(id => ({
      ...getAchievement(id),
      unlockedAt: new Date()
    }));

    res.json({
      success: true,
      newlyUnlocked: achievementsWithDetails
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

async function checkLoggingAchievements(user) {
  const unlocked = [];
  const uid = userRepository.getId(user);
  if (!uid) return unlocked;

  const totalMeals = await NutritionLog.aggregate([
    { $match: { userId: uid } },
    { $unwind: '$meals' },
    { $count: 'total' }
  ]);

  if (totalMeals.length > 0 && totalMeals[0].total >= 1) {
    if (!user.hasAchievement('first_log')) {
      await user.unlockAchievement('first_log');
      unlocked.push('first_log');
    }
  }

  const streak = await calculateLoggingStreak(uid);

  if (streak >= 7 && !user.hasAchievement('week_warrior')) {
    await user.unlockAchievement('week_warrior');
    unlocked.push('week_warrior');
  }

  if (streak >= 30 && !user.hasAchievement('month_master')) {
    await user.unlockAchievement('month_master');
    unlocked.push('month_master');
  }

  const earlyBreakfast = await checkEarlyBirdAchievement(uid);
  if (earlyBreakfast && !user.hasAchievement('early_bird')) {
    await user.unlockAchievement('early_bird');
    unlocked.push('early_bird');
  }

  const nutritionAchievements = await checkNutritionAchievements(user);
  unlocked.push(...nutritionAchievements);

  return unlocked;
}

async function calculateLoggingStreak(userId) {
  const today = new Date();
  let streak = 0;
  let checkDate = new Date(today);

  while (true) {
    const dateString = getDateString(checkDate);
    const log = await NutritionLog.findOne({
      userId,
      dateString,
      'meals.0': { $exists: true }
    });

    if (!log) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);

    if (streak > 365) break;
  }

  return streak;
}

async function checkEarlyBirdAchievement(userId) {
  const earlyLog = await NutritionLog.findOne({
    userId,
    meals: {
      $elemMatch: {
        mealType: 'breakfast',
        time: {
          $exists: true
        }
      }
    }
  });

  if (!earlyLog) return false;

  for (const meal of earlyLog.meals) {
    if (meal.mealType === 'breakfast' && meal.time) {
      const mealTime = new Date(meal.time);
      if (mealTime.getHours() < 8) {
        return true;
      }
    }
  }

  return false;
}

async function checkNutritionAchievements(user) {
  const unlocked = [];
  const uid = userRepository.getId(user);
  if (!uid) return unlocked;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const allLogs = await NutritionLog.find({
    userId: uid,
    date: { $gte: sevenDaysAgo },
    'meals.0': { $exists: true }
  });
  const logs = allLogs.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);

  if (logs.length >= 7) {
    const allProteinMet = logs.every(log => {
      const protein = log.dailyTotals?.protein || 0;
      const goal = log.goals?.protein || 50;
      return protein >= goal;
    });

    if (allProteinMet && !user.hasAchievement('protein_pro')) {
      await user.unlockAchievement('protein_pro');
      unlocked.push('protein_pro');
    }

    const allCaloriesMet = logs.every(log => {
      const calories = log.dailyTotals?.calories || 0;
      const goal = log.goals?.calories || 2000;
      const tolerance = goal * 0.1;
      return calories <= goal + tolerance && calories >= goal * 0.5;
    });

    if (allCaloriesMet && !user.hasAchievement('calorie_counter')) {
      await user.unlockAchievement('calorie_counter');
      unlocked.push('calorie_counter');
    }
  }

  return unlocked;
}

async function checkWeightAchievements(user) {
  const unlocked = [];

  if (user.weightHistory && user.weightHistory.length >= 1) {
    if (!user.hasAchievement('first_weigh_in')) {
      await user.unlockAchievement('first_weigh_in');
      unlocked.push('first_weigh_in');
    }
  }

  if (user.startWeight && user.currentWeight) {
    const weightLost = user.startWeight - user.currentWeight;

    if (weightLost >= 1 && !user.hasAchievement('lost_1kg')) {
      await user.unlockAchievement('lost_1kg');
      unlocked.push('lost_1kg');
    }

    if (weightLost >= 5 && !user.hasAchievement('lost_5kg')) {
      await user.unlockAchievement('lost_5kg');
      unlocked.push('lost_5kg');
    }

    if (weightLost >= 10 && !user.hasAchievement('lost_10kg')) {
      await user.unlockAchievement('lost_10kg');
      unlocked.push('lost_10kg');
    }
  }

  if (user.targetWeight && user.currentWeight && user.currentWeight <= user.targetWeight) {
    if (!user.hasAchievement('goal_reached')) {
      await user.unlockAchievement('goal_reached');
      unlocked.push('goal_reached');
    }
  }

  return unlocked;
}

async function checkMealPlanAchievements(user) {
  const unlocked = [];

  if (user.mealPlansGenerated >= 5 && !user.hasAchievement('meal_planner')) {
    await user.unlockAchievement('meal_planner');
    unlocked.push('meal_planner');
  }

  return unlocked;
}

async function checkAndUnlockAchievements(userId, context) {
  try {
    if (!isDatabaseConnected()) {
      return [];
    }

    const uid = userRepository.normalizeUserId(userId);
    if (!uid) return [];

    const user = await User.findById(uid);
    if (!user) return [];

    let unlocked = [];

    if (context === 'meal_logged') {
      unlocked = await checkLoggingAchievements(user);
    } else if (context === 'weight_logged') {
      unlocked = await checkWeightAchievements(user);
    } else if (context === 'meal_plan_generated') {
      unlocked = await checkMealPlanAchievements(user);
    }

    return unlocked.map(id => getAchievement(id));
  } catch (error) {
    console.error('Error in checkAndUnlockAchievements:', error);
    return [];
  }
}

module.exports = router;
module.exports.checkAndUnlockAchievements = checkAndUnlockAchievements;
