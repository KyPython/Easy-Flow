# 🚀 EasyFlow Modern Deployment Guide

## Overview

This guide covers deploying EasyFlow using modern cloud platforms:

- **Backend & Automation**: Render.com
- **Frontend**: Vercel
- **Database**: Supabase (managed PostgreSQL)
- **Real-time & Notifications**: Firebase

## 📋 Prerequisites

### Required Accounts

- [ ] GitHub account with repository access
- [ ] Render.com account
- [ ] Vercel account
- [ ] Supabase project
- [ ] Firebase project
- [ ] Domain name (optional, for custom URLs)

### Required Tools

- [ ] Node.js 20.x or later
- [ ] npm or yarn
- [ ] Git
- [ ] Vercel CLI (optional)

## 🔧 Step 1: Environment Setup

### A. Supabase Configuration

1. **Create Supabase Project**

   ```bash
   # Go to https://supabase.com/dashboard
   # Create new project
   # Note down: URL, anon key, service role key
   ```

2. **Run Database Migrations**

   ```sql
   -- In Supabase SQL Editor, run files in order:
   -- rpa-system/backend/migrations/000-initial-schema.sql
   -- rpa-system/backend/migrations/001-create-profiles-and-backfill.sql
   -- rpa-system/backend/migrations/002-add-user-preferences.sql
   -- rpa-system/backend/migrations/003-enhance-user-settings.sql
   ```

3. **Configure Storage**
   ```bash
   # Create bucket named 'artifacts' in Supabase Storage
   # Set policies for authenticated users
   ```

### B. Firebase Configuration

1. **Create Firebase Project**

   ```bash
   # Go to https://console.firebase.google.com
   # Create new project
   # Enable Realtime Database
   # Enable Cloud Messaging
   ```

2. **Generate Service Account**

   ```bash
   # Project Settings > Service Accounts
   # Generate new private key
   # Save as: rpa-system/backend/config/firebase-service-account.json
   ```

3. **Configure Web App**
   ```bash
   # Project Settings > General > Your apps
   # Add web app
   # Copy configuration values
   ```

## 🚀 Step 2: Backend Deployment (Render.com)

### A. Prepare Repository

1. **Push Code to GitHub**

   ```bash
   git add .
   git commit -m "🚀 Prepare for deployment"
   git push origin main
   ```

2. **Add Service Account to Repository**
   ```bash
   # Add firebase-service-account.json to:
   # rpa-system/backend/config/firebase-service-account.json
   # Make sure it's gitignored for security
   ```

### B. Deploy to Render

1. **Connect Repository**

   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect GitHub repository
   - Select `render.yaml` file

2. **Configure Environment Variables**

   ```bash
   # In Render Dashboard, set these variables:
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com/
   API_KEY=generate-32-char-api-key
   AUTOMATION_API_KEY=generate-automation-key
   ```

3. **Deploy Services**
   ```bash
   # Render will automatically deploy:
   # - easyflow-backend (Node.js API)
   # - easyflow-automation (Python service)
   # - easyflow-email-worker (Background worker)
   ```

### C. Verify Backend Deployment

```bash
# Check service health
curl https://easyflow-backend.onrender.com/health
curl https://easyflow-backend.onrender.com/api/health/databases
curl https://easyflow-automation.onrender.com/health
```

## 🌐 Step 3: Frontend Deployment (Vercel)

### A. Configure Environment

1. **Create Environment File**

   ```bash
   # Copy rpa-system/rpa-dashboard/.env.vercel.example
   # to rpa-system/rpa-dashboard/.env.production
   ```

2. **Set Environment Variables**
   ```bash
   REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   REACT_APP_API_URL=https://easyflow-backend.onrender.com
   # ... (all Firebase config vars)
   ```

### B. Deploy to Vercel

1. **Connect Repository**

   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import from GitHub
   - Select repository

2. **Configure Build Settings**

   ```bash
   # Build Command: cd rpa-system/rpa-dashboard && npm run build
   # Output Directory: rpa-system/rpa-dashboard/build
   # Install Command: cd rpa-system/rpa-dashboard && npm install
   ```

3. **Set Environment Variables**
   ```bash
   # In Vercel Project Settings > Environment Variables
   # Add all REACT_APP_* variables from .env.production
   ```

### C. Verify Frontend Deployment

```bash
# Check frontend accessibility
curl https://easyflow-dashboard.vercel.app

# Test API integration
# Open browser and test login/functionality
```

## 🔄 Step 4: CI/CD Setup

### A. Configure GitHub Secrets

Add these secrets to your GitHub repository:

```bash
# Render Configuration
RENDER_SERVICE_ID=srv_xxx  # From Render dashboard
RENDER_API_KEY=rnd_xxx     # From Render account settings

# Vercel Configuration
VERCEL_TOKEN=xxx           # From Vercel account settings
VERCEL_ORG_ID=xxx          # From Vercel team settings
VERCEL_PROJECT_ID=xxx      # From Vercel project settings

# Environment URLs
BACKEND_URL=https://easyflow-backend.onrender.com
FRONTEND_URL=https://easyflow-dashboard.vercel.app
AUTOMATION_URL=https://easyflow-automation.onrender.com

# All REACT_APP_* environment variables
REACT_APP_SUPABASE_URL=xxx
REACT_APP_SUPABASE_ANON_KEY=xxx
# ... (add all frontend env vars)
```

### B. Enable Automatic Deployments

The GitHub Action `.github/workflows/deploy-modern.yml` will:

- ✅ Run tests on push to main
- ✅ Deploy backend to Render
- ✅ Deploy frontend to Vercel
- ✅ Run health checks
- ✅ Notify on success/failure

## 📊 Step 5: Monitoring & Maintenance

### A. Health Monitoring

```bash
# Set up monitoring dashboards for:
# - Backend API health
# - Database connectivity
# - Firebase integration
# - Automation service status
```

### B. Performance Optimization

```bash
# Configure CDN for static assets
# Enable gzip compression
# Set up database connection pooling
# Configure Redis caching (optional)
```

### C. Security Hardening

```bash
# Enable CORS properly
# Set up rate limiting
# Configure CSP headers
# Regular dependency updates
```

## 🛠️ Step 6: Custom Domain (Optional)

### A. Backend Domain

1. **Configure DNS**

   ```bash
   # Add CNAME record:
   # api.yourdomain.com → easyflow-backend.onrender.com
   ```

2. **Add Custom Domain in Render**
   ```bash
   # Render Dashboard > Service > Settings > Custom Domains
   # Add: api.yourdomain.com
   # Enable automatic TLS
   ```

### B. Frontend Domain

1. **Configure DNS**

   ```bash
   # Add CNAME record:
   # app.yourdomain.com → cname.vercel-dns.com
   ```

2. **Add Custom Domain in Vercel**
   ```bash
   # Vercel Dashboard > Project > Settings > Domains
   # Add: app.yourdomain.com
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**

   ```bash
   # Check Node.js version compatibility
   # Verify environment variables
   # Check for missing dependencies
   ```

2. **Database Connection Issues**

   ```bash
   # Verify Supabase URL and keys
   # Check firewall settings
   # Validate connection string format
   ```

3. **Firebase Integration Problems**
   ```bash
   # Verify service account permissions
   # Check Firebase project configuration
   # Validate environment variables
   ```

### Support Resources

- 📖 [Render Documentation](https://render.com/docs)
- 📖 [Vercel Documentation](https://vercel.com/docs)
- 📖 [Supabase Documentation](https://supabase.com/docs)
- 📖 [Firebase Documentation](https://firebase.google.com/docs)

## 📈 Deployment Summary

After successful deployment, you'll have:

- ✅ **Backend API**: Highly available on Render.com
- ✅ **Frontend App**: Fast global CDN via Vercel
- ✅ **Database**: Managed PostgreSQL via Supabase
- ✅ **Real-time**: Firebase for notifications
- ✅ **CI/CD**: Automated deployments via GitHub Actions
- ✅ **Monitoring**: Health checks and status endpoints
- ✅ **Security**: HTTPS, environment isolation
- ✅ **Scalability**: Auto-scaling infrastructure

**Total Setup Time**: ~2-3 hours
**Monthly Cost**: ~$20-50 (depending on usage)
**Availability**: 99.9%+ uptime

---

_For issues or questions, check the troubleshooting section or create a GitHub issue._
