# 🛡️ EasyFlow Disaster Recovery Plan

**Last Updated:** 2025-12-23

This document ensures EasyFlow can be fully recovered if your computer is destroyed.

---

## ✅ **What's Already Backed Up (Automatic)**

### 1. **Code Repository** ✅
- **Location:** GitHub (`KyPython/Easy-Flow`)
- **Branch:** `main` (production), `dev` (development)
- **Status:** All code is in Git - automatically backed up
- **Recovery:** `git clone https://github.com/KyPython/Easy-Flow.git`

### 2. **Database** ✅
- **Location:** Supabase (cloud-hosted PostgreSQL)
- **Status:** Automatic daily backups enabled by Supabase
- **Recovery:** Supabase dashboard → Database → Backups
- **Schema:** `docs/database/safe_migration.sql` (run to recreate schema)

### 3. **Deployment Configuration** ✅
- **Location:** `render.yaml` (in GitHub)
- **Status:** Render.com auto-deploys from GitHub
- **Recovery:** Render reads from GitHub automatically

### 4. **CI/CD Workflows** ✅
- **Location:** `.github/workflows/` (in GitHub)
- **Status:** All workflows stored in Git
- **Recovery:** Automatically available after `git clone`

---

## 🔐 **What You Need to Back Up (Manual)**

### **Critical Secrets & Environment Variables**

These are stored in:
1. **GitHub Secrets** (for CI/CD)
2. **Render.com Environment Variables** (for production)
3. **Supabase Dashboard** (for database)
4. **Your password manager** (recommended: 1Password, Bitwarden, or similar)

#### **Required Environment Variables**

**Backend (Node.js):**
```bash
# Supabase (Database)
SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
SUPABASE_SERVICE_ROLE=<service-role-key>
SUPABASE_KEY=<anon-key>

# OpenAI (AI Features)
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4-turbo-preview

# SendGrid (Email)
SENDGRID_API_KEY=<your-sendgrid-key>
SENDGRID_FROM_EMAIL=support@useeasyflow.com

# Firebase (Notifications)
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_PRIVATE_KEY=<private-key>
FIREBASE_CLIENT_EMAIL=<client-email>

# Kafka (Message Queue)
KAFKA_BROKERS=<kafka-broker-url>
KAFKA_CLIENT_ID=easyflow-backend

# Redis (Caching)
REDIS_URL=<redis-url>

# Security
SESSION_SECRET=<random-secret>
ADMIN_API_SECRET=<admin-secret>

# Polar (Payments - if used)
POLAR_ACCESS_TOKEN=<polar-token>
POLAR_WEBHOOK_SECRET=<webhook-secret>

# HubSpot (CRM - if used)
HUBSPOT_API_KEY=<hubspot-key>

# Snyk (Security Scanning)
SNYK_TOKEN=<snyk-token>
```

**Frontend (React):**
```bash
# Supabase (Client)
REACT_APP_SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon-key>

# Firebase (Client)
REACT_APP_FIREBASE_API_KEY=<api-key>
REACT_APP_FIREBASE_AUTH_DOMAIN=<auth-domain>
REACT_APP_FIREBASE_DATABASE_URL=<database-url>
REACT_APP_FIREBASE_PROJECT_ID=<project-id>
REACT_APP_FIREBASE_STORAGE_BUCKET=<storage-bucket>
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
REACT_APP_FIREBASE_APP_ID=<app-id>

# API
REACT_APP_API_BASE_URL=https://easyflow-backend.onrender.com
```

**Automation Worker (Python):**
```bash
# Supabase
SUPABASE_URL=https://syxzilyuysdoirnezgii.supabase.co
SUPABASE_KEY=<service-role-key>

# Backend
BACKEND_URL=https://easyflow-backend.onrender.com

# Kafka
KAFKA_BROKERS=<kafka-broker-url>
```

---

## 📋 **Recovery Procedure (If Computer is Destroyed)**

### **Step 1: Get a New Computer**
- Any Mac/Windows/Linux machine with:
  - Node.js 20+
  - Python 3.9+
  - Git
  - Docker (optional, for local dev)

### **Step 2: Clone Repository**
```bash
git clone https://github.com/KyPython/Easy-Flow.git
cd Easy-Flow
```

### **Step 3: Restore Environment Variables**

**Option A: From Password Manager** (Recommended)
- Open your password manager
- Find "EasyFlow Environment Variables"
- Copy values to `.env` files

**Option B: From Render.com Dashboard**
1. Go to Render.com → Your services
2. Click each service → Environment
3. Copy all environment variables
4. Create `.env` files locally

**Option C: From GitHub Secrets** (for CI/CD only)
1. GitHub → Settings → Secrets and variables → Actions
2. Copy secrets (but these are for CI/CD, not local dev)

### **Step 4: Verify Database Schema**
```bash
# Run the safe migration in Supabase SQL Editor
# File: docs/database/safe_migration.sql
```

### **Step 5: Start Development**
```bash
./start-dev.sh
```

---

## 🔍 **Backup Verification Checklist**

Run this monthly to ensure everything is backed up:

- [ ] **Code:** `git push origin main` (verify on GitHub)
- [ ] **Database:** Check Supabase dashboard → Backups (should show daily backups)
- [ ] **Secrets:** Verify all env vars are in password manager
- [ ] **Deployment:** Verify `render.yaml` is in GitHub
- [ ] **CI/CD:** Verify `.github/workflows/` files are in GitHub

---

## 🚨 **Emergency Contacts & Access**

### **Service Access:**
- **GitHub:** https://github.com/KyPython/Easy-Flow
- **Supabase:** https://supabase.com/dashboard (your project)
- **Render.com:** https://dashboard.render.com
- **Firebase:** https://console.firebase.google.com
- **SendGrid:** https://app.sendgrid.com

### **Recovery Time Estimate:**
- **Code recovery:** 5 minutes (git clone)
- **Environment setup:** 30 minutes (install tools, restore env vars)
- **Database verification:** 5 minutes (run migration SQL)
- **Total:** ~40 minutes to full recovery

---

## 📝 **Where Secrets Are Stored**

### **Production (Render.com):**
- Backend service → Environment tab
- Automation worker → Environment tab
- All secrets stored in Render's secure vault

### **CI/CD (GitHub):**
- Settings → Secrets and variables → Actions
- Used by GitHub Actions workflows

### **Local Development:**
- `rpa-system/backend/.env` (NOT in Git - in .gitignore)
- `rpa-system/rpa-dashboard/.env.local` (NOT in Git)
- Store these in password manager, not in code

---

## ✅ **What Makes This Bulletproof**

1. **Code:** 100% in GitHub (automatic)
2. **Database:** Cloud-hosted (Supabase) with automatic backups
3. **Deployment:** Infrastructure as code (`render.yaml`)
4. **Secrets:** Stored in cloud services (Render, GitHub Secrets)
5. **Documentation:** This file + `docs/WORKFLOW.md`

**The only thing you need to recover:**
- Environment variables (stored in password manager)
- Access to cloud services (GitHub, Supabase, Render)

---

## 🔒 **Security Best Practices**

1. **Never commit secrets to Git** (already in .gitignore)
2. **Use password manager** for local env vars
3. **Rotate secrets regularly** (especially if computer is compromised)
4. **Use 2FA** on all cloud services
5. **Backup password manager** separately

---

## 📞 **If You Need Help**

1. Check this document first
2. Check `docs/WORKFLOW.md` for daily workflow
3. Check GitHub Issues for known problems
4. Contact: support@useeasyflow.com

---

**Last Verified:** 2025-12-23
**Next Review:** 2026-01-23 (monthly)

