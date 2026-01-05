# Setup Instructions (When Terminal is Available)

## Option 1: Using Terminal/Command Prompt

### Step 1: Open Terminal
- **Mac**: Press `Cmd + Space`, type "Terminal", press Enter
- **Windows**: Press `Win + R`, type "cmd", press Enter
- **Linux**: Press `Ctrl + Alt + T`

### Step 2: Navigate to Project Directory
```bash
cd /Users/robina.khan/Desktop/AIDietPlanner
```

### Step 3: Install Dependencies
```bash
npm install
```

If you get permission errors, try:
```bash
sudo npm install
```
(You'll need to enter your password)

### Step 4: Create .env File
Create a file named `.env` in the project root with:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-diet-planner
SESSION_SECRET=ai-diet-planner-secret-key-12345
```

### Step 5: Start MongoDB
**Option A - Local MongoDB:**
```bash
# Mac (if installed via Homebrew)
brew services start mongodb-community

# Or just run:
mongod
```

**Option B - MongoDB Atlas (Cloud - Recommended):**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a free cluster
4. Get your connection string
5. Update MONGODB_URI in .env file

### Step 6: Start the Server
```bash
npm start
```

You should see:
```
MongoDB connected successfully
Server running on port 3000
```

### Step 7: Open Browser
Go to: `http://localhost:3000`

---

## Option 2: Using Docker (Easiest - No MongoDB Setup Needed)

### Prerequisites
Install Docker Desktop from: https://www.docker.com/products/docker-desktop

### Steps
1. Open Terminal
2. Navigate to project:
   ```bash
   cd /Users/robina.khan/Desktop/AIDietPlanner
   ```
3. Start everything:
   ```bash
   docker-compose up
   ```
   This will:
   - Install all dependencies
   - Start MongoDB
   - Start the application
   
4. Open browser: `http://localhost:3000`

---

## Option 3: Using VS Code Integrated Terminal

1. Open the project in VS Code
2. Press `` Ctrl + ` `` (backtick) or go to: View → Terminal
3. Run the commands from Option 1

---

## Troubleshooting

### npm install fails
- Try: `npm install --legacy-peer-deps`
- Or: `npm install --force`

### MongoDB connection fails
- Make sure MongoDB is running
- Check the MONGODB_URI in .env file
- For local MongoDB, try: `mongod --dbpath ~/data/db`

### Port 3000 already in use
- Change PORT in .env to another number (e.g., 3001)
- Or stop the process using port 3000

### Permission denied errors
- On Mac/Linux: Use `sudo` (with caution)
- Check file permissions: `chmod -R 755 .`

---

## Quick Test

Once the server is running, test it:
1. Go to `http://localhost:3000`
2. Click "Create Plan"
3. Enter weight: 70
4. Select health condition: Gallstones
5. Click "Generate Meal Plan"
6. You should see a weekly meal plan and grocery list!

---

## Need Help?

If you're still having issues:
1. Check that Node.js is installed: `node --version`
2. Check that npm is installed: `npm --version`
3. Make sure you're in the correct directory
4. Verify all files are present (check the project structure)

