# Debugging Guide

**Quick steps to find and fix issues**

## 1. Check Logs

```bash
# Watch all logs (recommended - color-coded)
npm run logs

# OR individually:
tail -f logs/backend.log
tail -f logs/automation-worker.log
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
- Check logs: `npm run logs` or `tail -f logs/automation-worker.log`
- Did worker send result to Kafka? (check automation-worker.log)
- Did consumer receive the result? (check backend.log)
- Restart: `./stop-dev.sh && ./start-dev.sh`

**Kafka consumer not receiving:**
- Check Kafka is running: `docker ps | grep kafka`
- Check backend logs: `npm run logs` or `tail -f logs/backend.log`
- Look for consumer errors in backend logs
- Restart backend: `pm2 restart backend` or restart all: `./stop-dev.sh && ./start-dev.sh`

**400 Bad Request:**
- Check backend logs: `npm run logs` or `tail -f logs/backend.log`
- Look for validation errors
- Check if credentials are required (for link discovery)
- Check request payload in browser DevTools

**Services won't start:**
- Check ports: `lsof -i :3030` (backend), `lsof -i :3000` (frontend)
- Kill processes: `lsof -ti :3030 | xargs kill -9`
- Restart: `./stop-dev.sh && ./start-dev.sh`

**Pre-commit hook failing:**
- Check what failed in the hook output
- Run manually: `npm run lint:test` to see detailed errors
- Fix issues, then commit again

**Pre-push hook failing:**
- Check what failed in the hook output
- Run manually: `npm run test:all` to see detailed errors
- Fix issues, then push again

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

