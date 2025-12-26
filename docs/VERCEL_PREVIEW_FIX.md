# Vercel Preview Environment Fix Guide

## Issues Fixed

1. ✅ **CORS Policy** - Backend now accepts all Vercel preview URLs via regex matching
2. ✅ **Content Security Policy** - Updated CSP to allow all HubSpot and Firebase domains
3. ⚠️ **Firebase API Key Restrictions** - Manual configuration required (see below)

## What Was Fixed

### 1. CORS Configuration (Backend)

The backend now uses regex patterns to automatically allow all Vercel preview URLs:
- Pattern: `https://easy-flow-.*-kypythons-projects.vercel.app`
- Fallback: `https://.*.vercel.app` (any Vercel preview)

**No action needed** - This is already deployed in the code.

### 2. Content Security Policy (Frontend)

Updated `rpa-system/rpa-dashboard/vercel.json` to include:
- All HubSpot domains: `*.hscollectedforms.net`, `*.hs-analytics.net`, `*.hs-banner.com`, `*.usemessages.com`
- Firebase domains: `*.firebaseapp.com`, `firebaseinstallations.googleapis.com`, `identitytoolkit.googleapis.com`

**No action needed** - This will be deployed on next Vercel build.

### 3. Firebase API Key Restrictions (Manual Step Required)

The 401/400 errors indicate your Google Cloud API Key has HTTP Referrer restrictions that don't include Vercel preview URLs.

#### Steps to Fix:

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/
   - Select project: **`easyflow-77db9`**

2. **Navigate to API Key Settings:**
   - **APIs & Services** → **Credentials**
   - Find your **Browser Key** (the one used by Firebase)

3. **Update HTTP Referrer Restrictions:**
   - Click on the API Key
   - Under **"Application restrictions"**, select **"HTTP referrers (web sites)"**
   - Add these patterns:
     ```
     https://easy-flow-*-kypythons-projects.vercel.app/*
     https://*.vercel.app/*
     https://tryeasyflow.com/*
     https://www.tryeasyflow.com/*
     http://localhost:3000/*
     http://localhost:5173/*
     ```

4. **Verify API Restrictions:**
   - Under **"API restrictions"**, ensure these APIs are enabled:
     - ✅ **Firebase Installations API**
     - ✅ **Identity Toolkit API**
     - ✅ **Firebase Cloud Messaging API** (if using FCM)

5. **Save Changes:**
   - Click **Save**
   - Wait 5-10 minutes for changes to propagate

## Verification

After making the API Key changes:

1. **Check Browser Console:**
   - No more 401 errors from `identitytoolkit.googleapis.com`
   - No more 400 errors from `firebaseinstallations.googleapis.com`

2. **Check Network Tab:**
   - `/api/runs` requests should succeed (no CORS errors)
   - Firebase authentication should complete successfully

3. **Check Backend Logs:**
   - Look for: `✅ CORS: Allowing origin via regex pattern`

## Troubleshooting

### Still Getting CORS Errors?

1. **Check Backend Logs:**
   ```bash
   npm run logs
   ```
   Look for: `🚫 CORS blocked origin` - this will show which origin was rejected

2. **Verify Backend Deployment:**
   - Ensure the latest code (with regex CORS patterns) is deployed to Render
   - Check Render deployment logs for any errors

### Still Getting CSP Violations?

1. **Check Browser Console:**
   - Look for CSP violation messages
   - They will show which domain is being blocked

2. **Update CSP in `rpa-system/rpa-dashboard/vercel.json`:**
   - Add the blocked domain to the appropriate CSP directive
   - Redeploy to Vercel

### Still Getting Firebase 401 Errors?

1. **Verify API Key:**
   - Check that the API Key restrictions were saved correctly
   - Wait 10 minutes for propagation

2. **Check API Key Project:**
   - Ensure the API Key belongs to project `easyflow-77db9`
   - Verify it's the same key used in your frontend environment variables

3. **Test with Different Preview URL:**
   - Create a new preview deployment
   - Check if the new URL works (might indicate caching issues)

