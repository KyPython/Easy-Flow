# Daily Workflow

## Start Working
```bash
cd /Users/ky/Easy-Flow
git checkout dev
./start-dev.sh
```
**Auto-installs:** All npm and Python dependencies if missing  
**Opens:** http://localhost:3000

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
- `./start-dev.sh` - Start everything (auto-installs dependencies)
- `./stop-dev.sh` - Stop everything

**Logs:**
- `npm run logs` - Watch all logs

**Infrastructure:**
- `npm run infra:plan` - Plan infrastructure changes
- `npm run infra:apply` - Apply infrastructure changes
- See [Infrastructure as Code Guide](INFRASTRUCTURE_AS_CODE.md) for details

**URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001 (admin/admin123)

**Branch Strategy:**
- `dev` = Daily work (NOT deployed)
- `main` = Production (auto-deploys)

