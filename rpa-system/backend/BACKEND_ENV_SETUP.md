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

### 3. Integration OAuth (REQUIRED - Prevents 500 errors on /api/integrations/*)

**⚠️ CRITICAL:** These credentials are required for OAuth flows to work. Without them, you'll get 500 errors when trying to connect integrations.

#### Quick Setup (Interactive Script)
```bash
cd rpa-system/backend
./add-oauth-credentials.sh
```

This interactive script will guide you through adding the credentials to your `.env` file.

#### Manual Setup

##### Google OAuth (for Gmail, Google Sheets, Google Meet, Google Drive)
```bash
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**How to get Google OAuth credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Enable required APIs:
   - Gmail API (for Gmail integration)
   - Google Sheets API (for Sheets integration)
   - Google Drive API (for Drive integration)
   - Google Calendar API (for Meet integration)
4. Go to APIs & Services → Credentials
5. Click "Create Credentials" → "OAuth client ID"
6. Choose "Web application"
7. Add authorized redirect URIs:
   - `http://localhost:3030/api/integrations/gmail/oauth/callback`
   - `http://localhost:3030/api/integrations/google_sheets/oauth/callback`
   - `http://localhost:3030/api/integrations/google_drive/oauth/callback`
   - `http://localhost:3030/api/integrations/google_meet/oauth/callback`
8. Copy the Client ID and Client Secret to your `.env` file

##### Slack OAuth
```bash
# Get from: https://api.slack.com/apps
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
```

**How to get Slack OAuth credentials:**
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace
4. Go to "OAuth & Permissions" in the sidebar
5. Scroll to "Redirect URLs" and add:
   - `http://localhost:3030/api/integrations/slack/oauth/callback`
6. Scroll to "Scopes" → "Bot Token Scopes" and add:
   - `chat:write` - Send messages
   - `channels:read` - View basic channel information
   - `channels:history` - View message history
   - `files:write` - Upload files
7. Scroll to "User Token Scopes" and add (if needed):
   - `channels:read` - View basic channel information
8. Click "Install to Workspace" (you'll need workspace admin approval)
9. Copy the "Client ID" and "Client Secret" from "App Credentials" to your `.env` file

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
