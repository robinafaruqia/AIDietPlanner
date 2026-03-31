const mongoose = require('mongoose');

const isDocker = process.env.DOCKER_ENV === 'true' || process.env.MONGODB_URI?.includes('mongo:');
const defaultMongoURI = isDocker
  ? 'mongodb://mongo:27017/ai-diet-planner'
  : 'mongodb://localhost:27017/ai-diet-planner';

const MONGODB_URI = process.env.MONGODB_URI || defaultMongoURI;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log('✅ MongoDB connected successfully');
    const dbName = MONGODB_URI.split('/').pop()?.split('?')[0] || 'ai-diet-planner';
    console.log(`   Database: ${dbName}`);
    const host = MONGODB_URI.match(/\/\/([^:]+):/)?.[1] || 'unknown';
    console.log(`   Host: ${host}`);
    return mongoose.connection;
  } catch (err) {
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
    throw err;
  }
}

module.exports = { connectDB, MONGODB_URI };
