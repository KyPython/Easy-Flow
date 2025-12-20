# EasyFlow - RPA Automation Platform

**Automated invoice processing and workflow automation**

## 📁 Project Structure

```
Easy-Flow/
├── docs/                    # Documentation (Quick Start, Debugging)
├── scripts/                 # Development & deployment scripts
├── rpa-system/             # Main application
│   ├── backend/            # Node.js/Express API
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   ├── middleware/     # Express middleware
│   │   ├── controllers/    # TypeScript controllers
│   │   ├── public/         # Static files (demo portal, etc.)
│   │   ├── scripts/        # Backend utility scripts
│   │   ├── migrations/     # Database migrations
│   │   └── tests/          # Backend tests
│   ├── rpa-dashboard/      # React frontend
│   ├── automation/          # Python automation service
│   └── monitoring/         # Observability stack configs
├── logs/                    # Application logs
├── data/                    # Data files (feedback, etc.)
├── public/                  # Public static files
└── migrations/              # Root-level migrations
```

## 🚀 Quick Start

See [docs/QUICK_START.md](docs/QUICK_START.md) for daily workflow.

```bash
# Start everything
./start-dev.sh

# Stop everything
./stop-dev.sh
```

## 🔧 Development

- **Backend**: `rpa-system/backend/` (Node.js/Express)
- **Frontend**: `rpa-system/rpa-dashboard/` (React)
- **Automation**: `rpa-system/automation/` (Python/Selenium)

## 📚 Documentation

- [Quick Start](docs/QUICK_START.md) - Daily workflow
- [Debugging](docs/DEBUGGING.md) - Troubleshooting guide

## 🛠️ Scripts

- `./start-dev.sh` - Start all services
- `./stop-dev.sh` - Stop all services
- `npm run lint:test` - Quick validation
- `npm run test:all` - Full test suite

## 🔗 URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001 (admin/admin123)

