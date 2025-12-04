# Realtime Channel Troubleshooting Guide

## Overview
This guide explains the realtime channel warning/error messages appearing in your application console and provides systematic troubleshooting steps to resolve connection issues.

---

## 🔍 Understanding the Error Messages

### 1. `[Realtime] Cleaned up and removed {channel} for retry due to CLOSED`
**Meaning:** The WebSocket connection for this channel closed unexpectedly. The system is cleaning up the old channel instance before attempting to reconnect.

**Common Causes:**
- Network interruption or unstable connection
- Supabase/backend service temporarily unavailable
- WebSocket connection timeout
- Client computer went to sleep/hibernation

### 2. `⚠️ Realtime channel {channel} disconnected; attempting reconnect #N in Xms`
**Meaning:** The channel disconnected and the system is using exponential backoff to reconnect. Retry #N means this is the Nth reconnection attempt.

**Common Causes:**
- Transient network issues
- Brief backend service interruption
- Load balancer health check timeout
- Token expiration (if attempt persists after token refresh)

### 3. `❌ {channel} entered error state: undefined. Category: UNKNOWN`
**Meaning:** The channel received an error without a specific error message. This is categorized as UNKNOWN and treated as a transient error.

**Common Causes:**
- WebSocket closed abnormally (code 1006)
- Network dropped packets before error details arrived
- Browser/system killed the connection unexpectedly
- Supabase Realtime service had an internal error

### 4. `🔄 Transient error on {channel}. Scheduling reconnect...`
**Meaning:** The system detected a transient (temporary) error and will attempt to reconnect with exponential backoff.

**Common Causes:**
- Network connectivity issues (Wi-Fi drop, switching networks)
- Backend experiencing high load or restarting
- CDN or proxy issues between client and Supabase

---

## 🎯 Why Some Channels Work (e.g., plan-notifications)

**Broadcast vs Postgres Changes:**
- `plan-notifications`: Uses **broadcast** channel (lighter weight, doesn't require database filters)
- Other channels: Use **postgres_changes** which requires:
  - Valid database schema/tables
  - Proper RLS (Row Level Security) policies
  - Active authentication token
  - Replication publication configuration

**Success Factors for plan-notifications:**
1. No database-level dependencies
2. No per-user filtering (broadcast to all subscribers)
3. Simpler connection requirements
4. Less affected by token/permission issues

---

## 🛠️ Systematic Troubleshooting Steps

### Step 1: Check Authentication Status

**Problem:** Expired or missing JWT tokens cause channel errors

**Diagnosis:**
```javascript
// Open browser console and check:
window._supabase?.auth.getSession().then(({data, error}) => {
  console.log('Session:', data.session ? 'Active' : 'None', error);
});
```

**Resolution:**
1. Sign out and sign back in
2. Clear localStorage: `localStorage.clear()` (then refresh and re-login)
3. Check if tokens are refreshing properly in Network tab (look for `token` requests)

**Expected Behavior:** Tokens auto-refresh every 50 minutes (per `supabaseClient.js:219`)

---

### Step 2: Verify Backend Service Status

**Problem:** Backend API or Supabase is down/unreachable

**Diagnosis:**
```bash
# Check if Supabase is responding
curl https://YOUR_PROJECT.supabase.co/rest/v1/

# Check local backend (if using dev mode)
curl http://localhost:3030/api/health

# Check realtime service specifically
curl https://YOUR_PROJECT.supabase.co/realtime/v1/websocket
```

**Resolution:**
1. Verify `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are set correctly
2. Check Supabase project status at https://status.supabase.com
3. Restart local backend if in development mode
4. Verify firewall/proxy isn't blocking WebSocket connections (port 443/4000)

---

### Step 3: Inspect Network Connectivity

**Problem:** Unstable network or WebSocket connections being blocked

**Diagnosis:**
1. Open Chrome DevTools → Network tab
2. Filter by `WS` (WebSocket)
3. Look for realtime connections with status codes:
   - **101 Switching Protocols**: Good (connection upgraded)
   - **403 Forbidden**: Auth/permission issue
   - **502/503**: Backend unavailable
   - **1006 Abnormal Closure**: Network interrupted

**Resolution:**
1. **For corporate networks:** Check if WebSocket connections are allowed
2. **For VPN users:** Try disabling VPN temporarily
3. **For proxy users:** Configure proxy to allow WebSocket upgrade
4. **Browser extensions:** Disable ad blockers or privacy extensions temporarily

---

### Step 4: Verify Database Configuration

**Problem:** Missing tables, columns, or incorrect RLS policies

**Diagnosis:**
Check Supabase SQL Editor or run:
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows');

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows');

-- Verify publication exists (required for realtime)
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

**Resolution:**
1. Run database migrations if tables are missing
2. Add RLS policies allowing authenticated users to SELECT their own data:
   ```sql
   -- Example for profiles table
   CREATE POLICY "Users can read own profile"
   ON profiles FOR SELECT
   TO authenticated
   USING (auth.uid() = id);
   ```
3. Ensure tables are added to realtime publication:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
   ALTER PUBLICATION supabase_realtime ADD TABLE usage_tracking;
   ALTER PUBLICATION supabase_realtime ADD TABLE workflow_executions;
   ALTER PUBLICATION supabase_realtime ADD TABLE workflows;
   ```

---

### Step 5: Review Browser Console for Specific Errors

**Diagnosis:**
Look for patterns in the console logs:

**Pattern A: Repeated reconnects with increasing delays**
```
⚠️ Realtime channel plan-changes-{id} disconnected; attempting reconnect #1 in 1000ms
⚠️ Realtime channel plan-changes-{id} disconnected; attempting reconnect #2 in 2000ms
⚠️ Realtime channel plan-changes-{id} disconnected; attempting reconnect #3 in 4000ms
```
→ **Indicates:** Persistent connection issue (network, backend, or auth)

**Pattern B: Immediate errors on all channels**
```
❌ plan-changes-{id} entered error state: permission denied. Category: AUTH_ISSUE
❌ usage-updates-{id} entered error state: permission denied. Category: AUTH_ISSUE
```
→ **Indicates:** Authentication or RLS policy problem

**Pattern C: Specific table errors**
```
❌ executions-{id} entered error state: relation "workflow_executions" does not exist. Category: FATAL_PERMANENT
```
→ **Indicates:** Database schema issue

---

### Step 6: Check Realtime Status in Code

**Diagnosis:**
```javascript
// In a React component that uses useRealtimeSync:
const { realtimeStatus, channels } = useRealtimeSync({...});

console.log('Overall status:', realtimeStatus);
console.log('Channel details:', channels);

// Expected statuses:
// - 'connected': All good
// - 'connecting': Initial connection or reconnecting
// - 'degraded': Some channels failed, using polling
// - 'disconnected': No connection
// - 'error': Active error state
```

**Resolution based on status:**
- **'connecting' for >30 seconds**: Network/firewall issue
- **'degraded'**: Check which specific channels are failing
- **'error'**: Check last error message in channel details

---

### Step 7: Test Token Propagation

**Problem:** Realtime auth token not set or out of sync

**Diagnosis:**
```javascript
// Check if realtime has auth token set
console.log('Realtime auth token:', 
  window._supabase?.realtime?._accessToken ? 'Present' : 'Missing'
);
```

**Resolution:**
The system automatically sets the token in two places:
1. **Initial load:** `supabaseClient.js:184-200` seeds token from localStorage
2. **Token refresh:** `supabaseClient.js:206-223` updates on auth state change

If token is missing:
```javascript
// Manually trigger auth update
const { data } = await supabase.auth.getSession();
if (data.session?.access_token) {
  supabase.realtime.setAuth(data.session.access_token);
  console.log('Token manually set');
}
```

---

### Step 8: Enable Debug Logging

**Problem:** Need more detailed information about what's happening

**Enable verbose logging:**
```javascript
// Add to browser console or component:
localStorage.setItem('supabase.debug', 'true');

// Then reload the page and watch for detailed logs prefixed with:
// [Realtime] 
// [Supabase]
// [usePlan]
```

**Key logs to look for:**
- `[Realtime] Auth token updated for all channels` ✅
- `[Realtime] No active session - channels may fail` ⚠️
- `[Realtime] Cleaned up and removed {channel}` (cleanup before retry)
- `✅ {channel} SUBSCRIBED successfully` (success!)

---

### Step 9: Check for Max Retry Exhaustion

**Problem:** Channel permanently failed after 5 attempts

**Diagnosis:**
```javascript
// Look for these errors in console:
// ❌ Realtime: Connection FAILED for {channel} after 5 retries. Setting permanent_error.
```

**Resolution:**
1. This indicates a persistent problem, not a transient issue
2. Check earlier error messages to identify the root cause
3. Fix the underlying issue (auth, database config, etc.)
4. Force reconnection:
   ```javascript
   // Option 1: Refresh the page
   window.location.reload();
   
   // Option 2: Sign out and back in
   await supabase.auth.signOut();
   // Then sign in again
   ```

---

### Step 10: Test Fallback Polling

**Problem:** Realtime permanently failed, but app should still work

**Verification:**
```javascript
// Check if fallback polling is active
const { shouldFallbackToPolling, realtimeStatus } = useRealtimeSync({...});

console.log('Using polling fallback:', shouldFallbackToPolling);
console.log('Realtime status:', realtimeStatus); // Should be 'degraded'
```

**Expected behavior:**
- App continues to work (fetches data every 30 seconds)
- UI shows "degraded" status indicator
- Less responsive than realtime, but functional

---

## 🔧 Common Fixes by Error Category

### AUTH_ISSUE Errors
```
❌ {channel} entered error state: permission denied
❌ {channel} entered error state: jwt expired
```

**Fix:**
1. Sign out and back in
2. Verify RLS policies allow `authenticated` role
3. Check token refresh is working:
   ```sql
   -- In Supabase SQL editor
   SELECT auth.jwt();
   -- Should return valid JWT
   ```

### TRANSIENT Errors
```
❌ {channel} entered error state: network error
❌ {channel} entered error state: timeout
```

**Fix:**
1. Check internet connectivity
2. Wait for automatic reconnection (up to 30 seconds)
3. If persists, restart router/switch networks
4. Check if backend is under heavy load

### FATAL_PERMANENT Errors
```
❌ {channel} entered error state: table "X" does not exist
❌ {channel} entered error state: column "Y" does not exist
```

**Fix:**
1. Run database migrations
2. Verify table/column names match code expectations
3. Restart application after fixing schema

### FATAL_CONFIG Errors
```
❌ {channel} entered error state: not in publication
❌ {channel} entered error state: insufficient replica identity
```

**Fix:**
1. Add tables to publication:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
   ```
2. Set replica identity:
   ```sql
   ALTER TABLE your_table REPLICA IDENTITY FULL;
   ```

---

## 🧪 Testing & Verification

### After Fixing Issues

**1. Clear browser state:**
```javascript
localStorage.clear();
sessionStorage.clear();
// Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

**2. Monitor connection establishment:**
```javascript
// Watch for these success messages:
// ✅ plan-changes-{id} SUBSCRIBED successfully
// ✅ usage-updates-{id} SUBSCRIBED successfully
// ✅ executions-{id} SUBSCRIBED successfully
// ✅ workflows-{id} SUBSCRIBED successfully
// ✅ plan-notifications SUBSCRIBED successfully
```

**3. Test channel stability:**
1. Leave app open for 10+ minutes
2. Put computer to sleep, wake up (tests reconnection)
3. Switch networks (tests network change handling)
4. Open DevTools → Network → Throttle to "Slow 3G" → Switch back to "No throttling"

**4. Verify realtime data flow:**
- Make a change in Supabase dashboard (e.g., update a profile field)
- Should see console log within 1-2 seconds:
  ```
  Plan changed in realtime: {...}
  ```

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

**In your app:**
```javascript
const {
  realtimeStatus,        // Overall connection health
  channels,              // Per-channel status
  shouldFallbackToPolling // Whether degraded mode is active
} = useRealtimeSync({...});

// Display status indicator in UI:
// 🟢 connected = All good
// 🟡 connecting/degraded = Some issues
// 🔴 disconnected = No connection
```

**Expected baseline:**
- **Normal:** `realtimeStatus = 'connected'`, all channels `state: 'subscribed'`
- **During reconnect:** `realtimeStatus = 'connecting'` for <10 seconds
- **Degraded:** `shouldFallbackToPolling = true` indicates permanent failure

---

## 🚀 Prevention & Best Practices

### 1. Implement Circuit Breakers
The codebase already includes:
- Max 5 retries before permanent failure (`useRealtimeSync.js:20`)
- Exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
- Automatic fallback to polling after permanent failure

### 2. Token Refresh Handling
Already implemented:
- Auto-refresh every 50 minutes (Firebase tokens: `notificationService.js:219`)
- Supabase tokens auto-refresh via SDK
- Realtime auth updated on token refresh (`supabaseClient.js:214`)

### 3. Graceful Degradation
The app is designed to work even if realtime fails:
- Polling fallback (30-second intervals)
- Cached data from last successful fetch
- User-visible status indicators

### 4. Connection State Management
Implemented state machine per channel:
- `idle` → `connecting` → `subscribed` ✅
- `error` → `reconnecting` → `subscribed` ✅
- `reconnecting` → (after 5 retries) → `permanent_error` → `fallback_polling`

---

## 🐛 Edge Cases & Known Issues

### Issue 1: Computer Sleep/Wake
**Symptom:** All channels disconnect after waking from sleep

**Why:** WebSocket connections don't survive sleep on most systems

**Fix:** Already handled! The system detects disconnection and automatically reconnects within 1-2 seconds.

### Issue 2: Token Expiration During Active Session
**Symptom:** Channels disconnect exactly 1 hour after login

**Why:** JWT tokens expire (default 1 hour for Supabase)

**Fix:** Already handled! Auth state listener refreshes tokens automatically (`supabaseClient.js:206`).

### Issue 3: Rapid Tab Switching
**Symptom:** Channels disconnect when switching away from tab for extended period

**Why:** Browsers throttle background tabs, WebSocket heartbeats may fail

**Fix:** On visibility change, auth token is re-validated and channels reconnect if needed.

### Issue 4: Corporate Proxy/Firewall
**Symptom:** All channels fail immediately with network errors

**Why:** WebSocket upgrade requests blocked by proxy

**Fix:** 
1. Work with IT to whitelist `*.supabase.co` and allow WebSocket (protocol upgrade)
2. Use polling fallback mode (already implemented)
3. Consider using HTTP-based alternatives if available

---

## 📝 Quick Reference: Error Code Meanings

| Error Message | Category | Action | Retry? |
|--------------|----------|--------|--------|
| `permission denied` | AUTH_ISSUE | Refresh token, check RLS | Yes (after fix) |
| `jwt expired` | AUTH_ISSUE | Auto-refresh token | Yes (automatic) |
| `table does not exist` | FATAL_PERMANENT | Fix schema | No (need fix) |
| `network error` | TRANSIENT | Wait/retry | Yes (automatic) |
| `timeout` | TRANSIENT | Wait/retry | Yes (automatic) |
| `CLOSED` | TRANSIENT | Reconnect | Yes (automatic) |
| `CHANNEL_ERROR` | UNKNOWN | Treat as transient | Yes (automatic) |
| `not in publication` | FATAL_CONFIG | Add to publication | No (need fix) |

---

## 💡 Developer Tips

### Debugging Commands
```javascript
// 1. Check realtime connection status
window._supabase?.realtime?.channels

// 2. See all active subscriptions
Object.keys(window._supabase?.realtime?.channels || {})

// 3. Get current auth status
await window._supabase?.auth.getSession()

// 4. Force reconnect all channels
window.location.reload() // Nuclear option

// 5. Check if backend is reachable
fetch('/api/health').then(r => r.json()).then(console.log)
```

### Testing Scenarios
```javascript
// Simulate network disconnect
// Chrome DevTools → Network → Offline (checkbox)

// Simulate slow network
// Chrome DevTools → Network → Throttling → Slow 3G

// Simulate token expiration
localStorage.removeItem('sb-auth-token');
// Then trigger any authenticated action

// Force error state for testing
// Temporarily break RLS policy in Supabase, attempt to subscribe
```

---

## 🆘 When to Escalate

Contact support if you see:

1. **All channels permanently failing** after following this guide
2. **Error category: FATAL_PERMANENT** on correctly configured tables
3. **Infinite reconnection loops** (>10 attempts without success)
4. **Supabase service status** showing outages at https://status.supabase.com
5. **Browser console showing CORS errors** related to Supabase

**Include in your support request:**
- Full console logs from page load to error
- Output of `window._supabase?.auth.getSession()`
- Supabase project ID
- Browser version and OS
- Network environment (corporate, VPN, home, etc.)

---

## ✅ Success Checklist

After troubleshooting, verify:
- [ ] All 5 channels show `state: 'subscribed'` in console
- [ ] `realtimeStatus` is `'connected'`
- [ ] No error messages in console for >5 minutes
- [ ] Making a change in Supabase dashboard triggers realtime update
- [ ] After computer sleep/wake, channels reconnect within 10 seconds
- [ ] Token refresh events show "Realtime auth token updated"
- [ ] Page visibility changes don't break connection
- [ ] Network throttling temporarily disconnects, then recovers

---

**Last Updated:** 2025-12-03  
**Version:** 1.0 (Based on `useRealtimeSync.js` and `supabaseClient.js`)
