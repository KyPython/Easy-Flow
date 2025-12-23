# Daily Workflow

## Start Working
```bash
cd /Users/ky/Easy-Flow
git checkout dev
./start-dev.sh
```
**Opens:** http://localhost:3000 (auto-opens browser)

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

## Stop Working
```bash
./stop-dev.sh
```

## Quick Reference

**Start/Stop:**
- `./start-dev.sh` - Start everything
- `./stop-dev.sh` - Stop everything

**Logs:**
- `npm run logs` - Watch all logs

**URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001 (admin/admin123)

**Branch Strategy:**
- `dev` = Daily work (NOT deployed)
- `main` = Production (auto-deploys)

