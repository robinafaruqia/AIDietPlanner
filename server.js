const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { initializePassport } = require('./config/passport');
const { optionalAuth } = require('./middleware/auth');
const { connectDB, disconnectDB, isDatabaseConnected, DB_PROVIDER } = require('./config/database');
const { isProduction } = require('./config/environment');

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.disable('x-powered-by');

if (isProduction) {
  app.set('trust proxy', 1);
}

const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && (!sessionSecret || sessionSecret.length < 16)) {
  throw new Error('SESSION_SECRET must be set (>=16 chars) in production');
}

app.use(session({
  name: 'aidiet.sid',
  secret: sessionSecret || 'dev-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
initializePassport();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

async function startServer() {
  try {
    await connectDB();
  } catch (err) {
    // Error is already logged in connectDB; continue app startup for degraded mode.
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

const authRoutes = require('./routes/auth');
const mealPlanRoutes = require('./routes/mealPlan');
const nutritionRoutes = require('./routes/nutrition');
const weightRoutes = require('./routes/weight');
const favoritesRoutes = require('./routes/favorites');
const exerciseLibraryRoutes = require('./routes/exercise-library');
const achievementsRoutes = require('./routes/achievements');
const fastingRoutes = require('./routes/fasting');
const foodRecognitionRoutes = require('./routes/food-recognition');
const biometricRoutes = require('./routes/biometric');
const keepAliveRoutes = require('./routes/keep-alive');
const { getAllConditions } = require('./config/healthConditions');

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/meal-plan', mealPlanRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/exercise-library', exerciseLibraryRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/fasting', fastingRoutes);
app.use('/api/food-recognition', foodRecognitionRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/keep-alive', keepAliveRoutes);

app.get('/api/health-conditions', (req, res) => {
  res.json({ success: true, conditions: getAllConditions() });
});

app.get('/', optionalAuth, (req, res) => {
  res.render('index', { user: req.user || null });
});

app.get('/login', optionalAuth, (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', { user: null, error: req.query.error || null });
});

app.get('/register', optionalAuth, (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('register', { user: null, error: req.query.error || null });
});

app.get('/profile', optionalAuth, (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.render('profile', { user: req.user });
});

app.get('/plan', optionalAuth, (req, res) => {
  res.render('plan', { user: req.user || null, healthConditions: getAllConditions() });
});

app.get('/tracking', optionalAuth, (req, res) => {
  res.render('tracking', { user: req.user || null });
});

app.get('/weight', optionalAuth, (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.render('weight', { user: req.user });
});

app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dbProvider: DB_PROVIDER,
    database: isDatabaseConnected() ? 'connected' : 'disconnected'
  };
  res.json(health);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  try {
    await disconnectDB();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});
