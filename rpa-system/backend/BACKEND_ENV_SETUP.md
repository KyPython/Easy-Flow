# Backend .env Configuration Guide

## 🔥 CRITICAL: Authentication Cascade Prevention

The 401 Firebase errors and 500 integration errors are caused by missing or incorrect configuration in `/rpa-system/backend/.env`.

## Required Environment Variables

### 1. Firebase Configuration (REQUIRED - Prevents 401 errors)

These **MUST** match your frontend Firebase configuration:
- Frontend expects: `REACT_APP_FIREBASE_PROJECT_ID=easyflow-77db9`
- Backend must have: `FIREBASE_PROJECT_ID=easyflow-77db9`

```bash
# Get these from: Firebase Console → Project Settings → Service Accounts
FIREBASE_PROJECT_ID=easyflow-77db9
FIREBASE_CLIENT_EMAIL=your-service-account@easyflow-77db9.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://easyflow-77db9-default-rtdb.firebaseio.com/
```

**How to get Firebase credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`easyflow-77db9`)
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. Extract:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)

### 2. Supabase Configuration (REQUIRED)

```bash
# Get these from: Supabase Dashboard → Settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
# OR use any of these alternative names:
# SUPABASE_SERVICE_ROLE=your-service-role-key-here
# SUPABASE_KEY=your-service-role-key-here
```

### 3. Integration OAuth (OPTIONAL - Prevents 500 errors on /api/integrations/*)

#### Google OAuth (for Gmail, Google Sheets, Google Meet)
```bash
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**How to get Google OAuth credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to APIs & Services → Credentials
4. Create OAuth 2.0 Client ID
5. Set authorized redirect URI: `http://localhost:3030/api/integrations/gmail/oauth/callback`

#### Slack OAuth
```bash
# Get from: https://api.slack.com/apps
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
```

**How to get Slack OAuth credentials:**
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create New App → From scratch
3. Go to OAuth & Permissions
4. Add Redirect URL: `http://localhost:3030/api/integrations/slack/oauth/callback`
5. Add scopes: `chat:write`, `channels:read`, `channels:history`, `files:write`

## Quick Setup Checklist

- [ ] `FIREBASE_PROJECT_ID` is set to `easyflow-77db9`
- [ ] `FIREBASE_CLIENT_EMAIL` is set (from Firebase service account)
- [ ] `FIREBASE_PRIVATE_KEY` is set (from Firebase service account JSON)
- [ ] `FIREBASE_DATABASE_URL` is set
- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (or alternative) is set
- [ ] `GOOGLE_CLIENT_ID` is set (if using Google integrations)
- [ ] `GOOGLE_CLIENT_SECRET` is set (if using Google integrations)
- [ ] `SLACK_CLIENT_ID` is set (if using Slack integration)
- [ ] `SLACK_CLIENT_SECRET` is set (if using Slack integration)

## Verification

After setting up your `.env` file, start the backend:

```bash
cd rpa-system/backend
npm start
```

**Expected output if configured correctly:**
```
✅ Firebase Project ID matches frontend configuration
✅ Firebase Admin initialized successfully
✅ Supabase client ready for database operations
✅ Configuration health check passed
```

**If you see errors:**
- `🔥 CRITICAL: Firebase Project ID mismatch!` → Check `FIREBASE_PROJECT_ID` matches `easyflow-77db9`
- `SLACK_CLIENT_ID not configured` → Add `SLACK_CLIENT_ID` to `.env`
- `GOOGLE_CLIENT_ID not configured` → Add `GOOGLE_CLIENT_ID` to `.env`

## File Location

The `.env` file must be located at:
```
/Users/ky/Easy-Flow/rpa-system/backend/.env
```

**Note:** This file is git-ignored for security. You must create it manually.
