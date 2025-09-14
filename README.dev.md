# Development README

This file documents how to run the Easy-Flow stack locally for development.

Prerequisites

- Docker and Docker Compose installed (Docker Desktop on macOS is fine).

Quick start

1. From the repo root, start the dev stack:

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

Notes and troubleshooting

1. node_modules and native binaries
   When the host's `node_modules` is bind-mounted into the container it can hide the container's installed modules and cause native binaries (bcrypt, sharp, etc.) to fail due to platform/architecture mismatch.

Recommended safe pattern (already enabled in `docker-compose.yml`):

- A named volume `backend_node_modules` stores the container-installed `node_modules`.
- The source code is bind-mounted for live edits, while `node_modules` stays in the volume.

If you previously used `npm install` on host and see weird exec format or native binary errors:

- Remove the host `node_modules` inside the backend folder (or move it):

```bash
cd rpa-system/backend
rm -rf node_modules
```

Then rebuild the image:

```bash
# From repo root
docker compose build --no-cache backend
docker compose up -d backend
```

2. Ports

- If ports are already in use on your machine, update the host ports in `docker-compose.yml` or stop the conflicting local services. Common conflicts: Postgres 5432, Redis 6379, local backend on 3030.

3. Environment

- The backend reads `rpa-system/backend/.env` if present. For local dev you can set small tweaks in that file.
- Dev-only feature flags and test user id:
  - `DEV_USER_ID` (default: `dev-user-12345`)
  - `DEV_THEME` (default: `light`)
  - `DEV_ENABLE_NEW_BUILDER` (default: `false`)
  - `DEV_ENABLE_BETA_ACTIONS` (default: `false`)

4. Rebuilding after dependency changes

- If you update `package.json` or native deps, rebuild the backend image so modules install inside the image:

```bash
docker compose build --no-cache backend
docker compose up -d backend
```

5. Logs and quick checks

- View backend logs:

```bash
docker compose logs --follow backend
```

- Test the dev-fallback preferences endpoint (returns a richer dev payload):

```bash
curl -i http://localhost:3030/api/user/preferences || true
```

6. Re-enabling live code-only bind mount (optional)

- If you prefer not to use the named volume approach, you can bind-mount your source and run `npm install` on the host for faster iteration, but be prepared to run `npm rebuild` when native modules change.

7. CI / Render notes

- `render.yaml` is intended for the Render platform and should be applied by Render. The repository includes an example GitHub Actions workflow that shows how to trigger a redeploy.

If you want, I can add a small Makefile with common dev targets (start, stop, rebuild-backend).

8. Running workflows locally ("Workflow not found" errors)

- If you see "Workflow not found: No workflow found with this ID" when trying to run a workflow from the dashboard, it means there is no saved workflow record in the backend database with the ID the UI is attempting to run.
- Quick ways to fix this in local development:
  - Save a workflow in the dashboard UI (use the Save button) before pressing Run. This persists it to the local database and the Run button will find it.
  - Enable draft execution so the backend will allow running non-active workflows during dev by setting `ALLOW_DRAFT_EXECUTION=true` in `rpa-system/backend/.env` or the docker-compose backend environment (already set by the provided compose in this repo).
  - Seed a sample workflow using the dev-only seeder endpoint (only available in development):

```bash
# Ensure backend is running and SUPABASE env is configured in rpa-system/backend/.env
curl -X POST http://localhost:3030/api/dev/seed-sample-workflow -H "Content-Type: application/json"
```

The seeder will insert a simple Start -> End workflow and return its `workflow.id`. Copy that ID and open the workflow in the dashboard (or the UI will pick it up when listing workflows).

9. Automation worker

- The automation worker is a separate service (Python Flask) that processes tasks. For local runs compose exposes it on port 7001 and the backend `AUTOMATION_URL` is configured to `http://automation-worker:7001` so backend can dispatch tasks. If you prefer to run the Python worker locally outside of Docker, set `AUTOMATION_URL=http://localhost:7001` in `rpa-system/backend/.env` and start the worker script.
