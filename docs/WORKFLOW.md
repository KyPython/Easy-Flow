# Daily Workflow

## Start Working
```bash
cd /Users/ky/Easy-Flow
git checkout dev
./start-dev.sh
```
**Auto-installs:** All npm and Python dependencies if missing  
**Opens:** http://localhost:3000

**⚠️ First Time Setup:** If you see polling floods or 401 errors, configure environment variables:
```bash
cd rpa-system/rpa-dashboard
cp .env.example .env.local
# Edit .env.local with your Firebase & Supabase credentials
# Then restart: ./stop-dev.sh && ./start-dev.sh
```
**Get credentials:**
- Firebase: https://console.firebase.google.com/ → Project Settings → General → Your apps → Web app
- Supabase: https://app.supabase.com/ → Settings → API

## While Working
- Make changes → Test in browser
- Watch logs: `npm run logs`
- Debug: http://localhost:3001 (Grafana)

## Save Your Work
```bash
git add .
git commit -m "feat(scope): what you did"
git push origin dev
```
**Auto-runs:** Linting, tests, security scan

## Ship to Production
```bash
npm run ship
```
**Does:** Full tests → Merge dev→main → Deploy

**⚠️ IMPORTANT:** Vercel MUST be configured to deploy production from `main` branch only.  
See [Vercel Deployment Guide](VERCEL_DEPLOYMENT.md) to verify/fix settings.

## Stop Working
```bash
./stop-dev.sh
```

## Quick Reference

**Start/Stop:**
- `./start-dev.sh` - Start everything (auto-installs dependencies)
- `./stop-dev.sh` - Stop everything

**Logs:**
- `npm run logs` - Watch all logs

**Infrastructure (Terraform):**
- `npm run infra:plan` - Plan infrastructure changes (dry run)
- `npm run infra:apply` - Apply infrastructure changes
- `npm run infra:validate` - Validate Terraform config
- `npm run infra:fmt` - Format Terraform files

**URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001 (admin/admin123)

**Branch Strategy:**
- `dev` = Daily work (NOT deployed)
- `main` = Production (auto-deploys)

