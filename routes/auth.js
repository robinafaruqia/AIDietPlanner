const express = require('express');
const router = express.Router();
const passport = require('passport');
const userRepository = require('../repositories/userRepository');
const { isDatabaseConnected } = require('../config/database');
const { requireAuth, apiAuth, guestOnly } = require('../middleware/auth');

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password) {
  return password && password.length >= 6;
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function resolveGoogleCallbackUrl(req) {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredUrl = trimTrailingSlash(process.env.GOOGLE_CALLBACK_URL);
  if (isProduction && configuredUrl) return configuredUrl;

  const forwardedProto = req.get('x-forwarded-proto');
  const proto = isProduction
    ? (forwardedProto || req.protocol || 'https').split(',')[0].trim()
    : 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}/api/auth/google/callback`;
}

router.post('/register', guestOnly, async (req, res) => {
  try {
    const { name, email, password, confirmPassword, height, startWeight, targetWeight, healthConditions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = userRepository.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      provider: 'local',
      height: height ? parseFloat(height) : undefined,
      healthConditions: healthConditions || []
    });

    await user.setPassword(password);

    if (startWeight) {
      user.startWeight = parseFloat(startWeight);
      user.currentWeight = parseFloat(startWeight);
      user.startDate = new Date();
      user.weightHistory.push({
        weight: parseFloat(startWeight),
        date: new Date(),
        note: 'Starting weight'
      });
    }

    if (targetWeight) {
      user.targetWeight = parseFloat(targetWeight);
    }

    await user.save();

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
      }
      req.session.userId = userRepository.getId(user);
      res.json({ 
        success: true, 
        message: 'Registration successful',
        user: user.toPublicJSON()
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', guestOnly, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isDatabaseConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.provider !== 'local') {
      return res.status(401).json({ 
        error: `This account uses ${user.provider} sign-in. Please use that method.` 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save();

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
      }
      req.session.userId = userRepository.getId(user);
      res.json({ 
        success: true, 
        message: 'Login successful',
        user: user.toPublicJSON()
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('aidiet.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

router.get('/me', apiAuth, (req, res) => {
  res.json({ 
    success: true, 
    user: req.user.toPublicJSON() 
  });
});

router.put('/update-profile', apiAuth, async (req, res) => {
  try {
    const { name, height, healthConditions, targetWeight } = req.body;
    const user = req.user;

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (height !== undefined) {
      user.height = height ? parseFloat(height) : undefined;
    }

    if (healthConditions !== undefined) {
      user.healthConditions = healthConditions;
    }

    if (targetWeight !== undefined) {
      user.targetWeight = targetWeight ? parseFloat(targetWeight) : undefined;
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Profile updated',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.put('/change-password', apiAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = req.user;

    if (user.provider !== 'local') {
      return res.status(400).json({ 
        error: 'Cannot change password for social login accounts' 
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await user.setPassword(newPassword);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/google', (req, res, next) => {
  const callbackURL = resolveGoogleCallbackUrl(req);
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    callbackURL
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  const callbackURL = resolveGoogleCallbackUrl(req);
  passport.authenticate('google', { session: false, callbackURL }, (err, user) => {
    if (err) {
      const safeMessage = err.message || 'google_auth_failed';
      console.error('Google auth callback error:', safeMessage);
      return res.redirect(`/login?error=${encodeURIComponent(safeMessage)}`);
    }
    if (!user) {
      return res.redirect('/login?error=google_auth_failed');
    }
    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error('Session regenerate error:', sessionError);
      }
      req.session.userId = userRepository.getId(user);
      res.redirect('/');
    });
  })(req, res, next);
});

router.delete('/account', apiAuth, async (req, res) => {
  try {
    const user = req.user;
    user.isActive = false;
    await user.save();

    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.clearCookie('aidiet.sid');
      res.json({ success: true, message: 'Account deactivated' });
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
