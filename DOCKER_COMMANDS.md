# Docker Commands Reference

## Important: Docker Compose Command

**Newer Docker versions** (Docker Desktop 3.0+) use:
```bash
docker compose
```
(with a **space**)

**Older Docker versions** use:
```bash
docker-compose
```
(with a **hyphen**)

If `docker compose` doesn't work, try `docker-compose`.

---

## Common Commands

### Start Services
```bash
# Start in background (detached mode)
docker compose up -d

# Start and see logs
docker compose up

# Start only MongoDB
docker compose up -d mongo
```

### Stop Services
```bash
# Stop all services
docker compose down

# Stop and remove volumes (clears database)
docker compose down -v
```

### Check Status
```bash
# See running containers
docker compose ps

# Or use regular docker command
docker ps
```

### View Logs
```bash
# All services
docker compose logs

# Just MongoDB
docker compose logs mongo

# Just the app
docker compose logs app

# Follow logs (live)
docker compose logs -f
```

### Rebuild
```bash
# Rebuild and restart
docker compose up -d --build
```

### Access MongoDB Shell
```bash
# Connect to MongoDB container
docker compose exec mongo mongosh

# Or use mongosh directly if installed
mongosh mongodb://localhost:27017/ai-diet-planner
```

---

## Troubleshooting

### Check if Docker is running
```bash
docker ps
```
If this fails, start Docker Desktop.

### Check if containers are running
```bash
docker compose ps
```

### Restart a specific service
```bash
docker compose restart mongo
docker compose restart app
```

### Remove everything and start fresh
```bash
docker compose down -v
docker compose up -d --build
```

---

## MongoDB Compass Connection

Once containers are running, connect with:
```
mongodb://localhost:27017/ai-diet-planner
```

