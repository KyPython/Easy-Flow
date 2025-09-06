# 🎯 **COPY-PASTE DEPLOYMENT GUIDE**

## ✅ **No Manual Labor - Everything Ready to Copy!**

Your existing config has 95% of what you need. Just copy-paste these sections.

---

## 🖥️ **RENDER.COM BACKEND - Copy This Entire Block:**

```
NODE_ENV=production
PORT=3030
SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk
SUPABASE_BUCKET=artifacts
SUPABASE_USE_SIGNED_URLS=true
SUPABASE_SIGNED_URL_EXPIRES=86400
API_KEY=9eac64d4d28c173808e062904c8b1e8921cbc8b3407ca13edf6381f6f05e5b5a
ADMIN_API_SECRET=9eac64d4d28c173808e062904c8b1e8921cbc8b3407ca13edf6381f6f05e5b5a
SENDGRID_API_KEY=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
SENDGRID_FROM_EMAIL=kyjahntsmith@gmail.com
SENDGRID_FROM_NAME=EasyFlow App
SEND_EMAIL_WEBHOOK_SECRET=a-new-strong-secret-for-the-worker
HUBSPOT_API_KEY=pat-na2-5db91be1-c751-40dd-9637-04d62797879a
UCHAT_API_KEY=mWVPDcEAUpgNOuUhPmXXE35ZrrSpWnsN9IGZYa82fdi5iopoUkzlsqpmQnoZ
POLAR_API_KEY=polar_oat_ft6uVPzm6izPEzlvLu8DCsxZUssbaUBPgBugt33oWyg
POLAR_WEBHOOK_SECRET=polar_whs_IpabYVmBzMlBhDikhPa6MjHtVzvpOjY1gdWlZ3dfzlM
DUCK_TOKEN=e13de687-4e11-478e-b689-657ace227208
MEASUREMENT_ID=G-QGYCGQFC6D
AUTOMATION_API_KEY=eba65f321bdb1ea05ad66842fbac56696066a4865cf84625d24f90390f229d2c
ALLOWED_ORIGINS=https://YOUR_FRONTEND_URL.vercel.app
AUTOMATION_URL=https://YOUR_AUTOMATION_URL.onrender.com
SEND_EMAIL_WEBHOOK=https://YOUR_BACKEND_URL.onrender.com/api/send-email-now
APP_URL=https://YOUR_FRONTEND_URL.vercel.app
```

---

## 🌐 **VERCEL FRONTEND - Copy This Entire Block:**

```
REACT_APP_SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0
REACT_APP_API_URL=https://YOUR_BACKEND_URL.onrender.com
REACT_APP_GA_MEASUREMENT_ID=G-QGYCGQFC6D
REACT_APP_ENABLE_REALTIME=true
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_NOTIFICATIONS=true
CI=false
GENERATE_SOURCEMAP=false
BUILD_PATH=build
```

---

## 🚀 **DEPLOYMENT STEPS:**

### **1. Deploy Backend (Render.com):**

1. Go to [render.com](https://render.com) → New Web Service
2. Connect GitHub → Select your repo
3. Settings:
   ```
   Name: easyflow-backend
   Environment: Node
   Build Command: cd rpa-system && npm install
   Start Command: cd rpa-system/backend && npm start
   ```
4. **Environment Variables:** Paste the entire RENDER.COM block above
5. Click **Create Web Service**

### **2. Deploy Frontend (Vercel):**

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import GitHub repo
3. Settings:
   ```
   Framework: Create React App
   Root Directory: rpa-system/rpa-dashboard
   ```
4. **Environment Variables:** Paste the entire VERCEL block above
5. Click **Deploy**

### **3. Update URLs (After Deployment):**

Once deployed, you'll get URLs like:

- Backend: `https://easyflow-backend-xyz.onrender.com`
- Frontend: `https://easyflow-abc.vercel.app`

**Update these 4 variables in Render.com:**

```
ALLOWED_ORIGINS=https://easyflow-abc.vercel.app
AUTOMATION_URL=https://easyflow-automation-xyz.onrender.com
SEND_EMAIL_WEBHOOK=https://easyflow-backend-xyz.onrender.com/api/send-email-now
APP_URL=https://easyflow-abc.vercel.app
```

**Update this 1 variable in Vercel:**

```
REACT_APP_API_URL=https://easyflow-backend-xyz.onrender.com
```

---

## ✅ **That's It!**

- ✅ **No API key generation needed** (using existing)
- ✅ **No credential hunting** (extracted from your files)
- ✅ **Just copy-paste and deploy**
- ✅ **Update 5 URLs after deployment**

**Total time: ~10 minutes!** 🎉

---

## 🛠️ **Helper Scripts Available:**

```bash
# Generate fresh environment variables from your current config
./scripts/generate-render-env.sh    # For Render.com
./scripts/generate-vercel-env.sh    # For Vercel

# Clean up Google Cloud resources
./scripts/cleanup-gcp-resources.sh  # Check what to delete
```
