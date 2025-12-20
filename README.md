# EasyFlow - RPA Automation Platform

**Automated invoice processing and workflow automation**

## 🚀 Start Here

**Read these two files - that's all you need:**

1. **[WORKFLOW.md](WORKFLOW.md)** - Your daily workflow (start here!)
2. **[docs/DEBUGGING.md](docs/DEBUGGING.md)** - When something breaks

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
./start-dev.sh      # Start everything
./stop-dev.sh       # Stop everything
npm run lint:test   # Quick validation (before commit)
npm run test:all    # Full test suite (before push)
```

## 🔗 URLs

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3030
- **Grafana:** http://localhost:3001 (admin/admin123)

---

**That's it. Read WORKFLOW.md and start coding.**
