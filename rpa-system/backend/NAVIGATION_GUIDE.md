# Backend Navigation Guide

**Quick reference for navigating the backend codebase**

## 🗺️ Route to Handler Map

All routes are registered in `app.js` starting at line 135.

### Core Routes
- `/api/tasks` → `routes/tasks.js`
- `/api/executions` → `routes/executionRoutes.js`
- `/api/workflows` → `routes/workflowRoutes.js` + inline handlers in `app.js`
- `/api/integrations` → `routes/integrationRoutes.js`
- `/api/scraping` → `routes/scrapingRoutes.js`

### Feature Routes
- `/api/ai-agent` → `routes/aiAgentRoutes.js`
- `/api/schedules` → `routes/scheduleRoutes.js`
- `/api/webhooks` → `routes/webhookRoutes.js`
- `/api/teams` → `routes/teamRoutes.js`
- `/api/business-metrics` → `routes/businessMetrics.js`
- `/api/business-rules` → `routes/businessRulesRoutes.js`

## 📂 Directory Structure

```
backend/
├── app.js              # ⭐ MAIN APP (all routes registered here)
├── server.js           # Server entry point
├── routes/             # API route handlers
├── services/           # Business logic
├── middleware/         # Express middleware
│   ├── auth.js         # Authentication
│   ├── structuredLogging.js # Logging
│   └── planEnforcement.js # Plan limits
├── utils/             # Utility functions
└── controllers/        # Request controllers
```

## 🔍 Finding Code

### "Where is the task creation endpoint?"
→ `routes/tasks.js` → `POST /api/tasks`

### "Where is workflow execution logic?"
→ `services/workflowExecutor.js`

### "Where is authentication handled?"
→ `middleware/auth.js`

### "Where are routes registered?"
→ `app.js` line 135+

## 🖱️ Request Flow Example

**Frontend calls `POST /api/tasks`:**

1. **Route**: `app.js` → `routes/tasks.js`
2. **Middleware**: `auth.js`, `planEnforcement.js`, etc.
3. **Handler**: Route handler function in `routes/tasks.js`
4. **Service**: Calls `services/workflowExecutor.js` or similar
5. **Response**: Returns JSON to frontend

## 📝 Service Pattern

```javascript
const { createLogger } = require('../middleware/structuredLogging');
const logger = createLogger('serviceName');

async function doSomething(data) {
  logger.info('Doing something', { data });
  // Logic here
  return result;
}

module.exports = { doSomething };
```

## 🔐 Middleware Order

Middleware is applied in this order (in `app.js`):
1. CORS
2. Helmet (security)
3. Rate limiting
4. Body parsing
5. Authentication
6. Route handlers

## 📚 More Information

- See root `CODEBASE_NAVIGATION.md` for complete navigation guide
- See `routes/README.md` for route documentation
- See `services/README.md` for service documentation

