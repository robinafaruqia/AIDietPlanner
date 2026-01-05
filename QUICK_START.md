# Quick Start Guide

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (FREE - recommended) OR local MongoDB OR Docker

## ⭐ Recommended: MongoDB Atlas (Easiest - No Installation)

**MongoDB Atlas is a free cloud database - no local installation needed!**

### Steps:

1. **Sign up for MongoDB Atlas:**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Create a free account
   - Create a free cluster (M0 - Free tier, takes 3-5 minutes)

2. **Get Connection String:**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database password
   - Add database name: `/ai-diet-planner` at the end

3. **Create .env file:**
   ```bash
   cd /Users/robina.khan/Desktop/AIDietPlanner
   ```
   Create `.env` file with:
   ```
   PORT=3000
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-diet-planner?retryWrites=true&w=majority
   SESSION_SECRET=your-secret-key-here-12345
   ```
   (Replace with your actual Atlas connection string)

4. **Install and Run:**
   ```bash
   npm install
   npm start
   ```

5. **Access:** Open `http://localhost:3000`

---

## Alternative Setup Options

### Option 2: Local MongoDB

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file in the root directory:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/ai-diet-planner
   SESSION_SECRET=your-secret-key-here
   ```

3. **Start MongoDB**
   - If using local MongoDB: Install and start MongoDB
   - If using MongoDB Atlas: Already done! (cloud database)

4. **Start the Server**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

5. **Access the Application**
   Open your browser and go to: `http://localhost:3000`

## Using Docker (Alternative)

1. **Start with Docker Compose**
   ```bash
   docker compose up
   ```
   Or if you have older Docker version:
   ```bash
   docker-compose up
   ```
   This will start both the application and MongoDB automatically.

2. **Access the Application**
   Open your browser and go to: `http://localhost:3000`

3. **Stop the services**
   ```bash
   docker compose down
   ```
   Or: `docker-compose down`

## Testing the Application

1. Navigate to "Create Plan" page
2. Enter your weight (e.g., 70 kg)
3. Select a health condition (e.g., Gallstones)
4. Click "Generate Meal Plan"
5. View your personalized weekly meal plan and grocery list

## Troubleshooting

- **MongoDB Connection Error**: Make sure MongoDB is running or your connection string is correct
- **Port Already in Use**: Change the PORT in `.env` file
- **Module Not Found**: Run `npm install` again

