# Email Queue Monitoring Workflow Setup

## Overview
The `monitor-email-queue.yml` workflow monitors your email queue and creates GitHub issues when the backlog exceeds the threshold (5 pending items).

## Required GitHub Secrets

### 1. `APP_URL` (Required)
**Must point to your BACKEND API, not the frontend!**

✅ **Correct Examples:**
- `https://easyflow-backend.onrender.com` (Render backend service)
- `https://api.yourdomain.com` (Custom API domain)
- `https://backend.yourdomain.com` (Subdomain for backend)

❌ **Wrong Examples:**
- `https://yourdomain.com` (Frontend)
- `https://easy-flow-lac.vercel.app` (Frontend)
- `https://app.yourdomain.com` (Frontend)

**How to find your backend URL:**
1. Check Render.com dashboard → Your backend service → Settings → URL
2. Or check your `render.yaml` - service name is `easyflow-backend`
3. The URL should be accessible and return JSON from API endpoints

### 2. `ADMIN_API_SECRET` (Required)
**Must match your backend's `ADMIN_API_SECRET` environment variable.**

This secret is used to authenticate admin API requests to the `/admin/email-queue-stats` endpoint.

**How to set it:**
1. In your backend (Render.com), go to Environment → `ADMIN_API_SECRET`
2. Copy the value (or generate a new secure random string)
3. In GitHub, go to Settings → Secrets and variables → Actions
4. Add/update `ADMIN_API_SECRET` with the same value

## Endpoint Details

**Endpoint:** `GET /admin/email-queue-stats`

**Full URL:** `{APP_URL}/admin/email-queue-stats`

**Authentication:** Header `x-admin-secret: {ADMIN_API_SECRET}`

**Expected Response:**
```json
{
  "counts": {
    "pending": 0,
    "sent": 10,
    "failed": 0
  },
  "total": 10,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Testing the Configuration

### Manual Test
```bash
# Replace with your actual values
APP_URL="https://easyflow-backend.onrender.com"
ADMIN_API_SECRET="your-secret-here"

curl -H "x-admin-secret: $ADMIN_API_SECRET" \
  "$APP_URL/admin/email-queue-stats"
```

**Expected:** JSON response with email queue statistics

**If you get HTML:** `APP_URL` is pointing to the frontend - update it!

**If you get 401:** `ADMIN_API_SECRET` doesn't match - check both values match

**If you get 500:** Backend `ADMIN_API_SECRET` not configured - add it to backend env vars

## Troubleshooting

### Error: "Endpoint returned HTML instead of JSON"
**Cause:** `APP_URL` points to frontend instead of backend

**Fix:**
1. Check your Render.com backend service URL
2. Update GitHub secret `APP_URL` to backend URL
3. Ensure URL doesn't end with `/api` or any path

### Error: "Unauthorized: Invalid admin secret"
**Cause:** `ADMIN_API_SECRET` doesn't match between GitHub and backend

**Fix:**
1. Check backend environment variable `ADMIN_API_SECRET` in Render.com
2. Update GitHub secret `ADMIN_API_SECRET` to match exactly
3. Both must be identical (case-sensitive)

### Error: "ADMIN_API_SECRET not configured"
**Cause:** Backend doesn't have `ADMIN_API_SECRET` environment variable

**Fix:**
1. Go to Render.com → Your backend service → Environment
2. Add `ADMIN_API_SECRET` with a secure random string
3. Redeploy backend
4. Update GitHub secret to match

### Error: "curl failed" or connection timeout
**Cause:** Backend is down or URL is incorrect

**Fix:**
1. Verify backend is running in Render.com dashboard
2. Check backend service URL is correct
3. Test URL manually in browser (should show backend, not frontend)
4. Check backend logs for errors

## Workflow Schedule

The workflow runs:
- **Hourly:** At the top of every hour (cron: `0 * * * *`)
- **Manual:** Can be triggered via `workflow_dispatch`

## Alert Threshold

- **Threshold:** 5 pending email items
- **Action:** Creates a GitHub issue with label `alert`, `email-queue`, `high-priority`
- **Issue includes:** Current queue statistics and troubleshooting steps

## Backend Endpoint Location

The endpoint is defined in:
- **File:** `rpa-system/backend/app.js`
- **Line:** ~5281
- **Route:** `GET /admin/email-queue-stats`
- **Middleware:** `adminAuthMiddleware` (checks `x-admin-secret` header)
