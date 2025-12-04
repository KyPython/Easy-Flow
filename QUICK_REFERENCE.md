# 🚀 Easy-Flow Quick Reference

## Start/Stop Servers

```bash
# Start both servers
./start-dev.sh

# Stop all servers  
./stop-dev.sh
```

## URLs

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3030
- **Health Check**: http://localhost:3030/health

## View Logs

```bash
# Backend logs (real-time)
tail -f logs/backend.log

# Frontend logs (real-time)
tail -f logs/frontend.log

# Last 50 lines
tail -50 logs/backend.log
```

## Test API

```bash
# Health check
curl http://localhost:3030/health

# User plan (requires auth)
# Get cookie from browser first
curl -H "Cookie: sb-access-token=..." http://localhost:3030/api/user/plan
```

## Common Issues

### Backend Won't Start
```bash
# Kill existing process
pkill -f "node server.js"

# Check if port is in use
lsof -i :3030

# Start manually
cd rpa-system/backend
NODE_ENV=development node server.js
```

### Frontend Won't Start
```bash
# Kill existing process
pkill -f "react-app-rewired"

# Start manually
cd rpa-system/rpa-dashboard
npm start
```

### CORS Errors
```bash
# Check backend .env has:
ALLOWED_ORIGINS=http://localhost:3000

# Restart backend after changing .env
./stop-dev.sh && ./start-dev.sh
```

### Too Many Logs
```bash
# Set in backend/.env:
LOG_LEVEL=error  # or warn

# Clear logs
> logs/backend.log
> logs/frontend.log
```

## Configuration Files

```
rpa-system/backend/.env      # Backend config
rpa-system/rpa-dashboard/.env.local  # Frontend config (if exists)
```

## Key Environment Variables

### Backend
```bash
NODE_ENV=development
PORT=3030
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=warn
SUPABASE_URL=...
SUPABASE_KEY=...
```

### Frontend  
```bash
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
```

## Deployment

### Backend (Render.com)
1. Connect GitHub repo
2. Set root directory: `rpa-system/backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all env vars from backend/.env

### Frontend (Vercel)
1. Connect GitHub repo
2. Set root directory: `rpa-system/rpa-dashboard`
3. Framework: Create React App
4. Build command: `npm run build`
5. Add all REACT_APP_* env vars

## Mobile Testing

```bash
# Find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# On phone (same WiFi)
http://YOUR_IP:3000
```

## Supabase Setup

### Enable Realtime
1. Open Supabase dashboard
2. Go to Database → Replication
3. Enable for: `plans`, `workflows`, `automation_runs`

### Check Tables
```sql
SELECT * FROM profiles LIMIT 5;
SELECT * FROM plans;
SELECT * FROM workflows WHERE user_id = 'YOUR_USER_ID';
```

## Git Commands

```bash
# Save changes
git add .
git commit -m "Your message"
git push

# Check status
git status
git log --oneline -10
```

## Helpful Commands

```bash
# Check running Node processes
ps aux | grep node

# Check disk space
df -h

# Check directory size
du -sh logs/

# Find files
find . -name "*.js" | grep -v node_modules

# Search in files
grep -r "searchTerm" rpa-system/ --include="*.js"
```

## Emergency Reset

```bash
# Stop everything
./stop-dev.sh

# Kill all Node processes
pkill node

# Clear logs
> logs/backend.log
> logs/frontend.log

# Reinstall dependencies (if needed)
cd rpa-system/backend && npm install
cd ../rpa-dashboard && npm install

# Restart
cd ../..
./start-dev.sh
```

## Documentation

- **Full Guide**: `FIXES_SUMMARY.md`
- **This File**: Quick reference for daily use
- **README**: `README.dev.md`

---

**Last Updated**: December 4, 2025
