# Debugging Guide

**Quick steps to find and fix issues**

## 1. Check Logs

```bash
# Backend
tail -f logs/backend.log

# Automation Worker
tail -f logs/automation-worker.log

# All logs
tail -f logs/*.log
```

## 2. Check Grafana (if running)

```bash
open http://localhost:3001  # admin/admin123
```

**What to look for:**
- **Metrics** → See if requests are failing
- **Logs** → Search for error messages
- **Traces** → See where requests are slow/failing

## 3. Common Issues

**Task stuck in "Running":**
- Check `logs/automation-worker.log` - did it send result to Kafka?
- Check `logs/backend.log` - did consumer receive the result?
- Restart: `./stop-dev.sh && ./start-dev.sh`

**Kafka consumer not receiving:**
- Check Kafka is running: `docker ps | grep kafka`
- Check backend logs for consumer errors
- Restart backend: `pm2 restart backend` or restart all: `./stop-dev.sh && ./start-dev.sh`

**400 Bad Request:**
- Check backend logs for validation errors
- Check if credentials are required (for link discovery)
- Check request payload in browser DevTools

**Services won't start:**
- Check ports: `lsof -i :3030` (backend), `lsof -i :3000` (frontend)
- Kill processes: `lsof -ti :3030 | xargs kill -9`
- Restart: `./stop-dev.sh && ./start-dev.sh`

## 4. Health Checks

```bash
# Backend
curl http://localhost:3030/health

# Worker
curl http://localhost:7070/health

# Kafka
docker ps | grep kafka
```

## 5. Restart Everything

```bash
./stop-dev.sh
./start-dev.sh
```

