# Setup Without Docker

Since Docker is not installed, here are the easiest ways to run the application:

## ⭐ Option 1: MongoDB Atlas (RECOMMENDED - Easiest)

**No installation needed - uses free cloud database!**

### Step 1: Create MongoDB Atlas Account
1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up for free account
3. Create a free cluster (M0 - Free tier)
   - Choose any cloud provider (AWS, Google Cloud, Azure)
   - Choose any region
   - Name it anything (e.g., "Cluster0")
   - Click "Create Cluster" (takes 3-5 minutes)

### Step 2: Setup Database Access
1. Go to "Database Access" (left sidebar)
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create username and password (save these!)
5. Set privileges to "Atlas admin" or "Read and write to any database"
6. Click "Add User"

### Step 3: Setup Network Access
1. Go to "Network Access" (left sidebar)
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development)
   - Or add your specific IP address
4. Click "Confirm"

### Step 4: Get Connection String
1. Go back to "Database" (left sidebar)
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string
   - It looks like: `mongodb+srv://username:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Replace `<password>` with your database user password
6. Add `/ai-diet-planner` before the `?` to specify database name:
   - Final: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ai-diet-planner?retryWrites=true&w=majority`

### Step 5: Create .env File
In your project directory, create `.env` file:

```bash
cd /Users/robina.khan/Desktop/AIDietPlanner
```

Create `.env` with:
```
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ai-diet-planner?retryWrites=true&w=majority
SESSION_SECRET=ai-diet-planner-secret-key-12345
```

**Replace with your actual connection string!**

### Step 6: Install and Run
```bash
npm install
npm start
```

### Step 7: Access Application
Open browser: `http://localhost:3000`

---

## Option 2: Install Docker Desktop

If you want to use Docker:

1. **Download Docker Desktop:**
   - Mac: https://www.docker.com/products/docker-desktop
   - Install and start Docker Desktop

2. **Then run:**
   ```bash
   docker compose up -d
   ```

See `INSTALL_DOCKER.md` for detailed instructions.

---

## Option 3: Local MongoDB Installation

### For macOS (using Homebrew):
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community
```

### Create .env file:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-diet-planner
SESSION_SECRET=your-secret-key-here
```

### Run:
```bash
npm install
npm start
```

---

## Quick Comparison

| Option | Difficulty | Setup Time | Best For |
|--------|-----------|------------|----------|
| **MongoDB Atlas** | ⭐ Easy | 5 minutes | Everyone (recommended) |
| Docker Desktop | ⭐⭐ Medium | 10 minutes | If you want containerization |
| Local MongoDB | ⭐⭐⭐ Hard | 15-20 minutes | Advanced users |

**Recommendation: Use MongoDB Atlas - it's the easiest and requires no installation!**

