# Realtime Channels - Quick Reference Card

## 🚨 Copy/Paste Fixes

### Fix #1: Diagnose Issue (Run in Browser Console)
```javascript
(async function diagnose() {
  const client = window._supabase;
  if (!client) return console.error('❌ Supabase client not found');
  
  console.log('=== REALTIME DIAGNOSTICS ===\n');
  
  const { data } = await client.auth.getSession();
  console.log('Session:', data?.session ? '✅ Active' : '❌ None');
  
  const hasToken = !!(client.realtime?._accessToken || client.realtime?.accessToken);
  console.log('Realtime Token:', hasToken ? '✅ Present' : '⚠️ MISSING');
  
  const channels = Object.keys(client.realtime?.channels || {});
  console.log(`\nChannels (${channels.length}):`);
  channels.forEach(name => {
    const state = client.realtime.channels[name]?.state;
    const emoji = state === 'joined' ? '✅' : '❌';
    console.log(`  ${emoji} ${name}: ${state}`);
  });
  
  console.log('\n=== END ===');
})();
```

### Fix #2: Set Auth Token (Run in Browser Console)
```javascript
(async function fixToken() {
  const client = window._supabase;
  const { data } = await client.auth.getSession();
  if (data?.session?.access_token) {
    client.realtime.setAuth(data.session.access_token);
    console.log('✅ Token set! Reloading...');
    setTimeout(() => window.location.reload(), 2000);
  } else {
    console.error('❌ No session. Please sign in.');
  }
})();
```

### Fix #3: Configure Database (Run in Supabase SQL Editor)
```sql
-- Add tables to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS usage_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS workflow_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS workflows;

-- Set replica identity
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE usage_tracking REPLICA IDENTITY FULL;
ALTER TABLE workflow_executions REPLICA IDENTITY FULL;
ALTER TABLE workflows REPLICA IDENTITY FULL;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Add read policies
CREATE POLICY IF NOT EXISTS "Users can read own profile"
ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can read own usage"
ON usage_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can read own executions"
ON workflow_executions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can read own workflows"
ON workflows FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Verify
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

## ✅ Success Criteria

After fix, you should see in console:
```
✅ plan-changes-{user-id} SUBSCRIBED successfully
✅ usage-updates-{user-id} SUBSCRIBED successfully
✅ executions-{user-id} SUBSCRIBED successfully
✅ workflows-{user-id} SUBSCRIBED successfully
✅ plan-notifications SUBSCRIBED successfully
```

## 🔍 Quick Checks

**Check auth status:**
```javascript
await window._supabase?.auth.getSession()
```

**Check realtime channels:**
```javascript
Object.keys(window._supabase?.realtime?.channels || {})
```

**Force reconnect:**
```javascript
window.location.reload()
```

## 📚 Full Documentation

- **Step-by-step guide:** `FIX_REALTIME_CHANNELS.md`
- **Troubleshooting:** `REALTIME_TROUBLESHOOTING_GUIDE.md`
- **Scripts:** `scripts/` directory

## 🆘 Still Issues?

1. Check Supabase status: https://status.supabase.com
2. Run full diagnostics from `FIX_REALTIME_CHANNELS.md`
3. Check browser console for specific error messages
4. See "Still Having Issues?" section in fix guide

---

**Estimated Fix Time:** 5-15 minutes  
**Last Updated:** 2025-12-04
