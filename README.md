# EasyFlow - RPA Automation Platform

**Automated invoice processing and workflow automation**

## 🚀 Start Here

**For developers working on this project:**

1. **[docs/WORKFLOW.md](docs/WORKFLOW.md)** - Your daily workflow (start here!)

**Everything is automated:**
- ✅ Pre-commit hooks run validation automatically
- ✅ Pre-push hooks run tests automatically
- ✅ Browser opens automatically on start
- ✅ Code quality metrics update automatically (every 5 min)
- ✅ Observability stack runs automatically
- ✅ **Backups are automatic** - Code (GitHub), Database (Supabase), Secrets (Render/GitHub)

## 📁 Project Structure

```
Easy-Flow/
├── docs/                    # Documentation
├── scripts/                 # Development & deployment scripts
├── rpa-system/             # Main application
│   ├── backend/            # Node.js/Express API
│   ├── rpa-dashboard/      # React frontend
│   ├── automation/         # Python automation service
│   └── monitoring/         # Observability stack configs
├── logs/                    # Application logs
└── data/                    # Data files
```

## 🛠️ Quick Commands

```bash
./start-dev.sh      # Start everything (browser opens automatically)
./stop-dev.sh       # Stop everything
npm run logs        # Watch all logs (color-coded)
npm run lint:test   # Quick validation (runs automatically on commit)
npm run test:all    # Full test suite (runs automatically on push)
```

**Note:** Pre-commit and pre-push hooks run automatically - you don't need to manually run validation!

## 🔗 URLs

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3030
- **Grafana:** http://localhost:3001 (admin/admin123)

---

**That's it. Read docs/WORKFLOW.md and start coding.**
