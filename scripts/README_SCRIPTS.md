# Realtime Fix Scripts

This directory contains diagnostic and fix scripts for resolving realtime channel issues.

## Quick Start

### 1. Diagnose the Issue

Open your app in the browser, open Developer Console (F12), and run:

```javascript
// Copy content from: diagnose_realtime.js
// Or just paste the script directly from FIX_REALTIME_CHANNELS.md
```

### 2. Fix Token Issues

If diagnostics show missing auth token:

```javascript
// Copy content from: fix_realtime_token.js
// Or follow the steps in FIX_REALTIME_CHANNELS.md
```

### 3. Fix Database Configuration

If diagnostics show channel connection issues:

1. Open Supabase Dashboard → SQL Editor
2. Run queries from: `check_supabase_config.sql`
3. If issues found, run: `fix_supabase_config.sql`

## Files

- **diagnose_realtime.js** - Browser console script to check realtime status
- **fix_realtime_token.js** - Browser console script to fix auth token issues
- **check_supabase_config.sql** - SQL to verify database configuration
- **fix_supabase_config.sql** - SQL to fix database configuration

## Documentation

See parent directory for complete guides:
- **FIX_REALTIME_CHANNELS.md** - Step-by-step fix guide (start here!)
- **REALTIME_TROUBLESHOOTING_GUIDE.md** - Comprehensive troubleshooting reference

## Support

If issues persist after running these scripts, see the "Still Having Issues?" section in FIX_REALTIME_CHANNELS.md
