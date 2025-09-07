# 🚀 EasyFlow Modern Deployment Guide

## Overview

This guide covers deploying EasyFlow using modern cloud platforms:

- **Backend API**: Render.com (Node.js)
- **Python Automation**: Render.com (RPA/Selenium service)
- **Frontend**: Vercel (React)

**🤖 Architecture**: Your system requires **THREE separate services** on Render.com:

1. Node.js API server (database, auth, webhooks)
2. Python automation service (browser automation, form filling)
3. Email worker (background job processing)

## 🚀 Backend Deployment (Render.com)

### B. Deploy to Render

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

   The `render.yaml` blueprint will automatically deploy **three separate services**:

   **🟦 easyflow-backend** (Node.js API)

   - Main API server (port 3030)
   - Database operations, authentication
   - Webhook endpoints

   **🟨 easyflow-automation** (Python Service)

   - **CRITICAL**: Selenium WebDriver automation
   - Website scraping and form filling
   - Credential encryption/decryption
   - Browser automation (Chrome/Firefox)

   **🟪 easyflow-email-worker** (Background Worker)

   - Email queue processing
   - SendGrid integration

### C. Verify All Service Deployments

```bash
# Check all three services are running:

# 1. Main API Service
curl https://easyflow-backend.onrender.com/health
curl https://easyflow-backend.onrender.com/api/health/databases

# 2. Python Automation Service (REQUIRED for RPA functionality)
curl https://easyflow-automation.onrender.com/health

# 3. Email Worker Service
# (Background worker - no health endpoint)
```

**⚠️ IMPORTANT**: The Python automation service is **essential** - without it, your RPA system cannot automate websites or fill forms. The Node.js backend cannot perform browser automation.

## 🌐 Step 3: Frontend Deployment (Vercel)


### A. Configure Environment
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

## 🔄 Step 4: Automatic Deployments

### ✅ Built-in Auto-Deployment

**No GitHub Actions needed!** Both platforms auto-deploy on git push:

**🟦 Render.com Auto-Deployment:**

- ✅ **Triggers**: Every push to `main` branch
- ✅ **Services**: All 3 services deploy automatically
- ✅ **Build logs**: Available in Render dashboard
- ✅ **Health checks**: Built-in service monitoring

**🟨 Vercel Auto-Deployment:**

- ✅ **Triggers**: Every push to `main` branch
- ✅ **Preview builds**: Automatic for pull requests
- ✅ **Build logs**: Available in Vercel dashboard
- ✅ **CDN**: Global edge deployment

### 🔧 How It Works

1. **Push code** to GitHub `main` branch
2. **Render detects** the push and rebuilds all services
3. **Vercel detects** the push and rebuilds frontend
4. **Both deploy** automatically within 2-5 minutes
5. **Health checks** run automatically

```bash
# Simple deployment workflow:
git add .
git commit -m "✨ New feature"
git push origin main
# ⏱️ Wait 2-5 minutes - everything deploys automatically!
```

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
- ✅ **Auto-Deployment**: Push to git = automatic deployment
- ✅ **Monitoring**: Built-in health checks and status
- ✅ **Security**: HTTPS, environment isolation
- ✅ **Scalability**: Auto-scaling infrastructure

**Total Setup Time**: ~2-3 hours
**Monthly Cost**: ~$20-50 (depending on usage)
**Availability**: 99.9%+ uptime
