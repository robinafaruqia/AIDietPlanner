# Installing Docker Desktop

## For macOS

1. **Download Docker Desktop:**
   - Go to: https://www.docker.com/products/docker-desktop
   - Click "Download for Mac"
   - Choose the version for your Mac (Intel or Apple Silicon)

2. **Install:**
   - Open the downloaded `.dmg` file
   - Drag Docker to Applications folder
   - Open Docker from Applications
   - Follow the setup wizard

3. **Verify Installation:**
   ```bash
   docker --version
   docker compose version
   ```

4. **Start Docker Desktop:**
   - Open Docker Desktop from Applications
   - Wait for it to start (whale icon in menu bar)

5. **Then run:**
   ```bash
   cd /Users/robina.khan/Desktop/AIDietPlanner
   docker compose up -d
   ```

---

## Alternative: Run Without Docker

If you don't want to install Docker, you can run the app with local MongoDB or MongoDB Atlas (cloud).

### Option A: MongoDB Atlas (Free Cloud Database - Easiest)

1. **Sign up for MongoDB Atlas:**
   - Go to: https://www.mongodb.com/cloud/atlas
   - Create a free account
   - Create a free cluster (M0 - Free tier)

2. **Get Connection String:**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)

3. **Create .env file:**
   ```bash
   cd /Users/robina.khan/Desktop/AIDietPlanner
   ```
   Create a file named `.env` with:
   ```
   PORT=3000
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-diet-planner?retryWrites=true&w=majority
   SESSION_SECRET=your-secret-key-here
   ```
   (Replace with your actual Atlas connection string)

4. **Install dependencies and run:**
   ```bash
   npm install
   npm start
   ```

### Option B: Local MongoDB Installation

1. **Install MongoDB locally:**
   ```bash
   # Using Homebrew (if you have it)
   brew tap mongodb/brew
   brew install mongodb-community
   ```

2. **Start MongoDB:**
   ```bash
   brew services start mongodb-community
   ```

3. **Create .env file:**
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/ai-diet-planner
   SESSION_SECRET=your-secret-key-here
   ```

4. **Install dependencies and run:**
   ```bash
   npm install
   npm start
   ```

---

## Recommended: MongoDB Atlas (No Installation Needed)

MongoDB Atlas is the easiest option - it's free, cloud-based, and requires no local installation!

