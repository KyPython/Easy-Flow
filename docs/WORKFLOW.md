# Daily Workflow

## Start Working
```bash
cd /Users/ky/Easy-Flow
git checkout dev
./start-dev.sh
```
**Auto-installs:** All npm and Python dependencies if missing  
**Opens:** http://localhost:3000

**⚠️ Polling Floods or 401 Errors?** This usually means Firebase configuration is missing.

**The app will now FAIL LOUDLY in development** if Firebase config is missing, preventing silent fallback to polling.

**To Fix:**
1. **Check if `.env.local` exists:**
   ```bash
   ls -la rpa-system/rpa-dashboard/.env.local
   ```

2. **If missing, create it:**
   ```bash
   touch rpa-system/rpa-dashboard/.env.local
   ```

3. **Add Firebase configuration** (get values from Firebase Console → Project Settings → General → Your apps):
   ```bash
   # Edit the file
   nano rpa-system/rpa-dashboard/.env.local
   ```
   
   Required variables:
   ```plaintext
   # === FIREBASE CONFIGURATION (REQUIRED) ===
   REACT_APP_FIREBASE_API_KEY=AIzaSy...YOUR_KEY...
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   REACT_APP_FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=1234567890
   REACT_APP_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
   REACT_APP_FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ
   
   # === SUPABASE CONFIGURATION (REQUIRED) ===
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   
   # === LOCAL API CONFIGURATION ===
   REACT_APP_API_BASE=http://localhost:3030
   ```

4. **Restart the dev server** - CRA only loads `.env.local` on startup:
   ```bash
   ./stop-dev.sh && ./start-dev.sh
   ```

5. **Verify it worked** - The app should start without Firebase configuration errors. Check browser console for confirmation.

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

