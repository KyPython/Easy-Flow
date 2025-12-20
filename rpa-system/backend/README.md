# Backend API

**Node.js/Express REST API for EasyFlow**

## 📁 Structure

- **`routes/`** - API route handlers (Express routers)
- **`services/`** - Business logic services
- **`utils/`** - Utility functions (Kafka, Supabase, logging)
- **`middleware/`** - Express middleware (auth, logging, telemetry)
- **`controllers/`** - TypeScript controllers (e.g., TaskController)
- **`public/`** - Static files served by Express (demo portal, etc.)
- **`scripts/`** - Utility scripts (one-off tasks, testing)
- **`migrations/`** - Database migration SQL files
- **`tests/`** - Backend test files

## 🚀 Entry Points

- **`server.js`** - Main server entry (initializes telemetry, starts HTTP server)
- **`app.js`** - Express app configuration (routes, middleware)

## 🔧 Development

```bash
# Start backend only
cd rpa-system/backend
node server.js

# Or use PM2 (via root start-dev.sh)
pm2 start ecosystem.config.js
```

