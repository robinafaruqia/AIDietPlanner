const express = require('express');
const router = express.Router();
const { apiAuth } = require('../middleware/auth');

router.post('/log', apiAuth, async (req, res) => {
  try {
    const { weight, note, date } = req.body;
    const user = req.user;

    if (!weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0) {
      return res.status(400).json({ error: 'Valid weight is required' });
    }

    const weightValue = parseFloat(weight);
    const entryDate = date ? new Date(date) : new Date();

    user.weightHistory.push({
      weight: weightValue,
      date: entryDate,
      note: note || ''
    });

    user.currentWeight = weightValue;

    if (!user.startWeight) {
      user.startWeight = weightValue;
      user.startDate = entryDate;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Weight logged successfully',
      entry: user.weightHistory[user.weightHistory.length - 1],
      progress: user.getWeightProgress()
    });
  } catch (error) {
    console.error('Error logging weight:', error);
    res.status(500).json({ error: 'Failed to log weight' });
  }
});

router.get('/history', apiAuth, async (req, res) => {
  try {
    const user = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 100, 365);
    
    const history = user.weightHistory
      .slice(-limit)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      history,
      count: user.weightHistory.length
    });
  } catch (error) {
    console.error('Error fetching weight history:', error);
    res.status(500).json({ error: 'Failed to fetch weight history' });
  }
});

router.get('/stats', apiAuth, async (req, res) => {
  try {
    const user = req.user;
    const progress = user.getWeightProgress();

    if (!progress) {
      return res.json({
        success: true,
        stats: null,
        message: 'No weight data yet'
      });
    }

    const history = user.weightHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let weeklyChange = null;
    let monthlyChange = null;
    
    if (history.length >= 2) {
      const now = new Date();
      const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const weekOldEntry = history.find(e => new Date(e.date) >= oneWeekAgo);
      const monthOldEntry = history.find(e => new Date(e.date) >= oneMonthAgo);

      if (weekOldEntry) {
        weeklyChange = Math.round((user.currentWeight - weekOldEntry.weight) * 10) / 10;
      }
      if (monthOldEntry) {
        monthlyChange = Math.round((user.currentWeight - monthOldEntry.weight) * 10) / 10;
      }
    }

    const lowestWeight = history.length > 0 
      ? Math.min(...history.map(e => e.weight))
      : null;
    const highestWeight = history.length > 0
      ? Math.max(...history.map(e => e.weight))
      : null;

    res.json({
      success: true,
      stats: {
        ...progress,
        weeklyChange,
        monthlyChange,
        lowestWeight,
        highestWeight,
        totalEntries: history.length
      }
    });
  } catch (error) {
    console.error('Error fetching weight stats:', error);
    res.status(500).json({ error: 'Failed to fetch weight stats' });
  }
});

router.put('/goal', apiAuth, async (req, res) => {
  try {
    const { targetWeight } = req.body;
    const user = req.user;

    if (targetWeight !== undefined && targetWeight !== null && targetWeight !== '') {
      const target = parseFloat(targetWeight);
      if (isNaN(target) || target <= 0) {
        return res.status(400).json({ error: 'Invalid target weight' });
      }
      user.targetWeight = target;
    } else {
      user.targetWeight = undefined;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Goal updated',
      targetWeight: user.targetWeight,
      progress: user.getWeightProgress()
    });
  } catch (error) {
    console.error('Error updating weight goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

router.delete('/entry/:entryId', apiAuth, async (req, res) => {
  try {
    const { entryId } = req.params;
    const user = req.user;

    const entryIndex = user.weightHistory.findIndex(
      e => e._id.toString() === entryId
    );

    if (entryIndex === -1) {
      return res.status(404).json({ error: 'Weight entry not found' });
    }

    user.weightHistory.splice(entryIndex, 1);

    if (user.weightHistory.length > 0) {
      const sortedHistory = [...user.weightHistory].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      user.currentWeight = sortedHistory[0].weight;
    } else {
      user.currentWeight = undefined;
      user.startWeight = undefined;
      user.startDate = undefined;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Entry deleted',
      progress: user.getWeightProgress()
    });
  } catch (error) {
    console.error('Error deleting weight entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

router.put('/entry/:entryId', apiAuth, async (req, res) => {
  try {
    const { entryId } = req.params;
    const { weight, note, date } = req.body;
    const user = req.user;

    const entry = user.weightHistory.id(entryId);

    if (!entry) {
      return res.status(404).json({ error: 'Weight entry not found' });
    }

    if (weight !== undefined) {
      const weightValue = parseFloat(weight);
      if (isNaN(weightValue) || weightValue <= 0) {
        return res.status(400).json({ error: 'Invalid weight' });
      }
      entry.weight = weightValue;
    }

    if (note !== undefined) {
      entry.note = note;
    }

    if (date !== undefined) {
      entry.date = new Date(date);
    }

    const sortedHistory = [...user.weightHistory].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    user.currentWeight = sortedHistory[0].weight;

    await user.save();

    res.json({
      success: true,
      message: 'Entry updated',
      entry,
      progress: user.getWeightProgress()
    });
  } catch (error) {
    console.error('Error updating weight entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

module.exports = router;
