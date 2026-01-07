# Firebase Authentication Fix Guide

## Problem: 401 Unauthorized Error

**Error:** `auth/request-had-invalid-authentication-credential`

**Root Cause:** Backend service account credentials don't match the Firebase project `easyflow-77db9` that the frontend is using.

## Solution: Update Backend Service Account Credentials

### Step 1: Verify Frontend Firebase Project

Your frontend is configured to use Firebase project: **`easyflow-77db9`**

This is confirmed by:
- Network logs: `.../projects/easyflow-77db9/installations`
- Frontend config: `rpa-system/rpa-dashboard/src/utils/firebaseConfig.js`

### Step 2: Get Correct Service Account Credentials

1. **Go to Firebase Console:**
 - https://console.firebase.google.com/
 - Select project: **`easyflow-77db9`**

2. **Navigate to Service Accounts:**
 - Project Settings (gear icon) -> **Service Accounts** tab

3. **Generate New Private Key:**
 - Click **"Generate new private key"**
 - Confirm the dialog
 - A JSON file will download (e.g., `easyflow-77db9-firebase-adminsdk-xxxxx.json`)

4. **Extract Credentials from JSON:**
 Open the downloaded JSON file and extract:
 ```json
 {
 "project_id": "easyflow-77db9",
 "private_key_id": "...",
 "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
 "client_email": "firebase-adminsdk-xxxxx@easyflow-77db9.iam.gserviceaccount.com",
 "client_id": "...",
 "auth_uri": "...",
 "token_uri": "...",
 "auth_provider_x509_cert_url": "...",
 "client_x509_cert_url": "..."
 }
 ```

### Step 3: Update Backend Environment Variables

**For Local Development (`rpa-system/backend/.env`):**
```bash
FIREBASE_PROJECT_ID=easyflow-77db9
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@easyflow-77db9.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://easyflow-77db9-default-rtdb.firebaseio.com/
```

**Important Notes:**
- `FIREBASE_PRIVATE_KEY` must include the `\n` characters (newlines) - keep them as `\n` in the .env file
- Wrap the private key in double quotes if it contains special characters
- The `project_id` in the JSON must be exactly `easyflow-77db9`

**For Render Deployment:**
1. Go to Render Dashboard -> Your Backend Service -> **Environment**
2. Add/Update these environment variables:
 - `FIREBASE_PROJECT_ID` = `easyflow-77db9`
 - `FIREBASE_CLIENT_EMAIL` = `firebase-adminsdk-xxxxx@easyflow-77db9.iam.gserviceaccount.com`
 - `FIREBASE_PRIVATE_KEY` = `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`
 - `FIREBASE_DATABASE_URL` = `https://easyflow-77db9-default-rtdb.firebaseio.com/`

### Step 4: Verify Service Account Permissions

1. **Go to Google Cloud Console:**
 - https://console.cloud.google.com/
 - Select project: **`easyflow-77db9`**

2. **Navigate to IAM & Admin -> Service Accounts:**
 - Find the service account matching `FIREBASE_CLIENT_EMAIL`
 - Verify it has the **"Firebase Admin SDK Administrator Service Agent"** role
 - If missing, add it:
 - Click the service account -> **Permissions** tab
 - Click **"Grant Access"**
 - Add role: **"Firebase Admin SDK Administrator Service Agent"**

### Step 5: Restart Backend

**Local:**
```bash
cd /Users/ky/Easy-Flow
./stop-dev.sh
./start-dev.sh
```

**Render:**
- Changes to environment variables trigger automatic redeployment
- Or manually trigger a redeploy from Render dashboard

### Step 6: Verify Fix

1. **Check Backend Logs:**
 Look for:
 ```
 Firebase Project ID matches frontend configuration
 🔥 Firebase Admin initialized successfully
 ```

2. **Test Frontend:**
 - Open browser console
 - Look for successful Firebase authentication (no 401 errors)
 - Check for: `🔔 Firebase authentication successful`

## Verification Checklist

- [ ] `FIREBASE_PROJECT_ID` = `easyflow-77db9` (exact match)
- [ ] `FIREBASE_CLIENT_EMAIL` belongs to `easyflow-77db9` project
- [ ] `FIREBASE_PRIVATE_KEY` is from the same service account
- [ ] Service account has "Firebase Admin SDK Administrator Service Agent" role
- [ ] Backend logs show: " Firebase Project ID matches frontend configuration"
- [ ] No more 401 errors in browser console

## Common Mistakes

1. **Wrong Project:** Using credentials from a different Firebase project
2. **Missing Newlines:** `FIREBASE_PRIVATE_KEY` must preserve `\n` characters
3. **Incorrect Email:** `FIREBASE_CLIENT_EMAIL` doesn't match the service account
4. **Missing Permissions:** Service account lacks required roles

## Still Having Issues?

1. **Check Backend Logs:**
 ```bash
 npm run logs
 ```
 Look for Firebase initialization errors

2. **Verify Environment Variables:**
 The backend logs will show:
 ```
 [DEBUG] Firebase environment variables check:
 FIREBASE_PROJECT_ID: set (easyflow-77db9)
 FIREBASE_CLIENT_EMAIL: set
 FIREBASE_PRIVATE_KEY: set (XXXX chars)
 ```

3. **Test Token Generation:**
 ```bash
 cd rpa-system/backend
 node scripts/get_test_token.js
 ```
 This will attempt to generate a test token and show any errors.

