# How to Check Error Logs - Docker & MongoDB

## Option 1: Docker Logs

### View All Container Logs
```bash
docker compose logs
```

### View Specific Service Logs

**Application Logs:**
```bash
docker compose logs app
```

**MongoDB Logs:**
```bash
docker compose logs mongo
```

### Follow Logs in Real-Time (Live)
```bash
# All services
docker compose logs -f

# Just application
docker compose logs -f app

# Just MongoDB
docker compose logs -f mongo
```

### View Last N Lines
```bash
# Last 100 lines
docker compose logs --tail=100

# Last 50 lines of app
docker compose logs --tail=50 app
```

### View Logs with Timestamps
```bash
docker compose logs -t
```

## Option 2: MongoDB Logs (If Running Locally)

### If MongoDB Installed via Homebrew (Mac)
```bash
# View MongoDB logs
tail -f /usr/local/var/log/mongodb/mongo.log

# Or if using different path
tail -f ~/data/db/mongod.log
```

### If MongoDB Running as Service
```bash
# Mac (Homebrew)
brew services list | grep mongodb
# Then check log location shown

# Linux (systemd)
journalctl -u mongod -f
```

### MongoDB Compass
1. Open MongoDB Compass
2. Connect to your database
3. Check the "Logs" tab in the bottom panel

## Option 3: Application Logs (Without Docker)

### View Server Logs
If running `npm start` directly:
- Logs appear in the terminal where you ran the command
- Look for:
  - `MongoDB connected successfully` or `MongoDB connection error`
  - `Server running on port 3000`
  - `AI meal plan generated successfully` or errors

### Save Logs to File
```bash
# Start server and save logs
npm start > server.log 2>&1

# View logs
tail -f server.log
```

## Option 4: Check MongoDB Connection Status

### Using MongoDB Shell
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/ai-diet-planner

# Or if using Docker
docker compose exec mongo mongosh
```

### Check Connection in Application
Visit: `http://localhost:3000/api/status`

This shows MongoDB connection status in JSON format.

## Common Error Messages

### MongoDB Connection Errors

**"MongoDB connection error"**
- Check if MongoDB is running
- Verify connection string in `.env`
- Check network/firewall settings

**"Operation buffering timed out"**
- MongoDB not accessible
- Connection string incorrect
- Network issues

**"Authentication failed"**
- Wrong username/password
- User doesn't have permissions

### Docker Errors

**"Cannot connect to Docker daemon"**
- Docker Desktop not running
- Start Docker Desktop application

**"Container not found"**
- Containers not started
- Run: `docker compose up -d`

**"Port already in use"**
- Another service using port 3000 or 27017
- Change PORT in `.env` or stop other service

## Quick Commands Reference

```bash
# Check if Docker containers are running
docker compose ps

# View all logs
docker compose logs

# View app logs (last 50 lines)
docker compose logs --tail=50 app

# View MongoDB logs (follow in real-time)
docker compose logs -f mongo

# Restart services
docker compose restart

# Stop and view logs
docker compose down
docker compose up
```

## Debugging Tips

1. **Check Container Status:**
   ```bash
   docker compose ps
   ```
   Should show both `app` and `mongo` as "Up"

2. **Check Application Logs:**
   ```bash
   docker compose logs app | grep -i error
   ```

3. **Check MongoDB Logs:**
   ```bash
   docker compose logs mongo | grep -i error
   ```

4. **Test MongoDB Connection:**
   ```bash
   docker compose exec mongo mongosh --eval "db.adminCommand('ping')"
   ```

5. **View Environment Variables:**
   ```bash
   docker compose exec app env | grep -E "MONGODB|GOOGLE"
   ```

## Log File Locations

### Docker Logs
- Stored in Docker's internal logging system
- Access via `docker compose logs` command
- Can be redirected to files if needed

### Application Logs
- Console output (stdout/stderr)
- Can be saved to file: `npm start > logs.txt 2>&1`

### MongoDB Logs (Docker)
- Inside MongoDB container
- Access via: `docker compose logs mongo`

## Need More Help?

If you see specific errors:
1. Copy the full error message
2. Check which service it's from (app or mongo)
3. Check the timestamp
4. Review the context (what were you doing when it happened?)

