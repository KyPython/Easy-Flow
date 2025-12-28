# EasyFlow

**RPA Automation Platform - Stop Doing Boring Work & Save on Costs**

---

## 🚀 Quick Start

### First Time Setup
```bash
# 1. Start development environment (auto-installs dependencies)
./start-dev.sh

# 2. Access the app
# Frontend: http://localhost:3000
# Backend: http://localhost:3030
```

### Required Setup
1. **Backend Environment**: `rpa-system/backend/.env` (Firebase, Supabase, etc.)
2. **Frontend Environment**: `rpa-system/rpa-dashboard/.env.local` (Firebase, Supabase)
3. **Service Worker Config**: `rpa-system/rpa-dashboard/public/firebase-config.js`

**See**: [DAILY_DEVELOPER_GUIDE.md](DAILY_DEVELOPER_GUIDE.md) for complete setup

---

## 📘 Daily Developer Guide

**👉 [DAILY_DEVELOPER_GUIDE.md](DAILY_DEVELOPER_GUIDE.md)** - **START HERE** - Everything you need for daily work:
- Quick start and setup
- Daily workflow (start, develop, ship)
- Common tasks and commands
- Troubleshooting
- Branch strategy (dev vs main)

---

## 🗺️ Codebase Navigation

**👉 [CODEBASE_NAVIGATION.md](CODEBASE_NAVIGATION.md)** - Complete codebase map:
- Every route → component/handler mapped
- Click-to-code flow examples
- Component and service maps
- Directory structure

---

## 📚 Essential Documentation

### Daily Use
- **[DAILY_DEVELOPER_GUIDE.md](DAILY_DEVELOPER_GUIDE.md)** - **START HERE** - Complete daily workflow guide
- **[CODEBASE_NAVIGATION.md](CODEBASE_NAVIGATION.md)** - Find any code by UI click
- **[BRANCH_AWARE_CI_CD.md](docs/BRANCH_AWARE_CI_CD.md)** - How dev/main branches work

### Client Automation (Revenue)
- **[CLIENT_AUTOMATION_QUICK_START.md](docs/CLIENT_AUTOMATION_QUICK_START.md)** - **START HERE** - 15-minute action plan
- **[CLIENT_AUTOMATION_GUIDE.md](docs/CLIENT_AUTOMATION_GUIDE.md)** - Complete client automation process
- **[OUTREACH_TEMPLATES.md](docs/OUTREACH_TEMPLATES.md)** - Copy-paste outreach scripts

### Reference (When Needed)
- **[RAG_INTEGRATION.md](docs/RAG_INTEGRATION.md)** - RAG service setup
- **[CODE_VALIDATION_SYSTEM.md](docs/CODE_VALIDATION_SYSTEM.md)** - Validation rules
- **[RAG_KNOWLEDGE_VALIDATION.md](docs/RAG_KNOWLEDGE_VALIDATION.md)** - RAG validation guide

## 🔑 Key Commands

### Daily Development
```bash
./start-dev.sh          # Start all services
./stop-dev.sh           # Stop all services
npm run logs            # Watch logs
npm run check-env       # Check environment
```

### Validation & Quality
```bash
npm run validate:all    # All validations (SRP, Dynamic, Theme, Logging, RAG)
npm run validate:rag    # RAG knowledge validation
npm run test:all        # Run all tests
npm run quality:check   # Code quality scan
```

### Git & Deployment
```bash
npm run ship            # Ship to production (dev → main, fully automated)
npm run git:status      # Git workflow status
```

### Code Generation
```bash
npm run gen:route       # Generate route boilerplate
npm run gen:service     # Generate service boilerplate
npm run gen:component   # Generate component boilerplate
```

### Client Automation
```bash
npm run client:template # Create client workflow template
```

**See**: [DAILY_DEVELOPER_GUIDE.md](DAILY_DEVELOPER_GUIDE.md) for complete command reference

---

## 🌐 Local URLs

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3030
- **Grafana**: http://localhost:3001 (admin/admin123)
- **RAG Service**: http://localhost:3001 (if running)

---

## 🎯 Branch Strategy

- **Dev Branch** (`dev`): Permissive validation, allows work-in-progress code
- **Main Branch** (`main`): Strict validation, production-ready code only

**See**: [BRANCH_AWARE_CI_CD.md](docs/BRANCH_AWARE_CI_CD.md) for details
