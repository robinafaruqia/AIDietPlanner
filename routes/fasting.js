const express = require('express');
const router = express.Router();
const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');
const userRepository = require('../repositories/userRepository');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { isDatabaseConnected } = require('../config/database');

function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUserId(req) {
  return req.user ? userRepository.getId(req.user) : null;
}

function buildQuery(userId, extra = {}) {
  if (userId) {
    return { userId, ...extra };
  }
  return { userId: { $exists: false }, ...extra };
}

function parseTimeString(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function getScheduleDefaults(scheduleType) {
  const schedules = {
    '16:8': { eatingWindowStart: '12:00', eatingWindowEnd: '20:00', fastingHours: 16 },
    '18:6': { eatingWindowStart: '12:00', eatingWindowEnd: '18:00', fastingHours: 18 },
    '20:4': { eatingWindowStart: '14:00', eatingWindowEnd: '18:00', fastingHours: 20 },
    'custom': { eatingWindowStart: '12:00', eatingWindowEnd: '20:00', fastingHours: 16 }
  };
  return schedules[scheduleType] || schedules['16:8'];
}

function getFastingStatus(fastingSchedule, timezone = 'UTC') {
  if (!fastingSchedule || !fastingSchedule.eatingWindowStart || !fastingSchedule.eatingWindowEnd) {
    return { inFastingWindow: false, inEatingWindow: true, timeRemaining: 0 };
  }

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  const startTime = parseTimeString(fastingSchedule.eatingWindowStart);
  const endTime = parseTimeString(fastingSchedule.eatingWindowEnd);
  const startMinutes = startTime.hours * 60 + startTime.minutes;
  const endMinutes = endTime.hours * 60 + endTime.minutes;

  let inEatingWindow;
  let timeRemaining;

  if (startMinutes <= endMinutes) {
    inEatingWindow = currentTimeInMinutes >= startMinutes && currentTimeInMinutes < endMinutes;
  } else {
    inEatingWindow = currentTimeInMinutes >= startMinutes || currentTimeInMinutes < endMinutes;
  }

  const inFastingWindow = !inEatingWindow;

  if (inEatingWindow) {
    if (currentTimeInMinutes < endMinutes) {
      timeRemaining = endMinutes - currentTimeInMinutes;
    } else {
      timeRemaining = (24 * 60 - currentTimeInMinutes) + endMinutes;
    }
  } else {
    if (currentTimeInMinutes < startMinutes) {
      timeRemaining = startMinutes - currentTimeInMinutes;
    } else {
      timeRemaining = (24 * 60 - currentTimeInMinutes) + startMinutes;
    }
  }

  const totalFastingMinutes = 24 * 60 - (endMinutes - startMinutes + (endMinutes < startMinutes ? 24 * 60 : 0));
  const totalEatingMinutes = 24 * 60 - totalFastingMinutes;
  
  let progress;
  if (inFastingWindow) {
    const elapsedFasting = totalFastingMinutes - timeRemaining;
    progress = Math.min(100, (elapsedFasting / totalFastingMinutes) * 100);
  } else {
    const elapsedEating = totalEatingMinutes - timeRemaining;
    progress = Math.min(100, (elapsedEating / totalEatingMinutes) * 100);
  }

  return {
    inFastingWindow,
    inEatingWindow,
    timeRemaining,
    timeRemainingFormatted: formatMinutes(timeRemaining),
    progress: Math.round(progress),
    eatingWindowStart: fastingSchedule.eatingWindowStart,
    eatingWindowEnd: fastingSchedule.eatingWindowEnd
  };
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

router.use(optionalAuth);

router.get('/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    let fastingEnabled = false;
    let fastingSchedule = getScheduleDefaults('16:8');
    let activeFast = null;

    if (userId && isDatabaseConnected()) {
      const user = await User.findById(userId);
      if (user) {
        fastingEnabled = user.fastingEnabled || false;
        if (user.fastingSchedule && user.fastingSchedule.eatingWindowStart) {
          fastingSchedule = {
            type: user.fastingSchedule.type || '16:8',
            eatingWindowStart: user.fastingSchedule.eatingWindowStart,
            eatingWindowEnd: user.fastingSchedule.eatingWindowEnd
          };
        }
      }

      const dateString = getDateString();
      const log = await NutritionLog.findOne(buildQuery(userId, { dateString }));
      if (log && log.fastingLog && log.fastingLog.startedAt && !log.fastingLog.endedAt) {
        const startedAt = new Date(log.fastingLog.startedAt);
        const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000 / 60);
        activeFast = {
          startedAt: log.fastingLog.startedAt,
          elapsedMinutes: elapsed,
          elapsedFormatted: formatMinutes(elapsed),
          targetDuration: log.fastingLog.targetDuration
        };
      }
    }

    const status = getFastingStatus(fastingSchedule);

    res.json({
      success: true,
      fastingEnabled,
      fastingSchedule,
      activeFast,
      ...status
    });
  } catch (error) {
    console.error('Error getting fasting status:', error);
    res.status(500).json({ error: 'Failed to get fasting status' });
  }
});

router.post('/start', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { notes } = req.body;

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const scheduleType = user.fastingSchedule?.type || '16:8';
    const defaults = getScheduleDefaults(scheduleType);
    const targetDuration = defaults.fastingHours * 60;

    const dateString = getDateString();
    const log = await NutritionLog.getOrCreateForDate(userId, dateString);

    if (log.fastingLog && log.fastingLog.startedAt && !log.fastingLog.endedAt) {
      return res.status(400).json({ error: 'A fast is already in progress' });
    }

    log.fastingLog = {
      startedAt: new Date(),
      targetDuration,
      notes: notes || ''
    };

    await log.save();

    res.json({
      success: true,
      message: 'Fast started successfully',
      fastingLog: log.fastingLog
    });
  } catch (error) {
    console.error('Error starting fast:', error);
    res.status(500).json({ error: 'Failed to start fast' });
  }
});

router.post('/end', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { notes } = req.body;

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const dateString = getDateString();
    const log = await NutritionLog.findOne(buildQuery(userId, { dateString }));

    if (!log || !log.fastingLog || !log.fastingLog.startedAt) {
      return res.status(400).json({ error: 'No active fast found' });
    }

    if (log.fastingLog.endedAt) {
      return res.status(400).json({ error: 'Fast has already ended' });
    }

    const endedAt = new Date();
    const startedAt = new Date(log.fastingLog.startedAt);
    const actualDuration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000 / 60);
    const targetDuration = log.fastingLog.targetDuration || 960;
    const completed = actualDuration >= targetDuration;

    log.fastingLog.endedAt = endedAt;
    log.fastingLog.actualDuration = actualDuration;
    log.fastingLog.completed = completed;
    if (notes) {
      log.fastingLog.notes = notes;
    }

    await log.save();

    res.json({
      success: true,
      message: completed ? 'Congratulations! Fast completed successfully!' : 'Fast ended',
      fastingLog: log.fastingLog,
      completed,
      actualDurationFormatted: formatMinutes(actualDuration)
    });
  } catch (error) {
    console.error('Error ending fast:', error);
    res.status(500).json({ error: 'Failed to end fast' });
  }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { fastingEnabled, scheduleType, eatingWindowStart, eatingWindowEnd } = req.body;

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (typeof fastingEnabled === 'boolean') {
      user.fastingEnabled = fastingEnabled;
    }

    const validScheduleTypes = ['16:8', '18:6', '20:4', 'custom'];
    if (scheduleType && validScheduleTypes.includes(scheduleType)) {
      const defaults = getScheduleDefaults(scheduleType);
      user.fastingSchedule = {
        type: scheduleType,
        eatingWindowStart: scheduleType === 'custom' && eatingWindowStart ? eatingWindowStart : defaults.eatingWindowStart,
        eatingWindowEnd: scheduleType === 'custom' && eatingWindowEnd ? eatingWindowEnd : defaults.eatingWindowEnd
      };
    } else if (eatingWindowStart || eatingWindowEnd) {
      if (!user.fastingSchedule) {
        user.fastingSchedule = getScheduleDefaults('custom');
        user.fastingSchedule.type = 'custom';
      }
      if (eatingWindowStart) user.fastingSchedule.eatingWindowStart = eatingWindowStart;
      if (eatingWindowEnd) user.fastingSchedule.eatingWindowEnd = eatingWindowEnd;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Fasting settings updated',
      fastingEnabled: user.fastingEnabled,
      fastingSchedule: user.fastingSchedule
    });
  } catch (error) {
    console.error('Error updating fasting settings:', error);
    res.status(500).json({ error: 'Failed to update fasting settings' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userId = getUserId(req);
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 30);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!isDatabaseConnected()) {
      return res.json({ success: true, history: [], stats: { totalFasts: 0, completedFasts: 0, completionRate: 0 } });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await NutritionLog.findByRange(userId, startDate, endDate, false);
    const fastingLogs = logs.filter((log) => !!log.fastingLog?.startedAt);
    fastingLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    const history = fastingLogs.map(log => ({
      date: log.dateString,
      startedAt: log.fastingLog.startedAt,
      endedAt: log.fastingLog.endedAt,
      completed: log.fastingLog.completed,
      actualDuration: log.fastingLog.actualDuration,
      actualDurationFormatted: log.fastingLog.actualDuration ? formatMinutes(log.fastingLog.actualDuration) : null,
      targetDuration: log.fastingLog.targetDuration,
      notes: log.fastingLog.notes
    }));

    const totalFasts = history.length;
    const completedFasts = history.filter(h => h.completed).length;
    const completionRate = totalFasts > 0 ? Math.round((completedFasts / totalFasts) * 100) : 0;

    let currentStreak = 0;
    for (let i = 0; i < history.length; i++) {
      if (history[i].completed) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({
      success: true,
      history,
      stats: {
        totalFasts,
        completedFasts,
        completionRate,
        currentStreak
      }
    });
  } catch (error) {
    console.error('Error getting fasting history:', error);
    res.status(500).json({ error: 'Failed to get fasting history' });
  }
});

module.exports = router;
