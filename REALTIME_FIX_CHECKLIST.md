# Supabase Realtime Fix - Action Checklist

## ✅ COMPLETED - Diagnostic Phase

- [x] Identified root cause: REPLICA IDENTITY DEFAULT on all realtime tables
- [x] Verified systematic diagnosis:
  - Tables in `supabase_realtime` publication ✅
  - All columns exist ✅
  - RLS policies correct ✅
  - **REPLICA IDENTITY = DEFAULT** ❌ (root cause)
- [x] Implemented robust error handling in frontend:
  - Fatal error detection
  - Polling fallback for broken channels
  - Circuit breaker to prevent cascading failures
  - Proper async channel cleanup
- [x] Created comprehensive documentation

---

## 🔧 TODO - Apply Database Fix

### Step 1: Run SQL Fix in Supabase Dashboard

Go to: **Supabase Dashboard → SQL Editor**

```sql
-- Fix the root cause
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE usage_tracking REPLICA IDENTITY FULL;
ALTER TABLE workflow_executions REPLICA IDENTITY FULL;
ALTER TABLE workflows REPLICA IDENTITY FULL;
```

### Step 2: Verify Fix Applied

```sql
SELECT
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN '❌ DEFAULT (broken)'
    WHEN 'f' THEN '✅ FULL (fixed)'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'usage_tracking', 'workflow_executions', 'workflows')
ORDER BY c.relname;
```

**Expected output:**
```
table_name              | status
-----------------------|-------------
profiles               | ✅ FULL
usage_tracking         | ✅ FULL
workflow_executions    | ✅ FULL
workflows              | ✅ FULL
```

### Step 3: Test in Browser

1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
2. Open DevTools Console
3. Verify you see:
   ```
   ✅ plan-changes-... SUBSCRIBED successfully
   ✅ usage-updates-... SUBSCRIBED successfully
   ✅ executions-... SUBSCRIBED successfully
   ✅ workflows-... SUBSCRIBED successfully
   ```
4. Confirm NO MORE errors:
   ```
   ❌ ... entered error state: CLOSED
   ❌ Error: mismatch between server and client bindings
   ```

---

## 📊 Expected Impact

**Before Fix:**
- All postgres_changes channels: SUBSCRIBED → immediately CLOSED
- Continuous "mismatch between server and client bindings" errors
- Reconnection loops with exponential backoff
- Only broadcast channel (plan-notifications) working

**After Fix:**
- All channels remain in SUBSCRIBED state
- No binding mismatch errors
- Real-time updates flow properly
- No reconnection loops

---

## 📚 Reference Documents

- **PR Summary**: `PR_FIX_REALTIME.md` - Complete technical overview
- **Diagnostic Guide**: `/tmp/complete-realtime-fix-guide.md` - Comprehensive troubleshooting
- **Error Handling**: `rpa-system/rpa-dashboard/src/hooks/useRealtimeSync.js:465-597` - Fatal error detection and recovery

---

## 🐛 If Fix Doesn't Work

If channels still fail after applying REPLICA IDENTITY FULL:

1. Share complete error object from console:
   ```javascript
   .subscribe((status, error) => {
     if (error) {
       console.log('FULL ERROR:', JSON.stringify({
         message: error.message,
         details: error.details,
         hint: error.hint,
         code: error.code
       }, null, 2));
     }
   });
   ```

2. Check WebSocket messages:
   - DevTools → Network → WS tab
   - Click `realtime` connection
   - Go to "Messages" tab
   - Share error frames

3. Check Supabase Dashboard Logs:
   - Dashboard → Logs
   - Select "Realtime"
   - Filter by "error"

---

## 🎯 Why This Was the Issue

**Quick Explanation:**
- PostgreSQL REPLICA IDENTITY controls what data is sent in the replication stream
- DEFAULT only sends primary key values
- Your subscriptions filter by `user_id` (not the primary key)
- Supabase Realtime needs `user_id` value to evaluate the filter
- Without it, server can't create the binding → "mismatch" error

**The Fix:**
- FULL sends ALL column values in replication stream
- Now server has `user_id` to evaluate filters
- Bindings succeed, channels stay connected
