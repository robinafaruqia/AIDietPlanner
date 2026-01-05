# MongoDB Compass Connection Guide

## Connection String for MongoDB Compass

When connecting from **MongoDB Compass** (running on your host machine), use:

```
mongodb://localhost:27017/ai-diet-planner
```

**NOT** `mongodb://mongo:27017/ai-diet-planner` (that only works inside Docker network)

## Step-by-Step Connection

1. **Make sure Docker containers are running:**
   ```bash
   docker compose up -d
   ```
   Or check if they're running:
   ```bash
   docker compose ps
   ```
   
   **Note:** If `docker compose` doesn't work, try `docker-compose` (with hyphen). Newer Docker versions use `docker compose` (space).

2. **Open MongoDB Compass**

3. **Enter Connection String:**
   ```
   mongodb://localhost:27017
   ```
   Or the full connection string:
   ```
   mongodb://localhost:27017/ai-diet-planner
   ```

4. **Click "Connect"**

5. **You should see:**
   - Database: `ai-diet-planner`
   - Collections: `users`, `mealplans`

## Troubleshooting

### Connection Refused
- **Check if MongoDB container is running:**
  ```bash
  docker-compose ps
  ```
  You should see the `mongo` service running.

- **Start MongoDB if not running:**
  ```bash
  docker compose up -d mongo
  ```
  (Or `docker-compose up -d mongo` if the above doesn't work)

### Port Already in Use
If port 27017 is already in use by another MongoDB instance:
- Stop the other MongoDB instance, OR
- Change the port in `docker-compose.yml`:
  ```yaml
  mongo:
    ports:
      - "27018:27017"  # Changed to 27018
  ```
  Then use: `mongodb://localhost:27018/ai-diet-planner`

### Connection Timeout
- Make sure Docker Desktop is running
- Check firewall settings
- Verify MongoDB container logs:
  ```bash
  docker compose logs mongo
  ```
  (Or `docker-compose logs mongo` if the above doesn't work)

## Connection Strings Summary

| Context | Connection String |
|---------|-------------------|
| **MongoDB Compass** (host machine) | `mongodb://localhost:27017/ai-diet-planner` |
| **Docker app container** (internal) | `mongodb://mongo:27017/ai-diet-planner` |
| **Local MongoDB** (if installed) | `mongodb://localhost:27017/ai-diet-planner` |
| **MongoDB Atlas** (cloud) | `mongodb+srv://username:password@cluster.mongodb.net/ai-diet-planner` |

## Quick Test

1. Start containers: `docker compose up -d` (or `docker-compose up -d`)
2. Wait 10 seconds for MongoDB to initialize
3. Open MongoDB Compass
4. Connect with: `mongodb://localhost:27017`
5. You should see the `ai-diet-planner` database

