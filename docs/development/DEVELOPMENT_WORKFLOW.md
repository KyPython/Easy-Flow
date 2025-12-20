# EasyFlow Development Workflow

**Simple, practical workflow for developing, testing, and deploying EasyFlow**

---

## 🚀 Daily Development Workflow

### 1. Start Development Environment

```bash
./start-dev.sh
```

This starts:
- Backend (port 3030)
- Frontend (port 3000)
- Automation Worker (port 7070)
- Kafka & Zookeeper
- Observability stack (Grafana, Prometheus, Loki, Tempo)

**Verify it's running:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3030/health
- Grafana: http://localhost:3001 (admin/admin123)

---

### 2. Make Your Changes

Work on your feature/bugfix in your editor.

**Quick test while developing:**
- Make a change
- Check if it works in the browser/API
- Fix issues as you go

---

### 3. Before Committing: Quick Validation

**Run this before every commit:**

```bash
# Quick check (linting + tests)
npm run lint:test
```

This runs:
- Frontend linting
- Backend linting
- Quick tests

**If it passes:** You're good to commit.

**If it fails:** Fix the issues, then commit.

---

### 4. Commit Your Changes

```bash
# Create/switch to feature branch (if needed)
./scripts/git-workflow-helper.sh branch:create feature your-feature-name

# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat(scope): what you did"
```

**Commit message format:**
- `feat(auth): add login functionality`
- `fix(kafka): resolve consumer stuck issue`
- `refactor(backend): split app.js into modules`

---

### 5. Before Pushing: Full Check

**Before pushing to GitHub, run full validation:**

```bash
# Full test suite (optional, but recommended)
npm run test:all
```

This runs:
- Environment check
- Linting (frontend + backend)
- Tests (frontend + backend + Python)
- Build verification
- Code quality check

**If it passes:** Push to GitHub.

**If it fails:** Fix issues, then push.

---

### 6. Push and Deploy

```bash
# Push to GitHub
git push origin main  # or your branch name

# If ready for production, deploy
./scripts/deploy.sh
```

---

## 🛑 Stop Development Environment

```bash
./stop-dev.sh
```

This stops all services cleanly.

---

## 📋 Workflow Summary

**Daily workflow:**
1. `./start-dev.sh` - Start everything
2. Make changes
3. `npm run lint:test` - Quick validation
4. `git commit` - Commit changes
5. `npm run test:all` - Full check (before pushing)
6. `git push` - Push to GitHub
7. `./stop-dev.sh` - Stop when done

**Before production:**
- Run `npm run test:all` (must pass)
- Run `npm run quality:check` (review issues)
- Deploy with `./scripts/deploy.sh`

---

## 🔍 Debugging Workflow

**When something breaks:**

1. **Check logs:**
   ```bash
   # Backend logs
   tail -f logs/backend.log
   
   # Automation worker logs
   tail -f logs/automation-worker.log
   ```

2. **Check observability:**
   - Grafana: http://localhost:3001
   - See [OBSERVABILITY.md](./OBSERVABILITY.md) for details

3. **Fix the issue**
4. **Test locally** (manual testing)
5. **Run `npm run lint:test`** before committing

---

## ⚡ Quick Commands Reference

```bash
# Start/Stop
./start-dev.sh          # Start everything
./stop-dev.sh           # Stop everything

# Testing
npm run lint:test       # Quick validation (before commit)
npm run test:all        # Full test suite (before push)
npm run quality:check   # Code quality check

# Git
git add .
git commit -m "feat(scope): description"
git push

# Deployment
./scripts/deploy.sh     # Deploy to production
```

---

## 🎯 Key Principles

1. **Test before committing** - Run `npm run lint:test`
2. **Test before pushing** - Run `npm run test:all`
3. **Test before deploying** - Full validation must pass
4. **Use observability** - Check Grafana when debugging
5. **Keep it simple** - Don't over-engineer, just make it work

---

## 🚨 Common Issues

**Port already in use:**
```bash
./stop-dev.sh  # Stops everything
./start-dev.sh # Restart
```

**Tests failing:**
- Check logs: `tail -f logs/backend.log`
- Fix the issue
- Re-run: `npm run lint:test`

**Can't connect to services:**
- Verify services are running: `docker ps`
- Check health: `curl http://localhost:3030/health`
- Restart: `./stop-dev.sh && ./start-dev.sh`

---

**Remember:** The goal is to catch issues early, not to have perfect tests. Quick validation before commit, full validation before push, manual testing to verify it works.

