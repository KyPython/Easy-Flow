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

**Wait for:** "✅ All services started" message

**Verify it's working:**
- Open http://localhost:3000 (frontend)
- Open http://localhost:3030/health (backend health check)

---

## 💻 While You Work

1. **Make your changes** in your editor
2. **Test manually** in the browser (http://localhost:3000)
3. **Check logs** if something breaks:
   ```bash
   tail -f logs/backend.log
   tail -f logs/automation-worker.log
   ```

---

## ✅ Before Committing Changes

**Run this before every commit:**

```bash
npm run lint:test
```

**What this checks:**
- Frontend linting
- Backend linting  
- Quick tests

**If it passes:** ✅ You're good to commit

**If it fails:** Fix the issues, then commit

---

## 📝 Committing Your Work

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat(scope): what you did"
# Examples:
#   feat(auth): add login functionality
#   fix(kafka): resolve consumer stuck issue
#   refactor(backend): split app.js into modules
```

---

## 🚀 Before Pushing to GitHub

**Run this before pushing:**

```bash
npm run test:all
```

**What this checks:**
- Environment check
- Full linting (frontend + backend)
- Full test suite (frontend + backend + Python)
- Build verification
- Code quality check

**If it passes:** ✅ Push to GitHub

**If it fails:** Fix issues, then push

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
npm run lint:test    # Quick check (before commit)
npm run test:all     # Full check (before push)
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

**This is a simple, practical workflow:**

1. **Start** → `./start-dev.sh`
2. **Work** → Make changes, test in browser
3. **Validate** → `npm run lint:test` (before commit)
4. **Commit** → `git commit -m "feat(scope): what you did"`
5. **Test** → `npm run test:all` (before push)
6. **Push** → `git push`
7. **Stop** → `./stop-dev.sh`

**That's it.** No complex branching, no manual service management, no confusion.

---

## 💡 Pro Tips

- **Always run `npm run lint:test` before committing** - catches issues early
- **Always run `npm run test:all` before pushing** - ensures everything works
- **Use `./stop-dev.sh && ./start-dev.sh`** to restart cleanly
- **Check logs first** when debugging - most issues show up there
- **Grafana is your friend** - use it to see what's happening in real-time

