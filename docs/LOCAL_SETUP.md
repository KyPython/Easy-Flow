# Local Development Setup

This guide will help you set up your local development environment for EasyFlow.

## Prerequisites

- Node.js >= 18.0.0
- Python 3.9+
- Docker (for Kafka/Zookeeper)
- Git

## Initial Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd Easy-Flow
git checkout dev
./start-dev.sh  # Auto-installs dependencies and starts services
```

### 2. Configure Environment Variables

**CRITICAL:** The application requires Firebase and Supabase configuration to function properly. Without these, you'll see:
- Flood of polling requests (fallback when real-time connection fails)
- 401 authentication errors
- Missing real-time updates

#### Step 1: Copy the Template

```bash
cd rpa-system/rpa-dashboard
cp .env.example .env.local
```

#### Step 2: Fill in Your Credentials

Open `.env.local` and replace the placeholder values with your actual credentials:

**Firebase Configuration:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one)
3. Go to **Project Settings** → **General**
4. Scroll to **Your apps** → **Web app** → **Config**
5. Copy the values into `.env.local`

**Supabase Configuration:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** and **anon/public key** into `.env.local`

**Backend API:**
- For local development, keep `REACT_APP_API_URL=http://localhost:3030`
- This should match your local backend server port

#### Step 3: Restart Development Server

**IMPORTANT:** Create React App only loads `.env.local` when the server starts. You must:

1. Stop the development server (Ctrl+C)
2. Restart it:
   ```bash
   cd rpa-system/rpa-dashboard
   npm start
   ```

Or restart everything:
```bash
./stop-dev.sh
./start-dev.sh
```

## Verification

After restarting, check your browser console. You should see:
- ✅ No Firebase configuration warnings
- ✅ No Supabase configuration warnings
- ✅ Real-time connection established (no polling flood)
- ✅ ✅ Successful API requests (200 OK, not 401/403)

## Troubleshooting

### Still Seeing Polling Requests?

1. **Check `.env.local` exists** in `rpa-system/rpa-dashboard/`
2. **Verify values are correct** (no typos, no extra spaces)
3. **Restart the server** (environment variables only load on startup)
4. **Check browser console** for specific error messages

### Firebase 401 Errors?

- Verify `REACT_APP_FIREBASE_PROJECT_ID` matches your Firebase project
- Check that your Firebase API Key has correct restrictions in Google Cloud Console
- See [Firebase Auth Fix Guide](FIREBASE_AUTH_FIX.md) for detailed troubleshooting

### Supabase Connection Errors?

- Verify `REACT_APP_SUPABASE_URL` is correct (should end with `.supabase.co`)
- Check that `REACT_APP_SUPABASE_ANON_KEY` is the **anon/public** key (not the service_role key)
- Ensure your Supabase project is active and not paused

### Backend Not Responding?

- Verify backend is running: `curl http://localhost:3030/api/health`
- Check backend logs: `npm run logs`
- Ensure backend has its own `.env` file with database credentials

## Environment File Locations

- **Frontend:** `rpa-system/rpa-dashboard/.env.local`
- **Backend:** `rpa-system/backend/.env` (if needed)

## Security Notes

- ✅ `.env.local` is git-ignored (never committed)
- ✅ `.env.example` is tracked (template only, no secrets)
- ❌ **NEVER** commit `.env.local` or any file with real credentials
- ❌ **NEVER** share your `.env.local` file

## Next Steps

Once your environment is configured:
1. Open http://localhost:3000
2. You should see the dashboard without errors
3. Real-time updates should work automatically
4. No more polling request floods!

For daily workflow, see [WORKFLOW.md](WORKFLOW.md).

