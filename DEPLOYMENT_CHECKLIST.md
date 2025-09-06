# 🚀 Complete Deployment Guide & Configuration Checklist

## 📋 **CRITICAL: Placeholders to Update Before Deployment**

### **1. Environment Configuration Files**

#### **Backend (.env.render.example → Render.com Environment Variables)**

```bash
# ❌ REPLACE THESE PLACEHOLDERS:
SUPABASE_URL=https://your-project-ref.supabase.co  # Use: https://syxzilyuysdoirnezgii.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key        # Use your actual service role key
SUPABASE_ANON_KEY=your-anon-key                    # Use your actual anon key

FIREBASE_PROJECT_ID=your-firebase-project-id       # Use your Firebase project ID
FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com/

API_KEY=generate-secure-api-key-32-chars           # Generate: openssl rand -hex 32
AUTOMATION_API_KEY=generate-automation-api-key     # Generate: openssl rand -hex 32
SEND_EMAIL_WEBHOOK_SECRET=generate-webhook-secret  # Generate: openssl rand -hex 32

HUBSPOT_ACCESS_TOKEN=your-hubspot-token            # Get from HubSpot
MEASUREMENT_ID=your-google-analytics-id            # Use: G-QGYCGQFC6D

# ✅ UPDATE PRODUCTION URLS:
ALLOWED_ORIGINS=https://easyflow-dashboard.vercel.app,https://app.easyflow.com
AUTOMATION_URL=https://easyflow-automation.onrender.com/run
SEND_EMAIL_WEBHOOK=https://easyflow-backend.onrender.com/api/send-email-now
```

#### **Frontend (.env.vercel.example → Vercel Environment Variables)**

```bash
# ❌ REPLACE THESE PLACEHOLDERS:
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co     # Use: https://syxzilyuysdoirnezgii.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key                      # Use your actual anon key

# Firebase config - get from Firebase console
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com/
REACT_APP_FIREBASE_PROJECT_ID=your-firebase-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id
REACT_APP_FIREBASE_VAPID_KEY=your-vapid-key

# ✅ UPDATE PRODUCTION URL:
REACT_APP_API_URL=https://easyflow-backend.onrender.com
```

#### **Automation (.env)**

```bash
# ❌ REPLACE THIS PLACEHOLDER:
AUTOMATION_API_KEY=your-api-key-value-here  # Generate: openssl rand -hex 32
```

### **2. Firebase Service Account Key**

- Download `firebase-service-account.json` from Firebase Console
- Upload to Render.com as a secret file
- Update path in environment: `FIREBASE_SERVICE_ACCOUNT_PATH=/opt/render/project/src/rpa-system/backend/config/firebase-service-account.json`

## 🚀 **Complete Deployment Instructions**

### **Phase 1: Prepare Environment Variables**

#### **Generate Secure Keys**

```bash
# Generate API keys
openssl rand -hex 32  # For API_KEY
openssl rand -hex 32  # For AUTOMATION_API_KEY
openssl rand -hex 32  # For SEND_EMAIL_WEBHOOK_SECRET
```

#### **Get Firebase Configuration**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **General** → **Your apps**
4. Copy all the config values for your web app

### **Phase 2: Deploy Backend to Render.com**

1. **Connect Repository:**

   - Go to [Render.com](https://render.com/)
   - Click **New** → **Web Service**
   - Connect your GitHub repository
   - Select the `Easy-Flow` repository

2. **Configure Service:**

   ```
   Name: easyflow-backend
   Environment: Node
   Build Command: cd rpa-system && npm install
   Start Command: cd rpa-system/backend && npm start
   ```

3. **Set Environment Variables:**
   Copy all variables from `.env.render.example` with real values:

   ```bash
   NODE_ENV=production
   PORT=3030
   SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
   SUPABASE_SERVICE_ROLE=[your-actual-service-role-key]
   SUPABASE_ANON_KEY=[your-actual-anon-key]
   # ... (all other variables with real values)
   ```

4. **Upload Firebase Service Account:**
   - Go to **Environment** → **Secret Files**
   - Upload `firebase-service-account.json`
   - Set path: `/opt/render/project/src/rpa-system/backend/config/firebase-service-account.json`

### **Phase 3: Deploy Frontend to Vercel**

1. **Connect Repository:**

   - Go to [Vercel](https://vercel.com/)
   - Click **New Project**
   - Import your GitHub repository

2. **Configure Project:**

   ```
   Framework Preset: Create React App
   Root Directory: rpa-system/rpa-dashboard
   Build Command: npm run build
   Output Directory: build
   ```

3. **Set Environment Variables:**
   Copy all variables from `.env.vercel.example` with real values:
   ```bash
   REACT_APP_SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=[your-actual-anon-key]
   REACT_APP_API_URL=https://easyflow-backend.onrender.com
   # ... (all other Firebase variables with real values)
   ```

### **Phase 4: Deploy Automation Service to Render.com**

1. **Create New Web Service:**

   ```
   Name: easyflow-automation
   Environment: Python
   Build Command: cd rpa-system/automation && pip install -r requirements.txt
   Start Command: cd rpa-system/automation && python automate.py
   ```

2. **Set Environment Variables:**
   ```bash
   PORT=7001
   AUTOMATION_API_KEY=[generated-32-char-key]
   AUTOMATION_URL=https://easyflow-automation.onrender.com
   ```

### **Phase 5: Update GitHub Secrets**

Remove old VM secrets and add new ones:

#### **Add These:**

```bash
RENDER_API_KEY=[your-render-api-key]
VERCEL_ORG_ID=[your-vercel-org-id]
VERCEL_PROJECT_ID=[your-vercel-project-id]
VERCEL_TOKEN=[your-vercel-token]
```

### **Phase 6: Test Deployment**

1. **Test Backend:**

   ```bash
   curl https://easyflow-backend.onrender.com/health
   curl https://easyflow-backend.onrender.com/api/health/databases
   ```

2. **Test Frontend:**

   - Visit your Vercel URL
   - Check login functionality
   - Verify API connectivity

3. **Test Automation:**
   ```bash
   curl https://easyflow-automation.onrender.com/health
   ```
