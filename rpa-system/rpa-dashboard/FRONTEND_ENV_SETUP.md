# Frontend .env.local Configuration Guide

## 🔥 CRITICAL: Authentication Cascade Prevention

The Firebase 400 and 401 errors are caused by missing or incorrect configuration in `/rpa-system/rpa-dashboard/.env.local`.

**CRITICAL:** The `REACT_APP_FIREBASE_PROJECT_ID` **MUST** match the backend's `FIREBASE_PROJECT_ID` (both should be `easyflow-77db9`).

## Required Environment Variables

### 1. Firebase Configuration (REQUIRED - Prevents 400/401 errors)

These **MUST** match your backend Firebase configuration:
- Backend has: `FIREBASE_PROJECT_ID=easyflow-77db9`
- Frontend must have: `REACT_APP_FIREBASE_PROJECT_ID=easyflow-77db9`

```bash
# Get these from: Firebase Console → Project Settings → General
# Select your project: easyflow-77db9

REACT_APP_FIREBASE_PROJECT_ID=easyflow-77db9
REACT_APP_FIREBASE_API_KEY=your-api-key-here
REACT_APP_FIREBASE_AUTH_DOMAIN=easyflow-77db9.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://easyflow-77db9-default-rtdb.firebaseio.com/
REACT_APP_FIREBASE_STORAGE_BUCKET=easyflow-77db9.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id-here

# Optional: For Firebase Analytics
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**How to get Firebase credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`easyflow-77db9`)
3. Go to Project Settings (gear icon) → General tab
4. Scroll down to "Your apps" section
5. If you don't have a web app, click "Add app" → Web (</> icon)
6. Copy the config values:
   - `apiKey` → `REACT_APP_FIREBASE_API_KEY`
   - `authDomain` → `REACT_APP_FIREBASE_AUTH_DOMAIN`
   - `databaseURL` → `REACT_APP_FIREBASE_DATABASE_URL`
   - `projectId` → `REACT_APP_FIREBASE_PROJECT_ID` (must be `easyflow-77db9`)
   - `storageBucket` → `REACT_APP_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `REACT_APP_FIREBASE_APP_ID`

### 2. Supabase Configuration (REQUIRED)

```bash
# Get these from: Supabase Dashboard → Settings → API
# Use the ANON (public) key, NOT the service role key

REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

**How to get Supabase credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy:
   - `Project URL` → `REACT_APP_SUPABASE_URL`
   - `anon public` key → `REACT_APP_SUPABASE_ANON_KEY` (NOT the service_role key!)

### 3. API Configuration (Optional)

```bash
# Backend API URL (defaults to http://localhost:3030 in development)
REACT_APP_API_BASE_URL=http://localhost:3030
```

## Quick Setup Checklist

- [ ] `REACT_APP_FIREBASE_PROJECT_ID` is set to `easyflow-77db9` (matches backend)
- [ ] `REACT_APP_FIREBASE_API_KEY` is set (from Firebase Console)
- [ ] `REACT_APP_FIREBASE_AUTH_DOMAIN` is set
- [ ] `REACT_APP_FIREBASE_DATABASE_URL` is set
- [ ] `REACT_APP_FIREBASE_STORAGE_BUCKET` is set
- [ ] `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` is set
- [ ] `REACT_APP_FIREBASE_APP_ID` is set
- [ ] `REACT_APP_SUPABASE_URL` is set
- [ ] `REACT_APP_SUPABASE_ANON_KEY` is set (anon key, not service role)

## Verification

After setting up your `.env.local` file:

1. **Check configuration:**
   ```bash
   cd rpa-system/rpa-dashboard
   ./check_frontend_env.sh
   ```

2. **Start the frontend:**
   ```bash
   npm start
   ```

3. **Check browser console:**
   - Should NOT see Firebase 400/401 errors
   - Should see: `✅ Firebase initialized successfully`
   - Should see: `✅ Supabase client initialized`

**Expected output if configured correctly:**
```
✅ Firebase config present and matches backend
✅ Supabase config present
✅ All critical configuration is present and correct!
```

**If you see errors:**
- `🔥 FATAL: Firebase projectId is missing!` → Add `REACT_APP_FIREBASE_PROJECT_ID=easyflow-77db9`
- `Project ID mismatch` → Ensure `REACT_APP_FIREBASE_PROJECT_ID` matches backend's `FIREBASE_PROJECT_ID`
- `400 INVALID_ARGUMENT` → Check all Firebase config values are correct
- `401 Unauthorized` → Verify project IDs match between frontend and backend

## File Location

The `.env.local` file must be located at:
```
/Users/ky/Easy-Flow/rpa-system/rpa-dashboard/.env.local
```

**Note:** This file is git-ignored for security. You must create/edit it manually.

## Matching Backend Configuration

**CRITICAL:** These values must match between frontend and backend:

| Frontend (.env.local) | Backend (.env) | Must Match |
|----------------------|---------------|------------|
| `REACT_APP_FIREBASE_PROJECT_ID` | `FIREBASE_PROJECT_ID` | ✅ YES (both: `easyflow-77db9`) |
| `REACT_APP_FIREBASE_DATABASE_URL` | `FIREBASE_DATABASE_URL` | ✅ YES (same URL) |

If these don't match, you'll get 401 authentication errors!
