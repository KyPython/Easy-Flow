# Render Deployment Troubleshooting

Your Render deployment is failing with a 502 error. Here's how to fix it:

## Step 1: Check Environment Variables

In your Render dashboard, ensure these **critical** environment variables are set:

**Required for app to start:**
```bash
PORT=10000
NODE_ENV=production
```

**Database (from ACTUAL_ENV_VALUES.txt):**
```bash
SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk
```

## Step 2: Check Render Service Settings

**Build Command:** `npm install`  
**Start Command:** `npm start`

## Step 3: Check Logs

In Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Look for error messages

**Common errors:**
- "Cannot find module" → missing dependencies
- "Port already in use" → PORT not set correctly
- "ENOENT" → file paths wrong

## Step 4: Minimal Test

Your app should start with just these 3 variables:
- `PORT=10000`
- `NODE_ENV=production`  
- `SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co`

Add others after the basic app starts.

## Step 5: Quick Fix

1. **Set PORT=10000** in environment variables
2. **Redeploy** the service
3. **Check logs** for any remaining errors
4. **Test** https://easyflow-backend-ad8e.onrender.com/health

The 502 error means Render can't reach your app, usually because it's not listening on the correct port or crashed during startup.