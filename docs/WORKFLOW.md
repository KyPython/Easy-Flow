# Your Daily Workflow

**What you do every time you open this project**

## 🚀 Starting Your Work Session

```bash
# 1. Open terminal in project root
cd /Users/ky/Easy-Flow

# 2. Start everything (one command)
./start-dev.sh
```

**What this does:**
- ✅ Checks your environment (Node, Python, Docker, etc.)
- ✅ Starts Kafka & Zookeeper (Docker)
- ✅ Starts Observability Stack (Grafana, Prometheus, Loki, Tempo)
- ✅ Starts Backend API (port 3030)
- ✅ Starts Frontend Dashboard (port 3000)
- ✅ Starts Automation Worker (port 7070)
- ✅ Opens browser automatically to http://localhost:3000

**Wait for:** "✅ All services started" message

**Verify it's working:**
- Browser should open automatically to http://localhost:3000
- Or manually open http://localhost:3000 (frontend)
- Check http://localhost:3030/health (backend health check)

---

## 💻 While You Work

1. **Make your changes** in your editor
2. **Test manually** in the browser (http://localhost:3000)
3. **Watch logs** if something breaks:
   ```bash
   npm run logs              # Watch all logs (color-coded, recommended)
   # OR individually:
   tail -f logs/backend.log
   tail -f logs/automation-worker.log
   ```

---

## ✅ Committing Your Work

**Important: Use `dev` branch for work-in-progress, `main` for production-ready code**

- **`dev` branch** = Work in progress, experimental features, backups (NOT deployed)
- **`main` branch** = Production-ready code (auto-deploys to your site providers)

**Husky automatically runs validation before commits and pushes:**

- **Pre-commit hook** (via Husky): Runs quick linting and build checks
- **Pre-push hook** (via Husky): Runs comprehensive tests and security scans
- **Commit-msg hook** (via Husky): Validates commit message format (Conventional Commits)

### Working on `dev` branch (recommended for daily work):

```bash
# Make sure you're on dev branch
git checkout dev

# Stage your changes
git add .

# Commit with descriptive message (pre-commit hook runs automatically)
git commit -m "feat(scope): what you did"
# Examples:
#   feat(auth): add login functionality
#   fix(kafka): resolve consumer stuck issue
#   refactor(backend): split app.js into modules

# Push to GitHub (saves your code, but NOT deployed to production)
git push origin dev
```

**Benefits:**
- ✅ Your code is backed up on GitHub
- ✅ NOT deployed to production (main branch stays clean)
- ✅ Can experiment freely without breaking production

**What runs automatically (pre-commit hook):**
- ✅ Frontend linting
- ✅ Backend linting
- ✅ Quick tests
- ✅ Build verification
- ✅ Environment check
- ✅ Code quality check

**If validation fails:** The commit is blocked. Fix the issues, then commit again.

---

## 🚀 Pushing to GitHub

**Just push - tests run automatically:**

```bash
git push
```

**What runs automatically (pre-push hook):**
- ✅ Security scan (Snyk) - **BLOCKS push if high+ vulnerabilities found**
- ✅ Full test suite (`npm run test:all`)
- ✅ Environment check
- ✅ Full linting (frontend + backend)
- ✅ Full test suite (frontend + backend + Python)
- ✅ Build verification
- ✅ Code quality check

**If security scan fails:** The push is **BLOCKED**. Fix vulnerabilities, then push again.
**If tests fail:** The push is blocked. Fix the issues, then push again.

---

## 🛑 Ending Your Work Session

```bash
# Stop everything (one command)
./stop-dev.sh
```

**What this does:**
- Stops all PM2 processes (backend, frontend, automation)
- Stops Docker containers (Kafka, observability stack)
- Frees up all ports

---

## 🔍 When Something Breaks

### Quick Debug Steps:

1. **Check logs:**
   ```bash
   tail -f logs/backend.log
   tail -f logs/automation-worker.log
   ```

2. **Check Grafana** (if observability is running):
   - Open http://localhost:3001 (admin/admin123)
   - Look at Metrics, Logs, Traces

3. **Restart everything:**
   ```bash
   ./stop-dev.sh && ./start-dev.sh
   ```

4. **Check if services are running:**
   ```bash
   docker ps                    # Check Docker containers
   pm2 status                  # Check PM2 processes
   curl http://localhost:3030/health  # Check backend
   ```

---

## 📋 Quick Reference

### Start/Stop
```bash
./start-dev.sh    # Start everything
./stop-dev.sh     # Stop everything
```

### Testing
```bash
npm run lint:test    # Quick check (runs automatically on commit)
npm run test:all     # Full check (runs automatically on push)
npm run logs         # Watch all logs (color-coded)
```

### Git
```bash
git add .
git commit -m "feat(scope): description"
git push
```

### URLs
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3030
- **Grafana:** http://localhost:3001 (admin/admin123)

---

## 🎯 The System You're Following

**This is a fully automated workflow:**

1. **Start** → `./start-dev.sh` (browser opens automatically)
2. **Work** → Make changes, test in browser
3. **Commit** → `git commit -m "feat(scope): what you did"` (validation runs automatically)
4. **Push** → `git push` (tests run automatically)
5. **Stop** → `./stop-dev.sh`

**That's it.** No manual validation, no manual testing, no confusion. Everything is automated.

---

## 💡 Pro Tips

- **Pre-commit hook runs automatically** - no need to manually run `npm run lint:test`
- **Pre-push hook runs automatically** - no need to manually run `npm run test:all`
- **Use `npm run logs`** to watch all logs at once (color-coded, easier to read)
- **Use `./stop-dev.sh && ./start-dev.sh`** to restart cleanly
- **Grafana is your friend** - use it to see what's happening in real-time
- **Browser opens automatically** - no need to manually open http://localhost:3000
- **Code quality metrics update automatically** - Prometheus scrapes every 5 minutes, no manual export needed
- **All observability is automatic** - metrics, logs, and traces flow to Grafana automatically

