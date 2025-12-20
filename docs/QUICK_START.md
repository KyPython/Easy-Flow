# EasyFlow Quick Start

**Everything you need to work on EasyFlow - no fluff**

## Daily Workflow

```bash
# 1. Start
./start-dev.sh

# 2. Work (make changes, test in browser)

# 3. Before commit
npm run lint:test

# 4. Commit
git commit -m "feat(scope): what you did"

# 5. Before push
npm run test:all

# 6. Push
git push

# 7. Stop
./stop-dev.sh
```

## When Something Breaks

```bash
# Check logs
tail -f logs/backend.log
tail -f logs/automation-worker.log

# Check Grafana (if observability is running)
open http://localhost:3001  # admin/admin123

# Restart if needed
./stop-dev.sh && ./start-dev.sh
```

## Common Commands

```bash
# Start/Stop
./start-dev.sh
./stop-dev.sh

# Testing
npm run lint:test        # Quick check before commit
npm run test:all         # Full check before push

# Git
git add .
git commit -m "feat(scope): description"
git push
```

## URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001 (admin/admin123)

## Troubleshooting

**Port in use:** `./stop-dev.sh && ./start-dev.sh`

**Services not responding:** Check `docker ps` and restart

**Tests failing:** Check logs, fix issue, re-run tests

