# RPA System - Main Application

**EasyFlow's core automation platform**

## 📁 Structure

- **`backend/`** - Node.js/Express API server
  - Routes, services, middleware, utilities
  - Main entry: `server.js` → `app.js`
  
- **`rpa-dashboard/`** - React frontend dashboard
  - Main entry: `src/App.dashboard.jsx`
  
- **`automation/`** - Python automation service
  - Main entry: `automation-service/production_automation_service.py`
  
- **`monitoring/`** - Observability stack configs
  - Prometheus, Grafana, Loki, Tempo configs

## 🚀 Running

Use root-level scripts:
- `./start-dev.sh` - Start all services
- `./stop-dev.sh` - Stop all services
