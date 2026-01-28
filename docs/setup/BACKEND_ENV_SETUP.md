# Backend .env Configuration Guide

## 🚨 BEFORE YOU DEVELOP - Pre-Flight Checklist

Run this checklist every time before starting development:

### 1. Check Supabase Status
```bash
# Test if Supabase is reachable
curl -s https://YOUR_PROJECT_ID.supabase.co/rest/v1/ -H "apikey: YOUR_ANON_KEY" | head -1
```
- If you get `NXDOMAIN` or connection refused → **Supabase project is paused/deleted**
- Go to https://supabase.com/dashboard and restore your project (free tier pauses after 7 days inactivity)

### 2. Start Backend
```bash
cd /Users/ky/Easy-Flow
./start-dev.sh
# OR manually:
pm2 start ecosystem.config.js
```

### 3. Verify Backend Health
```bash
curl http://localhost:3030/health/live
# Should return: {"status":"ok"}
```

### 4. Check for Errors
```bash
pm2 logs easyflow-backend --lines 20 --nostream
```
- `ENOTFOUND supabase.co` → Supabase is down, restore project
- `Firebase Admin initialized` → Firebase OK
- `fetch failed` → Check internet/Supabase status

---

## 🔥 CRITICAL: Authentication Cascade Prevention

The 401 Firebase errors and 500 integration errors are caused by missing or incorrect configuration in `/rpa-system/backend/.env`.

## Required Environment Variables

### 1. Firebase Configuration (REQUIRED - Prevents 401 errors)

These **MUST** match your frontend Firebase configuration:
- Frontend expects: `REACT_APP_FIREBASE_PROJECT_ID=easyflow-77db9`
- Backend must have: `FIREBASE_PROJECT_ID=easyflow-77db9`

```bash
# Get these from: Firebase Console -> Project Settings -> Service Accounts
FIREBASE_PROJECT_ID=easyflow-77db9
FIREBASE_CLIENT_EMAIL=your-service-account@easyflow-77db9.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://easyflow-77db9-default-rtdb.firebaseio.com/
```

**How to get Firebase credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`easyflow-77db9`)
3. Go to Project Settings -> Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. Extract:
 - `project_id` -> `FIREBASE_PROJECT_ID`
 - `client_email` -> `FIREBASE_CLIENT_EMAIL`
 - `private_key` -> `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)

### 2. Supabase Configuration (REQUIRED)

```bash
# Get these from: Supabase Dashboard -> Settings -> API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
# OR use any of these alternative names:
# SUPABASE_SERVICE_ROLE=your-service-role-key-here
# SUPABASE_KEY=your-service-role-key-here
```

**⚠️ COMMON ISSUE: Supabase Project Paused**

Free tier Supabase projects pause after 7 days of inactivity. Symptoms:
- Sign-in returns `500 Internal Server Error`
- Backend logs show `ENOTFOUND [project-id].supabase.co`
- `nslookup [project-id].supabase.co` returns `NXDOMAIN`

**How to fix:**
1. Go to https://supabase.com/dashboard
2. Find your project (it will show "Paused")
3. Click the project → Click "Restore project"
4. Wait 1-2 minutes for DNS to propagate
5. Restart backend: `pm2 restart easyflow-backend`

**How to get Supabase credentials:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

**Local Development Alternative (no account needed):**
```bash
# Run Supabase locally with Docker
npx supabase start
# Uses: SUPABASE_URL=http://localhost:54321
```

### 3. Integration OAuth (REQUIRED - Prevents 500 errors on /api/integrations/*)

** CRITICAL:** These credentials are required for OAuth flows to work. Without them, you'll get 500 errors when trying to connect integrations.

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
3. ** CRITICAL: Enable required APIs first:**
 - **Gmail API**: https://console.cloud.google.com/apis/library/gmail.googleapis.com
 - Click "Enable" button
 - **Google Sheets API**: https://console.cloud.google.com/apis/library/sheets.googleapis.com
 - Click "Enable" button
 - **Google Drive API**: https://console.cloud.google.com/apis/library/drive.googleapis.com
 - Click "Enable" button
 - **Google Meet API**: https://console.cloud.google.com/apis/library/meet.googleapis.com
 - Click "Enable" button
 - **Google Calendar API** (for Meet): https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
 - Click "Enable" button
4. Go to APIs & Services -> Credentials
5. Click "Create Credentials" -> "OAuth client ID"
6. Choose "Web application"
7. Add authorized redirect URIs:
 - `http://localhost:3030/api/integrations/gmail/oauth/callback`
 - `http://localhost:3030/api/integrations/google_sheets/oauth/callback`
 - `http://localhost:3030/api/integrations/google_drive/oauth/callback`
 - `http://localhost:3030/api/integrations/google_meet/oauth/callback`
8. Copy the Client ID and Client Secret to your `.env` file

##### WhatsApp OAuth (Meta/Facebook) - Optional
```bash
# Get from: https://developers.facebook.com/apps/
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

**Note:** WhatsApp supports two connection methods:
- **OAuth (Meta)**: Connect via Facebook Login (requires Facebook App setup)
- **API Keys (Twilio)**: Connect via API keys (always available as fallback)

If `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are not configured, WhatsApp will use the API key modal for Twilio connections.

**How to get Facebook OAuth credentials:**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select an existing one
3. Add "WhatsApp" product to your app
4. Go to Settings -> Basic
5. Copy App ID and App Secret
6. Add to your `.env` file

##### Notion OAuth
```bash
# Get from: https://www.notion.so/my-integrations
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
```

**How to get Notion OAuth credentials:**
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Name your integration (e.g., "EasyFlow")
4. Select your workspace
5. Copy the "Internal Integration Token" (this is your client secret)
6. For OAuth, you'll need to create an OAuth app at https://www.notion.so/my-integrations
7. Add authorized redirect URIs:
 - `http://localhost:3030/api/integrations/notion/oauth/callback` (for development)
 - `https://easyflow-backend-ad8e.onrender.com/api/integrations/notion/oauth/callback` (for production)
8. Copy the Client ID and Client Secret to your `.env` file

##### Slack OAuth
```bash
# Get from: https://api.slack.com/apps
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
```

**How to get Slack OAuth credentials:**
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" -> "From scratch"
3. Name your app and select your workspace
4. Go to "OAuth & Permissions" in the sidebar
5. Scroll to "Redirect URLs" and add:
 - ** IMPORTANT: Slack requires HTTPS for redirect URIs**
 - **Option 1 (Local Dev with ngrok):** Use ngrok to create HTTPS tunnel:
 ```bash
 # Install ngrok: https://ngrok.com/download
 ngrok http 3030
 # Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
 # Add to Slack: https://abc123.ngrok.io/api/integrations/slack/oauth/callback
 # Set in .env: API_BASE_URL=https://abc123.ngrok.io
 ```
 - **Option 2 (Production):** Use your production URL:
 - `https://easyflow-backend-ad8e.onrender.com/api/integrations/slack/oauth/callback`
6. Scroll to "Scopes" -> "Bot Token Scopes" and add:
 - `chat:write` - Send messages
 - `channels:read` - View basic channel information
 - `channels:history` - View message history
 - `files:write` - Upload files
7. Scroll to "User Token Scopes" and add (if needed):
 - `channels:read` - View basic channel information
8. Click "Install to Workspace" (you'll need workspace admin approval)
9. Copy the "Client ID" and "Client Secret" from "App Credentials" to your `.env` file

### 4. Security (REQUIRED)

```bash
# Used for encrypting sensitive integration credentials
INTEGRATION_ENCRYPTION_KEY=your-32-byte-hex-key
```

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
- [ ] `INTEGRATION_ENCRYPTION_KEY` is set (generate with `openssl rand -hex 32`)

## Verification

After setting up your `.env` file, start the backend:

```bash
cd rpa-system/backend
npm start
```

**Expected output if configured correctly:**
```
 Firebase Project ID matches frontend configuration
 Firebase Admin initialized successfully
 Supabase client ready for database operations
 Configuration health check passed
```

**If you see errors:**
- `🔥 CRITICAL: Firebase Project ID mismatch!` -> Check `FIREBASE_PROJECT_ID` matches `easyflow-77db9`
- `SLACK_CLIENT_ID not configured` -> Add `SLACK_CLIENT_ID` to `.env`
- `GOOGLE_CLIENT_ID not configured` -> Add `GOOGLE_CLIENT_ID` to `.env`

## File Location

The `.env` file must be located at:
```
/Users/ky/Easy-Flow/rpa-system/backend/.env
```

**Note:** This file is git-ignored for security. You must create it manually.

---

## 🔧 Troubleshooting Guide

### Sign-in returns 500 Internal Server Error

**Check 1: Is Supabase reachable?**
```bash
pm2 logs easyflow-backend --lines 20 --nostream | grep -i "supabase\|ENOTFOUND"
```
If you see `ENOTFOUND [project].supabase.co`:
1. Your Supabase project is paused
2. Go to https://supabase.com/dashboard → Restore project
3. Run `pm2 restart easyflow-backend`

**Check 2: Are credentials correct?**
```bash
# Verify SUPABASE_URL resolves
nslookup $(grep SUPABASE_URL rpa-system/backend/.env | cut -d'/' -f3)
```

### Backend won't start

**Check PM2 status:**
```bash
pm2 status
pm2 logs easyflow-backend --err --lines 50
```

**Common fixes:**
```bash
# Kill and restart
pm2 delete all
pm2 start ecosystem.config.js

# Or use the dev script
./start-dev.sh
```

### Frontend can't connect to backend

**Verify backend is running:**
```bash
curl http://localhost:3030/health/live
```

**Check CORS/ports:**
- Frontend runs on `:3000`
- Backend runs on `:3030`
- Both must be running

### Quick Recovery Commands

```bash
# Full restart
./stop-dev.sh && ./start-dev.sh

# Check all services
pm2 status

# View recent errors
pm2 logs --err --lines 100

# Restart just backend
pm2 restart easyflow-backend
```

---

## 📋 Development Session Checklist

Copy this checklist for every dev session:

```
[ ] 1. Check Supabase dashboard - project active?
[ ] 2. Run ./start-dev.sh
[ ] 3. Verify: curl http://localhost:3030/health/live
[ ] 4. Verify: curl http://localhost:3000 (frontend)
[ ] 5. Check pm2 logs for errors
[ ] 6. Test sign-in works
[ ] 7. Ready to develop!
```
