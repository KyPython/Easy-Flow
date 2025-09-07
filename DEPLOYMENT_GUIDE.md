# 🚀 EasyFlow Modern Deployment Guide

- **Backend API**: Render.com (Node.js)
- **Python Automation**: Render.com (RPA/Selenium service)
- **Frontend**: Vercel (React)

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