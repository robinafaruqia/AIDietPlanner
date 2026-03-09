const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const { requireAuth, apiAuth, guestOnly } = require('../middleware/auth');

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password) {
  return password && password.length >= 6;
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

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = new User({
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
      req.session.userId = user._id;
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

    const user = await User.findByEmail(email);
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
      req.session.userId = user._id;
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

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login?error=google_auth_failed',
    session: false
  }),
  (req, res) => {
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
      }
      req.session.userId = req.user._id;
      res.redirect('/');
    });
  }
);

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
