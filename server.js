const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { initializePassport } = require('./config/passport');
const { optionalAuth } = require('./middleware/auth');

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

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret.length < 16)) {
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
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
initializePassport();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const isDocker = process.env.DOCKER_ENV === 'true' || process.env.MONGODB_URI?.includes('mongo:');
const defaultMongoURI = isDocker 
  ? 'mongodb://mongo:27017/ai-diet-planner'
  : 'mongodb://localhost:27017/ai-diet-planner';

const MONGODB_URI = process.env.MONGODB_URI || defaultMongoURI;

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  const dbName = MONGODB_URI.split('/').pop()?.split('?')[0] || 'ai-diet-planner';
  console.log(`   Database: ${dbName}`);
  const host = MONGODB_URI.match(/\/\/([^:]+):/)?.[1] || 'unknown';
  console.log(`   Host: ${host}`);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  const safeURI = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.error('   Connection string:', safeURI);
  console.error('   Error code:', err.code || err.name);
  console.error('');
  console.error('💡 App will run without database — meal plans will not be saved.');
  if (err.name === 'MongooseServerSelectionError' || MONGODB_URI.includes('mongodb.net')) {
    console.error('   For MongoDB Atlas: add your IP in Network Access (or use 0.0.0.0/0 for testing).');
    console.error('   Ensure the cluster is not paused and credentials in .env are correct.');
  }
  if (err.message.includes('ECONNREFUSED')) {
    if (MONGODB_URI.includes('localhost')) {
      console.error('   For local MongoDB: start MongoDB (e.g. brew services start mongodb-community) or use Atlas.');
    } else if (MONGODB_URI.includes('mongo:')) {
      console.error('   For Docker: run docker compose up -d mongo');
    }
  }
});

const authRoutes = require('./routes/auth');
const mealPlanRoutes = require('./routes/mealPlan');
const nutritionRoutes = require('./routes/nutrition');
const weightRoutes = require('./routes/weight');
const { getAllConditions } = require('./config/healthConditions');

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/meal-plan', mealPlanRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/weight', weightRoutes);

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
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  res.json(health);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});
