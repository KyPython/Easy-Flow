# ✅ EasyFlow Backup Verification Checklist

**Run this monthly to ensure everything is recoverable.**

---

## 📦 **Code Backup**

- [ ] **GitHub Repository:**
  - [ ] Visit: https://github.com/KyPython/Easy-Flow
  - [ ] Verify latest commit is recent
  - [ ] Verify `main` branch is up to date
  - [ ] Verify `dev` branch exists and is synced

- [ ] **Local Git Status:**
  ```bash
  git status
  git log --oneline -5
  ```
  - [ ] No uncommitted changes (or they're intentionally WIP)
  - [ ] Latest commits are pushed to GitHub

---

## 🗄️ **Database Backup**

- [ ] **Supabase Backups:**
  - [ ] Go to Supabase Dashboard → Database → Backups
  - [ ] Verify daily backups are running
  - [ ] Verify backup retention period (should be 7+ days)
  - [ ] Test restore process (optional, quarterly)

- [ ] **Database Schema:**
  - [ ] Verify `docs/database/safe_migration.sql` is in GitHub
  - [ ] Verify schema matches production (run migration to test)

---

## 🔐 **Secrets Backup**

- [ ] **Password Manager:**
  - [ ] All environment variables stored in password manager
  - [ ] Password manager itself is backed up
  - [ ] 2FA enabled on password manager

- [ ] **Cloud Services:**
  - [ ] Render.com → All services → Environment variables documented
  - [ ] GitHub → Secrets and variables → Actions → All secrets listed
  - [ ] Supabase → Project Settings → API keys documented

---

## 🚀 **Deployment Configuration**

- [ ] **Infrastructure as Code:**
  - [ ] `render.yaml` is in GitHub
  - [ ] `docker-compose.yml` is in GitHub
  - [ ] `.github/workflows/` files are in GitHub

- [ ] **Deployment Status:**
  - [ ] Render.com services are running
  - [ ] Auto-deploy is enabled
  - [ ] Latest code is deployed

---

## 📚 **Documentation Backup**

- [ ] **Critical Docs in GitHub:**
  - [ ] `docs/WORKFLOW.md` (daily workflow)
  - [ ] `docs/DISASTER_RECOVERY.md` (this recovery plan)
  - [ ] `docs/ENVIRONMENT_VARIABLES.md` (env var reference)
  - [ ] `README.md` (project overview)

---

## 🧪 **Recovery Test (Quarterly)**

**Test full recovery on a new machine:**

- [ ] Clone repository: `git clone https://github.com/KyPython/Easy-Flow.git`
- [ ] Restore environment variables from password manager
- [ ] Run `./start-dev.sh` - verify it works
- [ ] Verify database connection works
- [ ] Verify all services start correctly

**Time to recovery:** Should be < 1 hour

---

## 📊 **Backup Status Summary**

**Last Verified:** _______________

**Next Review:** _______________ (30 days from last verification)

**Issues Found:** _______________

**Action Items:** _______________

---

## 🚨 **If Something is Missing**

1. **Code not in GitHub:**
   ```bash
   git add -A
   git commit -m "backup: ensure all code is committed"
   git push origin main
   ```

2. **Secrets not documented:**
   - Add to password manager immediately
   - Update `docs/ENVIRONMENT_VARIABLES.md` with variable names (not values)

3. **Database backup failing:**
   - Check Supabase dashboard
   - Contact Supabase support if needed

4. **Deployment config missing:**
   - Ensure `render.yaml` is committed
   - Verify Render.com is reading from GitHub

---

**Remember:** The goal is to recover in < 1 hour if your computer is destroyed.

