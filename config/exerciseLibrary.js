const exerciseLibrary = {
  cardio: {
    name: 'Cardio',
    icon: 'bi-heart-pulse',
    exercises: [
      { id: 'running_8kmh', name: 'Running (8 km/h)', calPerMinPerKg: 0.14 },
      { id: 'running_10kmh', name: 'Running (10 km/h)', calPerMinPerKg: 0.17 },
      { id: 'walking_5kmh', name: 'Walking (5 km/h)', calPerMinPerKg: 0.06 },
      { id: 'cycling_moderate', name: 'Cycling (moderate)', calPerMinPerKg: 0.10 },
      { id: 'swimming', name: 'Swimming', calPerMinPerKg: 0.12 },
      { id: 'jump_rope', name: 'Jump Rope', calPerMinPerKg: 0.16 },
      { id: 'hiit', name: 'HIIT', calPerMinPerKg: 0.18 },
      { id: 'elliptical', name: 'Elliptical', calPerMinPerKg: 0.09 },
      { id: 'rowing', name: 'Rowing', calPerMinPerKg: 0.12 },
      { id: 'stair_climbing', name: 'Stair Climbing', calPerMinPerKg: 0.13 }
    ]
  },
  strength: {
    name: 'Strength',
    icon: 'bi-trophy',
    exercises: [
      { id: 'weight_training_moderate', name: 'Weight Training (moderate)', calPerMinPerKg: 0.05 },
      { id: 'weight_training_intense', name: 'Weight Training (intense)', calPerMinPerKg: 0.08 },
      { id: 'bodyweight_exercises', name: 'Bodyweight Exercises', calPerMinPerKg: 0.06 },
      { id: 'crossfit', name: 'CrossFit', calPerMinPerKg: 0.15 },
      { id: 'kettlebells', name: 'Kettlebells', calPerMinPerKg: 0.10 }
    ]
  },
  flexibility: {
    name: 'Flexibility/Low Impact',
    icon: 'bi-flower1',
    exercises: [
      { id: 'yoga', name: 'Yoga', calPerMinPerKg: 0.04 },
      { id: 'pilates', name: 'Pilates', calPerMinPerKg: 0.05 },
      { id: 'stretching', name: 'Stretching', calPerMinPerKg: 0.03 },
      { id: 'tai_chi', name: 'Tai Chi', calPerMinPerKg: 0.04 }
    ]
  },
  sports: {
    name: 'Sports',
    icon: 'bi-dribbble',
    exercises: [
      { id: 'basketball', name: 'Basketball', calPerMinPerKg: 0.11 },
      { id: 'soccer', name: 'Soccer', calPerMinPerKg: 0.12 },
      { id: 'tennis', name: 'Tennis', calPerMinPerKg: 0.10 },
      { id: 'badminton', name: 'Badminton', calPerMinPerKg: 0.08 },
      { id: 'volleyball', name: 'Volleyball', calPerMinPerKg: 0.06 }
    ]
  },
  daily: {
    name: 'Daily Activities',
    icon: 'bi-house',
    exercises: [
      { id: 'housework', name: 'Housework', calPerMinPerKg: 0.04 },
      { id: 'gardening', name: 'Gardening', calPerMinPerKg: 0.06 },
      { id: 'walking_dog', name: 'Walking Dog', calPerMinPerKg: 0.05 }
    ]
  }
};

function getAllExercises() {
  return exerciseLibrary;
}

function getExerciseById(exerciseId) {
  for (const category of Object.values(exerciseLibrary)) {
    const exercise = category.exercises.find(e => e.id === exerciseId);
    if (exercise) {
      return {
        ...exercise,
        category: category.name
      };
    }
  }
  return null;
}

function calculateCalories(exerciseId, durationMinutes, weightKg) {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) {
    return null;
  }
  
  const duration = Math.max(0, parseFloat(durationMinutes) || 0);
  const weight = Math.max(0, parseFloat(weightKg) || 70);
  
  const calories = Math.round(exercise.calPerMinPerKg * duration * weight);
  
  return {
    exercise: exercise.name,
    category: exercise.category,
    durationMinutes: duration,
    weightKg: weight,
    caloriesBurned: calories,
    calPerMinPerKg: exercise.calPerMinPerKg
  };
}

function searchExercises(query) {
  const results = [];
  const searchTerm = query.toLowerCase().trim();
  
  if (!searchTerm) {
    return results;
  }
  
  for (const [categoryKey, category] of Object.entries(exerciseLibrary)) {
    for (const exercise of category.exercises) {
      if (exercise.name.toLowerCase().includes(searchTerm)) {
        results.push({
          ...exercise,
          category: category.name,
          categoryKey
        });
      }
    }
  }
  
  return results;
}

function getExercisesByCategory(categoryKey) {
  const category = exerciseLibrary[categoryKey];
  if (!category) {
    return null;
  }
  
  return {
    name: category.name,
    icon: category.icon,
    exercises: category.exercises
  };
}

module.exports = {
  exerciseLibrary,
  getAllExercises,
  getExerciseById,
  calculateCalories,
  searchExercises,
  getExercisesByCategory
};
