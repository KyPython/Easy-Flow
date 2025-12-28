# Quick Reference - EasyFlow

**One-page cheat sheet for daily work**

---

## 🚀 Start/Stop

```bash
./start-dev.sh      # Start all services
./stop-dev.sh        # Stop all services
npm run logs         # Watch logs
```

---

## 📝 Daily Workflow

```bash
# 1. Start
git checkout dev
./start-dev.sh

# 2. Work
# ... make changes ...

# 3. Commit (pre-commit runs automatically)
git add .
git commit -m "feat: description"
git push origin dev

# 4. Ship to production (when ready)
npm run assess:features  # Check what's ready (automated assessment)
npm run ship:features    # Ship ready features (fully automated)
# OR
npm run ship             # Ship entire dev branch (fully automated)

# 5. Stop
./stop-dev.sh
```

---

## ✅ Validation & Auto-Fix

```bash
npm run validate:all        # All validations
npm run validate:srp        # SRP validation
npm run validate:rag        # RAG knowledge validation
npm run validate:theme     # Theme consistency
npm run test:all            # Run all tests
npm run fix                 # Auto-fix formatting (ESLint, Terraform, Shell)
```

---

## 🔧 Common Tasks

### Add Feature
1. Make changes on `dev` branch
2. Test: `npm run test:all`
3. Validate: `npm run validate:all`
4. Commit: `git commit -m "feat: feature-name"` (use `feat:` prefix for auto-detection)
5. Push: `git push origin dev`
6. Check readiness: `npm run assess:features` (automated)
7. Ship when ready: `npm run ship:features` (fully automated)

### Fix Bug
1. Reproduce on `dev` branch
2. Fix and test
3. Commit: `git commit -m "fix: bug description"`
4. Push: `git push origin dev`

### Update AI Agent Knowledge
1. Edit: `rpa-system/backend/services/ragClient.js`
2. Validate: `npm run validate:rag`
3. Commit: `git commit -m "docs: update AI knowledge"`

---

## 🌐 URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001

---

## 🎯 Branch Strategy

- **Dev** (`dev`): Permissive, allows WIP code
- **Main** (`main`): Strict, production-ready only

**Shipping Options** (both fully automated):
- `npm run ship:features` - Ship only ready features (assesses → ships ready ones)
- `npm run ship` - Ship entire dev branch (all changes)

**Feature Assessment** (automated):
- `npm run assess:features` - Check which features are ready for production
- Runs automatically on dev branch pushes (optional, non-blocking)
- Scheduled daily at 9 AM UTC

---

## 🐛 Quick Fixes

| Issue | Fix |
|-------|-----|
| Firebase errors | Check `FIREBASE_PROJECT_ID` matches in backend/frontend |
| RAG unavailable | Start: `cd /Users/ky/rag-node-ts && npm run dev` |
| Validation fails | Run specific: `npm run validate:srp` |
| Can't commit | Check branch: `git branch` (should be `dev`) |

---

## 📚 Full Documentation

- **[DAILY_DEVELOPER_GUIDE.md](DAILY_DEVELOPER_GUIDE.md)** - Complete daily guide
- **[CODEBASE_NAVIGATION.md](CODEBASE_NAVIGATION.md)** - Find any code
- **[BRANCH_AWARE_CI_CD.md](docs/BRANCH_AWARE_CI_CD.md)** - CI/CD details
- **[FEATURE_SHIPPING_GUIDE.md](docs/FEATURE_SHIPPING_GUIDE.md)** - Feature assessment & shipping

---

## ✅ Automation Status

**Fully Automated** (no manual steps):
- ✅ Pre-commit hooks (runs automatically on commit)
- ✅ CI/CD validation (runs automatically on push)
- ✅ Feature assessment (`npm run assess:features`)
- ✅ Shipping to production (`npm run ship` or `npm run ship:features`)
- ✅ All validation checks
- ✅ Auto-fix formatting (`npm run fix`)

**Manual Steps** (expected - you write the code):
- Writing code
- Running tests locally (optional - CI runs them automatically)
- Committing changes
- Pushing to git

---

**Last Updated**: 2025-12-28
