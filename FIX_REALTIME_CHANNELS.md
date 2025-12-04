# Fix Realtime Channels - Step-by-Step Guide

**Issue:** Realtime channels showing CLOSED/error states with reconnection attempts

**Common Causes:** Missing auth token, database not configured for realtime, RLS policies blocking access

**Time to Fix:** 5-15 minutes

---

## 🚀 Quick Start (Try This First)

### Option A: Browser Console Quick Fix

1. **Open your app** in the browser (Chrome/Firefox/Safari)
2. **Open Developer Console** (F12 or Cmd+Option+I on Mac)
3. **Copy and paste this diagnostic script:**

```javascript
(async function diagnose() {
  console.log('=== REALTIME DIAGNOSTICS ===\n');
  
  const client = window._supabase;
  if (!client) {
    console.error('❌ Supabase client not found on window._supabase');
    return;
  }
  console.log('✅ Supabase client found');
  
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error('❌ Session error:', error.message);
    } else if (data?.session) {
      console.log('✅ Active session found');
      console.log('   User ID:', data.session.user.id);
      
      const now = Date.now() / 1000;
      if (data.session.expires_at < now) {
        console.warn('⚠️  Token is EXPIRED');
      } else {
        const ttl = Math.round((data.session.expires_at - now) / 60);
        console.log(`   Token valid for ${ttl} more minutes`);
      }
    } else {
      console.error('❌ No active session');
    }
  } catch (e) {
    console.error('❌ Error checking session:', e.message);
  }
  
  const realtime = client.realtime;
  if (!realtime) {
    console.error('❌ Realtime not available');
    return;
  }
  console.log('✅ Realtime object exists');
  
  const realtimeToken = realtime._accessToken || realtime.accessToken;
  if (realtimeToken) {
    console.log('✅ Realtime has auth token set');
  } else {
    console.warn('⚠️  Realtime auth token MISSING');
  }
  
  const channels = Object.keys(realtime.channels || {});
  console.log(`\n📡 Active channels (${channels.length}):`);
  
  if (channels.length === 0) {
    console.warn('⚠️  No channels subscribed');
  } else {
    channels.forEach(channelName => {
      const channel = realtime.channels[channelName];
      const state = channel?.state || 'unknown';
      const stateEmoji = state === 'joined' ? '✅' : state === 'joining' ? '🔄' : '❌';
      console.log(`   ${stateEmoji} ${channelName}: ${state}`);
    });
  }
  
  console.log('\n=== END DIAGNOSTICS ===');
})();
```

4. **Read the output** and follow the recommendations below based on what you see

---

## 📋 Step-by-Step Fixes

### Fix 1: Missing or Expired Auth Token

**If diagnostics show:** `❌ No active session` or `⚠️ Token is EXPIRED`

**Solution:**
1. Sign out of the application
2. Clear browser cache/storage (or just localStorage)
3. Sign back in
4. Run diagnostics again

**Alternative (without signing out):**
```javascript
// In browser console:
(async function fixToken() {
  const client = window._supabase;
  const { data } = await client.auth.getSession();
  if (data?.session?.access_token) {
    client.realtime.setAuth(data.session.access_token);
    console.log('✅ Token set! Reloading page...');
    setTimeout(() => window.location.reload(), 2000);
  } else {
    console.error('❌ No session found. Please sign in.');
  }
})();
```

---

### Fix 2: Realtime Token Not Set

**If diagnostics show:** `⚠️ Realtime auth token MISSING` (but session exists)

**Solution - Run this in browser console:**
```javascript
(async function fixRealtimeToken() {
  console.log('🔧 Attempting to fix realtime token...\n');
  
  const client = window._supabase;
  if (!client) {
    console.error('❌ Supabase client not found');
    return;
  }
  
  try {
    const { data, error } = await client.auth.getSession();
    
    if (error || !data?.session) {
      console.error('❌ No active session. Please sign in first.');
      return;
    }
    
    const token = data.session.access_token;
    console.log('✅ Found session token');
    
    if (client.realtime && typeof client.realtime.setAuth === 'function') {
      client.realtime.setAuth(token);
      console.log('✅ Token set on realtime connection');
    }
    
    console.log('\n🎉 Fix complete! Refreshing page...');
    setTimeout(() => window.location.reload(), 2000);
    
  } catch (e) {
    console.error('❌ Fix failed:', e.message);
  }
})();
```

---

### Fix 3: Database Configuration Issues

**If diagnostics show channels but state is not `joined`**

**You need to configure Supabase database for realtime:**

#### Step 3.1: Check Current Configuration

1. Go to your **Supabase Dashboard** (https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Run this check script:

```sql
-- Check if tables exist
SELECT 
  table_name,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows')
ORDER BY table_name;

-- Check realtime publication
SELECT 
  schemaname,
  tablename,
  'IN PUBLICATION' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows')
ORDER BY tablename;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command
FROM pg_policies 
WHERE tablename IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows')
ORDER BY tablename, policyname;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows')
ORDER BY tablename;
```

#### Step 3.2: Apply Fixes (if needed)

**If any tables are missing from realtime publication, run:**

```sql
-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS usage_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS workflow_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS workflows;

-- Set replica identity
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE usage_tracking REPLICA IDENTITY FULL;
ALTER TABLE workflow_executions REPLICA IDENTITY FULL;
ALTER TABLE workflows REPLICA IDENTITY FULL;

-- Verify
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

**If RLS policies are missing, run:**

```sql
-- Enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Add read policies for authenticated users
CREATE POLICY IF NOT EXISTS "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can read own usage"
ON usage_tracking FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can read own executions"
ON workflow_executions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can read own workflows"
ON workflows FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

**Verify everything is set up:**
```sql
-- All 4 tables should appear
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows');

-- Should show at least 4 SELECT policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows')
AND cmd = 'SELECT';

-- All should show TRUE for rls_enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows');
```

---

### Fix 4: Network/Firewall Issues

**If diagnostics show:** All checks pass but channels still don't connect

**Check network connectivity:**

1. **Open DevTools** → **Network tab**
2. **Filter by** `WS` (WebSocket)
3. **Look for** connections to Supabase realtime
4. **Check status codes:**
   - `101 Switching Protocols` = Good ✅
   - `403 Forbidden` = Auth issue ❌
   - `502/503` = Backend down ❌
   - `Failed to connect` = Firewall/proxy blocking ❌

**Solutions:**
- **Corporate network:** Ask IT to whitelist `*.supabase.co` and allow WebSocket
- **VPN users:** Try disabling VPN temporarily
- **Proxy users:** Configure proxy to allow WebSocket upgrade
- **Browser extensions:** Disable ad blockers temporarily

---

## ✅ Verification Steps

After applying fixes, verify everything works:

### 1. Clear Browser State
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
```
Then **hard refresh** the page: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### 2. Check Console Logs

You should see these success messages within 10 seconds:
```
✅ plan-changes-{your-user-id} SUBSCRIBED successfully
✅ usage-updates-{your-user-id} SUBSCRIBED successfully
✅ executions-{your-user-id} SUBSCRIBED successfully
✅ workflows-{your-user-id} SUBSCRIBED successfully
✅ plan-notifications SUBSCRIBED successfully
```

### 3. Test Realtime Updates

1. Keep your app open with console visible
2. Go to **Supabase Dashboard** → **Table Editor**
3. Find your profile record and change any field (e.g., `plan_id`)
4. **Within 2 seconds**, you should see console log:
   ```
   Plan changed in realtime: {...}
   ```

### 4. Test Reconnection

1. Open **DevTools** → **Network** tab
2. Check **Offline** checkbox (simulates network disconnect)
3. Wait 5 seconds
4. Uncheck **Offline**
5. **Within 10 seconds**, channels should reconnect automatically

---

## 🔍 Debugging Tips

### Check Realtime Connection State
```javascript
// In browser console:
const client = window._supabase;
const channels = client?.realtime?.channels || {};
Object.entries(channels).forEach(([name, ch]) => {
  console.log(`${name}: ${ch.state}`);
});
```

### Force Reconnect
```javascript
// Nuclear option - reload page
window.location.reload();

// Or sign out and back in
await window._supabase.auth.signOut();
// Then sign in manually
```

### Check if Backend is Reachable
```javascript
// Check Supabase REST API
fetch('YOUR_SUPABASE_URL/rest/v1/')
  .then(r => console.log('✅ REST API reachable'))
  .catch(e => console.error('❌ REST API unreachable:', e));

// Check local backend (if in dev)
fetch('http://localhost:3030/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(e => console.error('❌ Local backend unreachable:', e));
```

### Enable Debug Logging
```javascript
localStorage.setItem('supabase.debug', 'true');
// Reload page to see detailed logs
```

---

## 📊 Expected Results

After successful fix:

| Metric | Expected Value |
|--------|---------------|
| **Realtime Status** | `connected` |
| **All 5 Channels** | `state: 'subscribed'` or `state: 'joined'` |
| **Error Messages** | None for 5+ minutes |
| **Update Latency** | <2 seconds from DB change to app update |
| **Sleep/Wake Recovery** | <10 seconds |
| **Token Refresh** | Automatic every 50 mins (no visible errors) |

---

## 🆘 Still Having Issues?

If problems persist after trying all fixes:

### 1. Check Supabase Service Status
Visit: https://status.supabase.com

### 2. Collect Diagnostic Info

Run this in browser console and save the output:
```javascript
(async function collectDiagnostics() {
  const client = window._supabase;
  const info = {
    timestamp: new Date().toISOString(),
    clientExists: !!client,
    realtimeExists: !!client?.realtime,
    supabaseUrl: client?.supabaseUrl,
    hasAnonKey: !!client?.supabaseKey,
  };
  
  try {
    const { data } = await client.auth.getSession();
    info.hasSession = !!data?.session;
    info.userId = data?.session?.user?.id;
    info.tokenExpiry = data?.session?.expires_at;
  } catch (e) {
    info.sessionError = e.message;
  }
  
  info.channels = Object.keys(client?.realtime?.channels || {}).map(name => ({
    name,
    state: client.realtime.channels[name]?.state
  }));
  
  console.log('=== DIAGNOSTICS INFO ===');
  console.log(JSON.stringify(info, null, 2));
  console.log('=== END DIAGNOSTICS ===');
  
  return info;
})();
```

### 3. Contact Support

Include:
- Output from diagnostics script above
- Browser version and OS
- Network environment (home/corporate/VPN)
- Supabase project ID
- Full console logs from page load to error

---

## 📚 Additional Resources

- **Full Troubleshooting Guide:** `REALTIME_TROUBLESHOOTING_GUIDE.md`
- **Supabase Realtime Docs:** https://supabase.com/docs/guides/realtime
- **RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security

---

**Last Updated:** 2025-12-04  
**Quick Fix Time:** 5 minutes  
**Full Fix Time:** 15 minutes (including database configuration)
