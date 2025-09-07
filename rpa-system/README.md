# EasyFlow RPA System

Monorepo with a Node.js backend API, Python automation (Flask + Selenium) microservice, and a frontend dashboard.

## Structure

- backend/ (Express + Supabase client)
- automation/ (Flask + Selenium)
- frontend/ (placeholder)
- docker-compose.yml
- requirements.txt
- package.json

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Docker (optional, for compose)

## Environment

Create a `.env` in `backend/` (or export env vars) when using Supabase:

SUPABASE_URL=...
SUPABASE_ANON_KEY=...
PORT=3001

## Payments (Polar) integration

If you plan to accept payments via Polar, set the following env variables in `backend/.env` (do NOT commit them):

- POLAR*API_KEY=sk_live*...(your Polar secret key)
- POLAR_WEBHOOK_SECRET=...(your webhook signing secret)
- POLAR_API_BASE=https://api.polar.com (optional; defaults to Polar's API URL)
- APP_PUBLIC_URL=https://your-app.example.com (used for success/cancel redirects)

Run the SQL migration at `backend/migrations/supabase-subscriptions.sql` to create `plans` and `subscriptions` tables and the `apply_subscription_transaction` RPC used by webhooks.

## Install and run (local)

- Backend: from repo root
  - `npm install`
  - `npm run dev:backend`
- Automation:
  - `python3 -m venv .venv && source .venv/bin/activate`
  - `pip install -r requirements.txt`
  - `python automation/automate.py`

## Run with Docker Compose

- `docker compose up --build`

Services:

- Backend: http://localhost:3001/health
- Automation: http://localhost:7000/health

## Notes

- Replace placeholder RPA logic in `automation/automate.py` with real automation flows.
- Add models under `backend/models/` as needed.
