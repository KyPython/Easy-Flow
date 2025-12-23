# 🔐 EasyFlow Environment Variables Reference

**⚠️ DO NOT COMMIT ACTUAL VALUES TO GIT**

This document lists all required environment variables. Store actual values in:
- Password manager (recommended)
- Render.com dashboard (production)
- GitHub Secrets (CI/CD only)
- Local `.env` files (development only - in .gitignore)

---

## 📦 **Backend (Node.js)**

**File:** `rpa-system/backend/.env`

### **Required:**
```bash
# Supabase Database
SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
SUPABASE_SERVICE_ROLE=<service-role-key>
SUPABASE_KEY=<anon-key>

# Node Environment
NODE_ENV=production
PORT=3030
```

### **Optional (but recommended):**
```bash
# OpenAI (for AI features)
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4-turbo-preview

# SendGrid (for emails)
SENDGRID_API_KEY=<your-key>
SENDGRID_FROM_EMAIL=support@useeasyflow.com

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_PRIVATE_KEY=<private-key>
FIREBASE_CLIENT_EMAIL=<client-email>

# Kafka (for message queue)
KAFKA_BROKERS=<broker-url>
KAFKA_CLIENT_ID=easyflow-backend
KAFKA_ENABLED=true

# Redis (for caching)
REDIS_URL=<redis-url>

# Security
SESSION_SECRET=<random-32-char-string>
ADMIN_API_SECRET=<random-secret>

# Polar (payments)
POLAR_ACCESS_TOKEN=<token>
POLAR_WEBHOOK_SECRET=<secret>

# HubSpot (CRM)
HUBSPOT_API_KEY=<key>

# Snyk (security scanning)
SNYK_TOKEN=<token>
```

---

## 🎨 **Frontend (React)**

**File:** `rpa-system/rpa-dashboard/.env.local`

### **Required:**
```bash
# Supabase Client
REACT_APP_SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon-key>

# API Base URL
REACT_APP_API_BASE_URL=https://easyflow-backend.onrender.com
```

### **Optional:**
```bash
# Firebase Client
REACT_APP_FIREBASE_API_KEY=<api-key>
REACT_APP_FIREBASE_AUTH_DOMAIN=<auth-domain>
REACT_APP_FIREBASE_DATABASE_URL=<database-url>
REACT_APP_FIREBASE_PROJECT_ID=<project-id>
REACT_APP_FIREBASE_STORAGE_BUCKET=<storage-bucket>
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
REACT_APP_FIREBASE_APP_ID=<app-id>

# Public URL
REACT_APP_PUBLIC_URL=https://tryeasyflow.com
```

---

## 🤖 **Automation Worker (Python)**

**File:** `rpa-system/automation/automation-service/.env`

### **Required:**
```bash
# Supabase
SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
SUPABASE_KEY=<service-role-key>

# Backend
BACKEND_URL=https://easyflow-backend.onrender.com

# Kafka
KAFKA_BROKERS=<broker-url>
KAFKA_BOOTSTRAP_SERVERS=<broker-url>
```

---

## 🔍 **How to Get These Values**

### **Supabase:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy `URL` → `SUPABASE_URL`
3. Copy `anon public` → `SUPABASE_KEY` / `SUPABASE_ANON_KEY`
4. Copy `service_role` → `SUPABASE_SERVICE_ROLE`

### **OpenAI:**
1. Go to https://platform.openai.com/api-keys
2. Create new API key
3. Copy to `OPENAI_API_KEY`

### **SendGrid:**
1. Go to SendGrid Dashboard → Settings → API Keys
2. Create API key with "Full Access"
3. Copy to `SENDGRID_API_KEY`

### **Firebase:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Extract values from JSON file

### **Kafka/Redis:**
- Local dev: Use Docker Compose (auto-configured)
- Production: Get from cloud provider (Render, AWS, etc.)

---

## ✅ **Verification**

After setting up environment variables, verify:

```bash
# Backend
cd rpa-system/backend
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing')"

# Frontend
cd rpa-system/rpa-dashboard
node -e "console.log('REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing')"
```

---

## 🚨 **Security Notes**

1. **Never commit `.env` files** (already in .gitignore)
2. **Use different keys for dev/prod**
3. **Rotate secrets if computer is compromised**
4. **Store in password manager** for easy recovery
5. **Use service role keys only in backend** (never in frontend)

---

**Last Updated:** 2025-12-23

