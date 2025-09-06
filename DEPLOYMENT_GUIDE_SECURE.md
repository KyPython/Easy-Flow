# 🚀 Secure Deployment Guide

## ⚠️ SECURITY FIRST

**NEVER commit real secrets to version control!**

## 🔧 Backend Deployment (Render.com)

### Step 1: Create Web Service

1. Go to Render.com Dashboard
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub repository

### Step 2: Configure Environment Variables

Add these environment variables in Render.com dashboard (Settings > Environment):

```bash
# Database
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE=your-supabase-service-role-key
SUPABASE_BUCKET=artifacts
SUPABASE_USE_SIGNED_URLS=true
SUPABASE_SIGNED_URL_EXPIRES=86400

# API Security
API_KEY=[generate with: openssl rand -hex 32]
ADMIN_API_SECRET=[generate with: openssl rand -hex 32]

# Email Service
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=your-verified-email
SENDGRID_FROM_NAME=Your App Name
SEND_EMAIL_WEBHOOK_SECRET=[generate with: openssl rand -hex 32]

# External APIs
HUBSPOT_API_KEY=your-hubspot-private-app-token
UCHAT_API_KEY=your-uchat-api-key
POLAR_API_KEY=your-polar-api-key

# Webhooks
POLAR_WEBHOOK_SECRET=[generate with: openssl rand -hex 32]
DUCK_TOKEN=your-duckdb-token
```

### Step 3: Build Settings

- **Build Command**: `cd rpa-system && npm install`
- **Start Command**: `cd rpa-system && node backend/index.js`
- **Root Directory**: Leave empty (auto-detect)

## 🎨 Frontend Deployment (Vercel)

### Step 1: Import Project

1. Go to Vercel Dashboard
2. Click "New Project"
3. Import from GitHub

### Step 2: Configure Build Settings

- **Framework Preset**: Create React App
- **Root Directory**: `rpa-system/rpa-dashboard`
- **Build Command**: `npm run build`
- **Output Directory**: `build`

### Step 3: Environment Variables

Add these in Vercel dashboard (Settings > Environment Variables):

```bash
# Supabase (Frontend)
REACT_APP_SUPABASE_URL=your-supabase-project-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key

# Firebase
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id

# Backend URL
REACT_APP_BACKEND_URL=https://your-render-app.onrender.com
```

## 🔑 How to Get Your Secrets

### Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings > API
4. Copy "URL", "anon key", and "service_role key"

### SendGrid API Key

1. Go to [SendGrid Dashboard](https://app.sendgrid.com/)
2. Settings > API Keys
3. Create API Key with "Full Access"

### HubSpot Token

1. Go to HubSpot Settings
2. Integrations > Private Apps
3. Create new private app with required scopes

### Polar API Key

1. Go to [Polar Dashboard](https://polar.sh/)
2. Settings > API Keys
3. Generate new API key

### Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Project Settings > General
3. Scroll to "Your apps" > Web app config

## 🔒 Security Best Practices

1. **Never commit secrets to git**
2. **Use environment variables only**
3. **Rotate secrets regularly**
4. **Use different secrets for different environments**
5. **Monitor for secret exposure**

## 🧪 Testing Deployment

After deployment, test these endpoints:

- `GET /health` - Should return 200
- `POST /webhook/send-email` - Test email functionality
- Frontend should load and connect to backend

## 🚨 If Secrets Are Exposed

1. **Immediately** rotate all exposed secrets
2. Make repository private
3. Remove secrets from git history
4. Update all services with new secrets
