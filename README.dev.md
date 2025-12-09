# Development README

This file documents how to run the Easy-Flow stack locally for development.

Prerequisites

- Docker and Docker Compose installed (Docker Desktop on macOS is fine).

Quick start

1. From Easy-Flow, start the dev stack:

```bash
# From repository root
docker compose up --build
```

2. Services of interest

- Backend: http://localhost:3030
- Dashboard (dev server): see dashboard logs - typically http://localhost:3000
- Postgres: localhost:5432
- Redis: localhost:6379
- Kafka: internal to the compose network (kafka:9092)

3. Rebuilding after dependency changes

- If you update `package.json` or native deps, rebuild the backend image so modules install inside the image:

```bash
docker compose build --no-cache backend
docker compose up -d backend
```

4. Logs and quick checks

- View backend logs:

```bash
docker compose logs --follow backend
```

5. Automation worker

- The automation worker is a separate service (Python Flask) that processes tasks. For local runs compose exposes it on port 7001 and the backend `AUTOMATION_URL` is configured to `http://automation-worker:7001` so backend can dispatch tasks. If you prefer to run the Python worker locally outside of Docker, set `AUTOMATION_URL=http://localhost:7001` in `rpa-system/backend/.env` and start the worker script.

## 🎯 Demo System

The app includes a self-hosted demo at `/demo`:

**Local Development:**
- Demo URL: http://localhost:3030/demo
- Auto-fills credentials
- Test without external dependencies

**Production:**
- Demo URL automatically uses your domain
- Set `REACT_APP_API_BASE` in Render.com env vars
- No separate service needed - integrated into backend

**How it works:**
1. User clicks "🎯 Try Demo Portal" button
2. URL + credentials auto-fill
3. Automation worker downloads sample PDF
4. Complete demo in seconds

Files:
- `/backend/routes/demoRoutes.js` - Routes
- `/backend/public/demo/index.html` - Demo UI
- `/frontend/UrlInput.jsx` - Dynamic URL logic

