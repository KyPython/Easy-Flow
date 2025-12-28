# Backend API (`backend`)

**Express.js API server for EasyFlow**

## 📍 Navigation

- **Entry Point**: [`app.js`](./app.js) - Express app setup and route registration
- **Server**: [`server.js`](./server.js) - HTTP server startup
- **Routes**: [`routes/`](./routes/) - API endpoint handlers
- **Services**: [`services/`](./services/) - Business logic
- **Middleware**: [`middleware/`](./middleware/) - Express middleware

## 🗺️ API Routes

All routes are registered in `app.js`. See [CODEBASE_NAVIGATION.md](../../CODEBASE_NAVIGATION.md) for complete API map.

### Quick Route Reference

- `POST /api/tasks` → `routes/tasks.js`
- `GET /api/executions` → `routes/executionRoutes.js`
- `POST /api/workflows` → `routes/workflowRoutes.js`
- `GET /api/integrations` → `routes/integrationRoutes.js`

## 📁 Directory Structure

```
backend/
├── app.js              # Express app (route registration)
├── server.js           # HTTP server
├── routes/             # API endpoints
│   ├── tasks.js
│   ├── executionRoutes.js
│   └── ...
├── services/           # Business logic
│   ├── workflowExecutor.js
│   ├── aiWorkflowAgent.js
│   └── ...
├── middleware/         # Express middleware
│   ├── auth.js
│   ├── structuredLogging.js
│   └── ...
├── utils/              # Utilities
│   ├── logger.js
│   └── ...
└── controllers/        # Request controllers
    └── TaskController.ts
```

## 🔧 Key Services

| Service | Purpose |
|---------|---------|
| `workflowExecutor.js` | Execute workflows |
| `aiWorkflowAgent.js` | AI workflow generation |
| `executionModeService.js` | Execution mode logic |
| `smartScheduler.js` | Workflow scheduling |
| `integrationFramework.js` | Integration management |

## 📝 Logging

All logs use structured logging:

```javascript
const { createLogger } = require('./middleware/structuredLogging');
const logger = createLogger('MyService');
logger.info('Operation', { data });
```

## 🔗 Related Files

- **Frontend**: `../rpa-dashboard/src/`
- **Automation**: `../automation/automation-service/`
- **Main Navigation**: [CODEBASE_NAVIGATION.md](../../CODEBASE_NAVIGATION.md)

