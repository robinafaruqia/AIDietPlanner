const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const {
  getAllExercises,
  getExerciseById,
  calculateCalories,
  searchExercises
} = require('../config/exerciseLibrary');

router.use(optionalAuth);

router.get('/', (req, res) => {
  try {
    const exercises = getAllExercises();
    res.json({ success: true, exercises });
  } catch (error) {
    console.error('Error fetching exercise library:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exercise library' });
  }
});

router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, results: [] });
    }
    
    const results = searchExercises(q);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error searching exercises:', error);
    res.status(500).json({ success: false, error: 'Failed to search exercises' });
  }
});

router.get('/calculate', (req, res) => {
  try {
    const { exerciseId, duration, weight } = req.query;
    
    if (!exerciseId) {
      return res.status(400).json({ success: false, error: 'Exercise ID is required' });
    }
    
    const durationMinutes = parseFloat(duration) || 30;
    
    let weightKg = parseFloat(weight);
    if (!weightKg && req.user && req.user.currentWeight) {
      weightKg = req.user.currentWeight;
    }
    if (!weightKg) {
      weightKg = 70;
    }
    
    const result = calculateCalories(exerciseId, durationMinutes, weightKg);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Exercise not found' });
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error calculating calories:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate calories' });
  }
});

router.get('/:exerciseId', (req, res) => {
  try {
    const exercise = getExerciseById(req.params.exerciseId);
    
    if (!exercise) {
      return res.status(404).json({ success: false, error: 'Exercise not found' });
    }
    
    res.json({ success: true, exercise });
  } catch (error) {
    console.error('Error fetching exercise:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exercise' });
  }
});

module.exports = router;
