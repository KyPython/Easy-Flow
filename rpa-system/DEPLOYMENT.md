# EasyFlow Deployment Guide

This guide covers a production deployment using Docker Compose on a single VPS and a static frontend host. Placeholders are marked as CHANGEME\_ and must be replaced.

## 1) Prerequisites

- Ubuntu VPS with Docker and Docker Compose plugin
- Domain and DNS ready (e.g., api.yourdomain.com)
- Supabase project (URL, anon key, service role key)

## 2) Backend + Automation (VPS)

1. Clone repo and enter folder:
   - git clone https://github.com/<you>/easyflow-rpa.git
   - cd easyflow-rpa/rpa-system
2. Create `.env` (copy `.env.example`) and fill CHANGEME\_ values:
   - SUPABASE_URL=https://CHANGEME_PROJECT_REF.supabase.co
   - SUPABASE_SERVICE_ROLE=CHANGEME_SERVICE_ROLE_KEY (server only)
   - SUPABASE_ANON_KEY=CHANGEME_ANON_KEY
   - SUPABASE_BUCKET=artifacts
   - SUPABASE_USE_SIGNED_URLS=true
   - SUPABASE_SIGNED_URL_EXPIRES=86400
   - API_KEY=CHANGEME_API_KEY (optional, protects /api)
3. Start services with prod override (automation private):
   - docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
4. Health checks:
   - curl http://localhost:7001/health
   - curl http://localhost:3030/health

## 3) Reverse Proxy (Nginx)

Point DNS A records to your VPS IP:

- api.CHANGEME_DOMAIN → <SERVER_IP>
- app.CHANGEME_DOMAIN → <SERVER_IP>

Set up Nginx on the server to proxy api.CHANGEME_DOMAIN → 127.0.0.1:3030 and add TLS with certbot.

## 4) Frontend (Vercel/Netlify or Nginx)

Copy `rpa-dashboard/.env.production.example` to `.env.production` and replace CHANGEME\_ values. Build and deploy `rpa-dashboard`.

## 5) Supabase setup

- Run `supabase_setup.sql` in SQL editor.
- Ensure Realtime is healthy and table is added to publication (script handles it when publication exists).

## 6) Post-deploy test

- Create a task from the UI and confirm History shows a completed run and a working download link.

## 7) Maintenance

- docker compose pull && docker compose up -d
- docker compose logs --no-color backend | tail -n 200
- Rotate keys and update `.env` as needed.
