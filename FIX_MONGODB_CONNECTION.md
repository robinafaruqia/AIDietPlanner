# Fix MongoDB Connection Error: ECONNREFUSED

## Problem
You're seeing this error:
```
MongoDB connection error: MongooseServerSelectionError: connect ECONNREFUSED ::1:27017
```

This happens because the app is trying to connect to `localhost:27017` but in Docker, containers need to use service names instead.

## Solution

### Option 1: Using Docker Compose (Recommended)

The `docker-compose.yml` is already configured correctly with:
```yaml
MONGODB_URI=mongodb://mongo:27017/ai-diet-planner
```

**Steps to fix:**

1. **Restart your containers:**
   ```bash
   docker compose down
   docker compose up -d
   ```

2. **Check if MongoDB is running:**
   ```bash
   docker compose ps
   ```
   You should see both `app` and `mongo` as "Up"

3. **Check MongoDB logs:**
   ```bash
   docker compose logs mongo
   ```
   Should show MongoDB started successfully

4. **Check app logs:**
   ```bash
   docker compose logs app
   ```
   Should show "✅ MongoDB connected successfully"

### Option 2: Manual Environment Variable

If you're running the app manually (not via docker-compose):

1. **Create/update `.env` file:**
   ```
   MONGODB_URI=mongodb://localhost:27017/ai-diet-planner
   ```
   (Use `localhost` when running outside Docker)

2. **If using Docker but running app separately:**
   ```
   MONGODB_URI=mongodb://mongo:27017/ai-diet-planner
   ```
   (Use `mongo` service name when in Docker network)

### Option 3: Check MongoDB Container

1. **Verify MongoDB container is running:**
   ```bash
   docker compose ps mongo
   ```

2. **If not running, start it:**
   ```bash
   docker compose up -d mongo
   ```

3. **Wait a few seconds for MongoDB to initialize, then check logs:**
   ```bash
   docker compose logs mongo | tail -20
   ```

## Connection Strings by Environment

| Environment | Connection String |
|-------------|-------------------|
| **Docker (docker-compose)** | `mongodb://mongo:27017/ai-diet-planner` |
| **Local MongoDB** | `mongodb://localhost:27017/ai-diet-planner` |
| **MongoDB Atlas** | `mongodb+srv://user:pass@cluster.mongodb.net/ai-diet-planner` |

## Quick Fix Commands

```bash
# Stop everything
docker compose down

# Start fresh
docker compose up -d

# View logs to verify
docker compose logs app | grep MongoDB
docker compose logs mongo | tail -10
```

## Verify Connection

After fixing, you should see in the app logs:
```
✅ MongoDB connected successfully
   Database: ai-diet-planner
   Host: mongo
```

## Still Having Issues?

1. **Check container network:**
   ```bash
   docker compose exec app ping mongo
   ```
   Should respond (Ctrl+C to stop)

2. **Test MongoDB directly:**
   ```bash
   docker compose exec mongo mongosh --eval "db.adminCommand('ping')"
   ```

3. **Check environment variables:**
   ```bash
   docker compose exec app env | grep MONGODB
   ```

4. **View all logs:**
   ```bash
   docker compose logs
   ```

The fix has been applied to `server.js` - it will now automatically detect Docker environment and use the correct connection string.

