const express = require('express');
const router = express.Router();
const User = require('../models/User');
const userRepository = require('../repositories/userRepository');
const { apiAuth } = require('../middleware/auth');
const { appleHealthTokenAuth } = require('../middleware/appleHealthTokenAuth');
const {
  generateSyncToken,
  hashToken,
  samplesToBiometricPatch,
  mergeBiometricData,
  applyWeightFromAppleHealth,
  getGoalsForAppleHealth,
  applyNutritionSamplesFromHealth,
  bumpGoalsVersion,
  DEFAULT_STEPS_GOAL
} = require('../services/appleHealthService');

// —— Mobile API (Bearer sync token) ——

router.get('/config', appleHealthTokenAuth, async (req, res) => {
  try {
    const config = await getGoalsForAppleHealth(req.user);
    res.json({
      success: true,
      userId: userRepository.getId(req.user),
      serverTime: new Date().toISOString(),
      ...config
    });
  } catch (error) {
    console.error('Apple Health config error:', error);
    res.status(500).json({ success: false, error: 'Failed to load sync config' });
  }
});

router.post('/sync', appleHealthTokenAuth, async (req, res) => {
  try {
    const { samples, deviceInfo, clientSyncAt } = req.body || {};
    if (!Array.isArray(samples)) {
      return res.status(400).json({ success: false, error: 'samples array is required' });
    }

    const applePatch = samplesToBiometricPatch(samples);
    const currentData = req.user.biometricData || {};
    const mergedData = mergeBiometricData(currentData, applePatch);

    const nutritionSamples = samples.filter((s) =>
      ['dietaryEnergy', 'dietaryProtein', 'dietaryCarbs', 'dietaryFat', 'dietaryFiber', 'water'].includes(s?.type)
    );
    if (nutritionSamples.length > 0) {
      await applyNutritionSamplesFromHealth(req.user, nutritionSamples);
    }

    await applyWeightFromAppleHealth(req.user, applePatch.weight);

    const connections = {
      ...(req.user.biometricConnections || {}),
      appleHealth: {
        ...(req.user.biometricConnections?.appleHealth || {}),
        connected: true,
        lastSync: new Date().toISOString(),
        lastClientSyncAt: clientSyncAt || new Date().toISOString(),
        deviceInfo: deviceInfo || req.user.biometricConnections?.appleHealth?.deviceInfo
      }
    };

    await User.findByIdAndUpdate(userRepository.getId(req.user), {
      biometricData: mergedData,
      biometricConnections: connections
    });

    const goals = await getGoalsForAppleHealth(req.user);

    res.json({
      success: true,
      message: 'Apple Health data synced',
      recordsApplied: samples.length,
      data: mergedData,
      goals: goals.goals,
      goalsVersion: goals.goalsVersion,
      syncPreferences: goals.syncPreferences
    });
  } catch (error) {
    console.error('Apple Health sync error:', error);
    res.status(500).json({ success: false, error: 'Failed to sync Apple Health data' });
  }
});

router.post('/goals/ack', appleHealthTokenAuth, async (req, res) => {
  try {
    const { goalsVersion, writtenToHealth } = req.body || {};
    await User.findByIdAndUpdate(userRepository.getId(req.user), {
      biometricConnections: {
        ...(req.user.biometricConnections || {}),
        appleHealth: {
          ...(req.user.biometricConnections?.appleHealth || {}),
          lastGoalsWrittenAt: new Date().toISOString(),
          lastGoalsVersionAck: goalsVersion || null,
          lastGoalsWrittenToHealth: !!writtenToHealth
        }
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Apple Health goals ack error:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge goals' });
  }
});

// —— Web session API ——

router.post('/connect', apiAuth, async (req, res) => {
  try {
    const { regenerate } = req.body || {};
    const existing = req.user.biometricConnections?.appleHealth;

    if (existing?.connected && existing?.tokenHint && !regenerate) {
      return res.json({
        success: true,
        alreadyConnected: true,
        tokenHint: existing.tokenHint,
        connectedAt: existing.connectedAt,
        message: 'Already connected. Use regenerate:true to create a new sync token.'
      });
    }

    const { token, tokenHash } = generateSyncToken();
    const tokenHint = `${token.slice(0, 6)}…${token.slice(-4)}`;

    await User.findByIdAndUpdate(req.session.userId, {
      biometricConnections: {
        ...(req.user.biometricConnections || {}),
        appleHealth: {
          connected: true,
          tokenHash,
          tokenHint,
          connectedAt: new Date().toISOString(),
          lastSync: existing?.lastSync || null,
          preferences: {
            stepsGoal: existing?.preferences?.stepsGoal ?? DEFAULT_STEPS_GOAL,
            writeGoalsToHealth: existing?.preferences?.writeGoalsToHealth !== false,
            readNutritionFromHealth: !!existing?.preferences?.readNutritionFromHealth
          },
          goalsVersion: new Date().toISOString()
        }
      }
    });

    res.json({
      success: true,
      syncToken: token,
      tokenHint,
      iosAppPath: 'mobile/ios/AIDietPlannerHealthSync',
      message: 'Copy this token into the iOS Health Sync app. It is shown only once.'
    });
  } catch (error) {
    console.error('Apple Health connect error:', error);
    res.status(500).json({ success: false, error: 'Failed to connect Apple Health' });
  }
});

router.post('/disconnect', apiAuth, async (req, res) => {
  try {
    const apple = req.user.biometricConnections?.appleHealth || {};
    await User.findByIdAndUpdate(req.session.userId, {
      biometricConnections: {
        ...(req.user.biometricConnections || {}),
        appleHealth: {
          connected: false,
          tokenHash: null,
          tokenHint: apple.tokenHint,
          disconnectedAt: new Date().toISOString(),
          preferences: apple.preferences || {}
        }
      }
    });
    res.json({ success: true, message: 'Apple Health disconnected' });
  } catch (error) {
    console.error('Apple Health disconnect error:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

router.put('/preferences', apiAuth, async (req, res) => {
  try {
    const { stepsGoal, writeGoalsToHealth, readNutritionFromHealth, activeEnergyGoal } = req.body || {};
    const apple = req.user.biometricConnections?.appleHealth || {};

    const preferences = {
      stepsGoal: stepsGoal != null ? parseInt(stepsGoal, 10) : (apple.preferences?.stepsGoal ?? DEFAULT_STEPS_GOAL),
      writeGoalsToHealth: writeGoalsToHealth !== undefined ? !!writeGoalsToHealth : apple.preferences?.writeGoalsToHealth !== false,
      readNutritionFromHealth: readNutritionFromHealth !== undefined ? !!readNutritionFromHealth : !!apple.preferences?.readNutritionFromHealth,
      activeEnergyGoal: activeEnergyGoal != null ? parseInt(activeEnergyGoal, 10) : apple.preferences?.activeEnergyGoal
    };

    const biometricConnections = bumpGoalsVersion(req.user);
    biometricConnections.appleHealth = {
      ...apple,
      connected: !!apple.connected,
      preferences
    };

    await User.findByIdAndUpdate(req.session.userId, { biometricConnections });
    res.json({ success: true, preferences, goalsVersion: biometricConnections.appleHealth.goalsVersion });
  } catch (error) {
    console.error('Apple Health preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

module.exports = router;