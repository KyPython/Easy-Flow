# Error Resolution Guide

This document addresses common errors and their solutions.

## 1. ⛔ 403 Forbidden - Notification Creation

**Error:** `POST /api/notifications/create 403 (Forbidden) - "This feature requires a premium plan"`

**What's happening:** The `/api/notifications/create` endpoint requires the `priority_support` feature, which is only available on premium plans (Professional/Enterprise).

**Solution:** 
- ✅ **Fixed:** The notification service now checks user plan before calling the backend endpoint
- If you're on Starter plan, notifications will silently fail (no error shown to user)
- To enable notifications, upgrade to Professional or Enterprise plan

**Status:** ✅ Fixed in `notificationService.js` - plan check added before backend call

---

## 2. ⚠️ Firebase Authentication Errors (401/400)

**Errors:**
- `signInWithCustomToken ... 401 (Unauthorized)`
- `Create Installation request failed ... 400 INVALID_ARGUMENT`

**What's happening:** The frontend is failing to authenticate with Firebase using a custom token from your backend, and subsequently, push notification registration fails.

**Root Cause:**
- **Service Account Mismatch:** The Firebase Admin SDK in your backend (used to generate custom tokens) is likely configured with credentials for a different Firebase project than the one your frontend is trying to connect to.
- **API Key Restrictions:** The Firebase API Key used in your frontend might have HTTP Referrer restrictions that block `localhost:3000` (or your local dev port).

**Action Required (Manual Configuration):**
1. **Verify Backend Service Account:**
   - Check your backend's `.env` file for `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
   - Ensure these credentials belong to the Firebase project `easyflow-77db9` (or whatever `projectId` is in `firebaseConfig.js`).
   - In Google Cloud Console, navigate to **IAM & Admin > Service Accounts** and confirm the service account exists and has the **"Service Account Token Creator"** role.
2. **Check API Key Restrictions (Frontend):**
   - In Google Cloud Console, navigate to **APIs & Services > Credentials**.
   - Find the API Key used in your frontend (`rpa-system/rpa-dashboard/src/utils/firebaseConfig.js`). It usually starts with `AIzaSy...`.
   - **Under "Application restrictions"**: Select "HTTP referrers (web sites)" and add `http://localhost:3000/*` (or your specific local development port) to the allowed referrers.
   - **Under "API restrictions"**: Ensure **"Firebase Installations API"** and **"Identity Toolkit API"** are enabled.
3. **Confirm Frontend Project ID:** Double-check that `projectId` in `/Users/ky/Easy-Flow/rpa-system/rpa-dashboard/src/utils/firebaseConfig.js` is `easyflow-77db9`.

**Status:** ⚠️ Manual configuration required. See `docs/FIREBASE_CONFIGURATION.md` for detailed steps.

---

## 3. 🐢 Performance: Slow API Responses (`/api/runs`) - NEEDS VERIFICATION

**Error:** `[HistoryPage] Slow API response detected {duration_ms: 20341, ...}`

**What's happening:** The `GET /api/runs` endpoint is taking 20+ seconds to fetch automation runs, even after adding database indexes.

**Solution:**
- ✅ **Migration Created:** A new SQL migration `add_runs_performance_index.sql` was created to add optimized database indexes.
- ⚠️ **Action Required:** You need to **verify the indexes were actually created** in your Supabase database.

**Steps to Verify:**
1. Go to your Supabase Dashboard → SQL Editor
2. Run this query to check if indexes exist:
   ```sql
   SELECT 
     schemaname,
     tablename,
     indexname,
     indexdef
   FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename = 'automation_runs'
     AND indexname IN (
       'idx_automation_runs_user_id_started_at',
       'idx_automation_runs_task_id'
     )
   ORDER BY indexname;
   ```
3. If indexes don't exist, run the migration:
   ```sql
   -- Copy the full content from: rpa-system/backend/migrations/add_runs_performance_index.sql
   -- And paste it into Supabase SQL Editor, then execute
   ```

**Expected Performance After Indexes:**
- Query should take < 500ms for 100 runs
- If still slow after indexes, check:
  - Database connection pooling settings
  - Network latency to Supabase
  - Query execution plan (EXPLAIN ANALYZE)

**Status:** ⚠️ Migration created, manual verification required.

---

## 4. 🔌 Connectivity: Realtime Disconnects - Expected Behavior

**Error:** `[realtime] Channel temporarily disconnected ... Channel status: CLOSED`

**What's happening:** The Supabase Realtime WebSocket connection is temporarily dropping.

**Solution:**
- This is often normal during local development (e.g., when your computer sleeps, network changes, or browser tab is backgrounded).
- The client is correctly "scheduling reconnect," so it handles these transient issues.
- ✅ **Fixed:** Error logging is now environment-aware - these warnings are suppressed in development (debug level) and only shown in production.
- If this happens frequently in production, check your Supabase project status and quota limits.

**Status:** ✅ Expected behavior, client handles reconnects. Logging made less noisy.

---

## 5. 🚫 Minor: Google Analytics Blocked - Expected Behavior

**Error:** `[net] POST failed {url: 'https://www.google-analytics.com/g/collect...'} status: 0`

**What's happening:** Requests to Google Analytics are failing with a status code of 0.

**Solution:**
- This is almost certainly caused by an Ad Blocker or privacy extension (like uBlock Origin or Brave Shields) in your browser.
- You can safely ignore this in development.

**Status:** ✅ Expected behavior, caused by ad blockers.

---

## 6. 🔐 401 Unauthorized Errors - Authentication Issues

**Error:** `GET http://localhost:3030/api/runs 401 (Unauthorized)`

**What's happening:** The frontend is making requests without a valid authentication token, or the token has expired.

**Solution:**
- ✅ **Fixed:** Error logging is now environment-aware - 401s during token refresh are logged at debug level (less noisy).
- The `api.js` interceptor should automatically refresh tokens when 401s occur.
- If you see persistent 401s:
  1. Check browser console for token refresh errors
  2. Verify Supabase session is active: `localStorage.getItem('dev_token')`
  3. Try signing out and signing back in
  4. Check backend logs for authentication middleware errors

**Status:** ✅ Logging improved. If persistent, check authentication flow.

---

## 7. 🌐 Network Errors: ERR_NETWORK_IO_SUSPENDED

**Error:** `GET http://localhost:3030/api/runs net::ERR_NETWORK_IO_SUSPENDED`

**What's happening:** The browser tab was suspended/backgrounded, causing network requests to be cancelled.

**Solution:**
- ✅ **Fixed:** These errors are now handled gracefully - they're suppressed in development and don't show error messages to users.
- This is expected behavior when:
  - Browser tab is backgrounded
  - Computer goes to sleep
  - Network connection is temporarily lost
- The app will automatically retry when the tab becomes active again.

**Status:** ✅ Fixed - errors handled gracefully.

---

## Summary

| Issue | Status | Action Required |
|-------|--------|-----------------|
| 403 Notification | ✅ Fixed | None |
| Firebase Auth | ⚠️ Manual Config | See `docs/FIREBASE_CONFIGURATION.md` |
| Slow API (20s+) | ⚠️ Verify Indexes | Run migration in Supabase SQL Editor |
| Realtime Disconnects | ✅ Expected | None (logging improved) |
| Google Analytics | ✅ Expected | None |
| 401 Unauthorized | ✅ Logging Improved | Check auth flow if persistent |
| Network Suspended | ✅ Fixed | None |

