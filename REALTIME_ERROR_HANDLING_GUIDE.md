# Supabase Realtime Enhanced Error Handling - Implementation Guide

## 🎯 What Was Implemented

I've upgraded your `useRealtimeSync` hook with intelligent error handling that:

1. **Categorizes errors** into 4 types (Fatal Permanent, Fatal Config, Auth Issues, Transient)
2. **Uses smart retry strategies** - different retry logic for each error type
3. **Falls back to polling** when realtime fails after retries
4. **Notifies users** with clear, actionable messages
5. **Exports status** for UI components to display

---

## 📁 Files Modified/Created

### Modified
- **`src/hooks/useRealtimeSync.js`**
  - Added error categorization system
  - Enhanced `handleChannelStatus` with smart retry logic
  - Added `realtimeStatus` state
  - Added `notifyError` callback
  - Returns `{ isConnected, realtimeStatus }` for components

### Created
- **`src/components/RealtimeStatusBanner/RealtimeStatusBanner.jsx`**
  - User-facing banner component
  - Shows degraded/error/reconnecting states

- **`src/components/RealtimeStatusBanner/RealtimeStatusBanner.css`**
  - Styled banner with warning/error/info variants

---

## 🔧 How to Use

### Step 1: Update Components Using `useRealtimeSync`

**Before:**
```javascript
import { useRealtimeSync } from '../hooks/useRealtimeSync';

function MyComponent() {
  useRealtimeSync({
    onPlanChange: handlePlanChange,
    onUsageUpdate: handleUsageUpdate,
    onWorkflowUpdate: handleWorkflowUpdate
  });

  // ...rest of component
}
```

**After:**
```javascript
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { RealtimeStatusBanner } from '../components/RealtimeStatusBanner/RealtimeStatusBanner';
import { useState } from 'react';

function MyComponent() {
  const [showErrorToast, setShowErrorToast] = useState(false);

  const { isConnected, realtimeStatus } = useRealtimeSync({
    onPlanChange: handlePlanChange,
    onUsageUpdate: handleUsageUpdate,
    onWorkflowUpdate: handleWorkflowUpdate,

    // NEW: Error callback
    onError: (errorInfo) => {
      console.error('Realtime error:', errorInfo);

      // Show toast notification for critical errors
      if (errorInfo.type === 'REALTIME_FATAL') {
        setShowErrorToast(true);
        // Or use your toast library:
        // toast.error(errorInfo.message);
      }

      // Log to analytics
      if (window.analytics) {
        window.analytics.track('realtime_error', {
          type: errorInfo.type,
          channel: errorInfo.channel,
          message: errorInfo.message
        });
      }
    }
  });

  return (
    <div>
      {/* Show status banner at top of page */}
      <RealtimeStatusBanner status={realtimeStatus} />

      {/* Your existing content */}
      <YourContent />
    </div>
  );
}
```

---

## 📊 Error Types and Behaviors

### 1. FATAL_PERMANENT (Schema/Table Issues)

**Triggers on:**
- `"table X does not exist"`
- `"relation X does not exist"`
- `"column X does not exist"`
- `"schema X does not exist"`

**Behavior:**
- ❌ Stops reconnecting immediately
- 🛑 Marks channel as permanently failed
- 📢 Shows error banner to user
- 💬 Suggests contacting support

**User sees:**
```
❌ Real-time Updates Unavailable
Unable to establish real-time connection. Please contact support.
[Contact Support Button]
```

---

### 2. FATAL_CONFIG (Configuration Issues)

**Triggers on:**
- `"mismatch between server and client bindings"`
- `"not in publication"`
- `"insufficient replica identity"`
- `"invalid filter"`

**Behavior:**
- 🔄 Retries 3 times with exponential backoff (5s, 10s, 20s)
- After 3 failures:
  - 🛑 Stops reconnecting
  - 🔄 Falls back to 30-second polling
  - 📢 Shows degraded mode banner

**User sees:**
```
⚠️ Degraded Mode
Real-time updates temporarily unavailable. Using backup sync every 30 seconds.
```

---

### 3. AUTH_ISSUE (Authentication Problems)

**Triggers on:**
- `"permission denied"`
- `"policy violation"`
- `"unauthorized"`
- `"jwt expired"`
- `"authentication failed"`

**Behavior:**
- 🔐 Attempts session refresh automatically
- If refresh succeeds: updates token and retries
- If refresh fails: shows auth error

**User sees:**
```
❌ Real-time Updates Unavailable
Authentication error - please sign in again.
```

---

### 4. TRANSIENT (Network/Temporary Issues)

**Triggers on:**
- `"network"`
- `"timeout"`
- `"connection"`
- `"socket"`

**Behavior:**
- 🔄 Retries 6 times with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s)
- After 6 failures:
  - Falls back to polling
  - Shows degraded mode banner

---

## 🎨 Status Banner Variants

The `RealtimeStatusBanner` component automatically displays the right message based on status:

### Connected (No Banner)
When `realtimeStatus.status === 'connected'`, no banner is shown.

### Degraded Mode (Yellow Banner)
```
⚠️ Degraded Mode
Using backup polling due to real-time configuration issue
```

### Error (Red Banner)
```
❌ Real-time Updates Unavailable
Unable to establish real-time connection. Please contact support.
[Contact Support]
```

### Reconnecting (Blue Banner)
```
🔌 Reconnecting...
Attempting to restore real-time connection.
```

---

## 🧪 Testing the Error Handling

### Test 1: Simulate Config Error
```sql
-- In Supabase SQL Editor, remove table from publication
ALTER PUBLICATION supabase_realtime DROP TABLE usage_tracking;
```

**Expected:**
1. Console shows: `⚠️ Config error on usage-updates (attempt 1/3)`
2. Retries 3 times
3. Falls back to polling
4. Yellow "Degraded Mode" banner appears

### Test 2: Simulate Auth Error
```javascript
// In browser console, invalidate JWT
localStorage.setItem('sb-auth-token', JSON.stringify({
  access_token: 'invalid_token_xyz',
  refresh_token: 'invalid'
}));

// Refresh page
location.reload();
```

**Expected:**
1. Console shows: `🔐 Auth issue on plan-changes`
2. Attempts session refresh
3. If refresh fails, shows auth error banner

### Test 3: Simulate Network Error
```javascript
// In browser DevTools, go to Network tab
// Set throttling to "Offline"
// Watch channels disconnect and retry
```

**Expected:**
1. Console shows: `🔄 Reconnecting plan-changes in 1000ms (attempt 1/6)`
2. Exponential backoff increases
3. After 6 failures, falls back to polling

---

## 📦 Component API Reference

### `useRealtimeSync` Hook

```typescript
interface RealtimeStatus {
  status: 'connected' | 'degraded' | 'error' | 'disconnected';
  message: string | null;
  channels: {
    [channelKey: string]: {
      status: 'error' | 'degraded';
      message: string;
      timestamp: number;
    }
  };
}

interface ErrorInfo {
  type: 'REALTIME_FATAL' | 'REALTIME_DEGRADED';
  channel: string;
  message: string;
  details: string;
  action: 'CONTACT_SUPPORT' | 'CONTINUE_WITH_POLLING' | 'SIGN_IN_AGAIN' | 'CHECK_NETWORK';
}

interface UseRealtimeSyncProps {
  onPlanChange?: (data: any) => void;
  onUsageUpdate?: (data: any) => void;
  onWorkflowUpdate?: (data: any) => void;
  onError?: (errorInfo: ErrorInfo) => void;
}

interface UseRealtimeSyncReturn {
  isConnected: boolean;
  realtimeStatus: RealtimeStatus;
}

function useRealtimeSync(props: UseRealtimeSyncProps): UseRealtimeSyncReturn;
```

### `RealtimeStatusBanner` Component

```typescript
interface RealtimeStatusBannerProps {
  status: RealtimeStatus;
}

function RealtimeStatusBanner(props: RealtimeStatusBannerProps): JSX.Element | null;
```

---

## 🔍 Monitoring and Debugging

### Console Logs

The enhanced error handling logs detailed information:

```
⚠️  Config error on plan-changes (attempt 1/3): mismatch between server and client bindings
   Retrying in 5000ms...

❌ plan-changes failed 3 times: mismatch between server and client bindings
   Falling back to polling.

[Realtime] Started fallback polling for plan-changes (every 30000ms)
```

### Error Events

Errors are tracked via `trackEvent`:

```javascript
{
  event: 'realtime_error',
  channel: 'plan-changes-abc123',
  topic: 'realtime:plan-changes-abc123',
  error: 'mismatch between server and client bindings',
  category: 'FATAL_CONFIG',
  attempts: 3
}
```

### Status Object

Read `realtimeStatus` in your component to programmatically check status:

```javascript
const { realtimeStatus } = useRealtimeSync({...});

// Check if any channel is degraded
const isDegraded = realtimeStatus.status === 'degraded';

// Get per-channel status
const planChannelStatus = realtimeStatus.channels['plan-changes-abc123'];
if (planChannelStatus?.status === 'error') {
  console.log('Plan channel is broken:', planChannelStatus.message);
}
```

---

## 🚀 What This Solves

### Before
- ❌ Infinite reconnect loops on config errors
- ❌ No user feedback when realtime fails
- ❌ Same retry strategy for all errors
- ❌ No graceful degradation
- ❌ Hard to debug what's wrong

### After
- ✅ Smart retry strategies per error type
- ✅ Clear user-facing error messages
- ✅ Automatic fallback to polling
- ✅ Graceful degradation
- ✅ Detailed error categorization and logging
- ✅ UI components can show status
- ✅ Auth issues trigger session refresh
- ✅ Permanent errors stop reconnecting immediately

---

## 📝 Example: Full Implementation

```javascript
// src/pages/DashboardPage.jsx
import React, { useState, useCallback } from 'react';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { RealtimeStatusBanner } from '../components/RealtimeStatusBanner/RealtimeStatusBanner';

function DashboardPage() {
  const [planData, setPlanData] = useState(null);
  const [usageData, setUsageData] = useState(null);

  const handlePlanChange = useCallback((data) => {
    console.log('Plan changed:', data);
    setPlanData(data);
  }, []);

  const handleUsageUpdate = useCallback((data) => {
    console.log('Usage updated:', data);
    setUsageData(data);
  }, []);

  const handleRealtimeError = useCallback((errorInfo) => {
    console.error('Realtime error:', errorInfo);

    // Log to error tracking service
    if (window.Sentry) {
      window.Sentry.captureMessage('Realtime error', {
        level: errorInfo.type === 'REALTIME_FATAL' ? 'error' : 'warning',
        extra: errorInfo
      });
    }

    // Show toast for critical errors
    if (errorInfo.type === 'REALTIME_FATAL') {
      toast.error(errorInfo.message, {
        duration: Infinity,
        action: errorInfo.action === 'CONTACT_SUPPORT' ? {
          label: 'Contact Support',
          onClick: () => window.open('/support', '_blank')
        } : undefined
      });
    }
  }, []);

  const { isConnected, realtimeStatus } = useRealtimeSync({
    onPlanChange: handlePlanChange,
    onUsageUpdate: handleUsageUpdate,
    onWorkflowUpdate: () => {},
    onError: handleRealtimeError
  });

  return (
    <div className="dashboard">
      {/* Status banner at top */}
      <RealtimeStatusBanner status={realtimeStatus} />

      {/* Connection indicator */}
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <ConnectionIndicator isConnected={isConnected} />
      </div>

      {/* Dashboard content */}
      <PlanCard data={planData} />
      <UsageCard data={usageData} />
    </div>
  );
}

// Simple connection indicator component
function ConnectionIndicator({ isConnected }) {
  return (
    <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
      <span className="indicator-dot" />
      {isConnected ? 'Live' : 'Offline'}
    </div>
  );
}

export default DashboardPage;
```

---

## 🎓 Key Concepts

### Why Categorize Errors?

Different errors need different responses:
- **Schema errors** won't fix themselves → stop trying
- **Config errors** might be fixed soon → retry a few times, then fallback
- **Auth errors** → try refreshing session first
- **Network errors** → keep retrying with backoff

### Why Fallback to Polling?

When realtime fails, users still need data updates. Polling every 30 seconds:
- Keeps UI reasonably up-to-date
- Reduces server load vs. aggressive realtime reconnects
- Gives clear feedback to user (degraded mode banner)

### Why Export Status?

Components need to know when realtime is degraded to:
- Show appropriate UI (spinners, warnings)
- Adjust behavior (more aggressive manual refresh buttons)
- Guide user actions (suggest contacting support)

---

## 🐛 Troubleshooting

### Banner Not Showing

1. Check that you're importing and rendering `<RealtimeStatusBanner status={realtimeStatus} />`
2. Verify `realtimeStatus` is being destructured from hook return
3. Check CSS is imported

### Errors Not Being Caught

1. Ensure `onError` callback is passed to `useRealtimeSync`
2. Check browser console for error logs
3. Verify error patterns in ERROR_CATEGORIES match your errors

### Polling Not Starting

1. Check `refreshData` function exists in scope
2. Verify polling timers aren't being cleared prematurely
3. Look for console message: `[Realtime] Started fallback polling for X`

---

## ✅ Checklist for Rollout

- [ ] Updated all components using `useRealtimeSync` to destructure return value
- [ ] Added `onError` callback to components that need error handling
- [ ] Imported and rendered `<RealtimeStatusBanner />` in main layouts
- [ ] Tested error scenarios (see Testing section)
- [ ] Verified error logging to analytics/Sentry
- [ ] Documented for team
- [ ] Updated TypeScript types if using TS

---

## 📚 Related Documentation

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [PostgreSQL Replica Identity](https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-REPLICA-IDENTITY)
- [Original Fix: SESSION_SUMMARY.md](./SESSION_SUMMARY.md)
- [Quick Reference: QUICK_REFERENCE_REALTIME_FIX.md](./QUICK_REFERENCE_REALTIME_FIX.md)
