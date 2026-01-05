const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB connection
// In Docker, use 'mongo' as hostname. Otherwise use 'localhost'
const isDocker = process.env.DOCKER_ENV === 'true' || process.env.MONGODB_URI?.includes('mongo:');
const defaultMongoURI = isDocker 
  ? 'mongodb://mongo:27017/ai-diet-planner'
  : 'mongodb://localhost:27017/ai-diet-planner';

const MONGODB_URI = process.env.MONGODB_URI || defaultMongoURI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s
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
  if (err.message.includes('ECONNREFUSED')) {
    console.error('');
    console.error('💡 Troubleshooting:');
    if (MONGODB_URI.includes('localhost')) {
      console.error('   - If using Docker, change MONGODB_URI to: mongodb://mongo:27017/ai-diet-planner');
      console.error('   - Or set DOCKER_ENV=true in docker-compose.yml');
    } else if (MONGODB_URI.includes('mongo:')) {
      console.error('   - Make sure MongoDB container is running: docker compose ps');
      console.error('   - Start MongoDB: docker compose up -d mongo');
    }
  }
});

// Routes
const mealPlanRoutes = require('./routes/mealPlan');
app.use('/api/meal-plan', mealPlanRoutes);

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/plan', (req, res) => {
  res.render('plan');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

