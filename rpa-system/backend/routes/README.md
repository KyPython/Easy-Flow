# Routes Directory

**Purpose:** Contains all API route handlers. Each file handles routes for a specific domain.

## Route Files

| File | Base Route | Purpose | Registered In |
|------|------------|---------|---------------|
| `tasks.js` | `/api/tasks` | Task management | `app.js` line ~135 |
| `executionRoutes.js` | `/api/executions` | Execution management | `app.js` line ~1179 |
| `workflowRoutes.js` | `/api/workflows` | Workflow CRUD | `app.js` line ~1194 |
| `integrationRoutes.js` | `/api/integrations` | Third-party integrations | `app.js` line ~941 |
| `scrapingRoutes.js` | `/api/scraping` | Web scraping | `app.js` line ~135, ~958 |
| `aiAgentRoutes.js` | `/api/ai-agent` | AI workflow agent | `app.js` |
| `scheduleRoutes.js` | `/api/schedules` | Workflow scheduling | `app.js` |
| `webhookRoutes.js` | `/api/webhooks` | Webhook management | `app.js` |
| `teamRoutes.js` | `/api/teams` | Team management | `app.js` |
| `businessMetrics.js` | `/api/business-metrics` | Business metrics | `app.js` line ~941 |
| `businessRulesRoutes.js` | `/api/business-rules` | Business rules | `app.js` line ~945 |
| `fileRoutes.js` | `/api/files` | File management | `app.js` |
| `adminTemplates.js` | `/api/admin/templates` | Admin template management | `app.js` |
| `adminAnalyticsRoutes.js` | `/api/admin/analytics` | Admin analytics | `app.js` |
| `internalRoutes.js` | `/api/internal` | Internal operations | `app.js` line ~986 |

## Route Pattern

Each route file typically:
1. Imports Express router
2. Imports necessary services
3. Imports middleware (auth, rate limiting, etc.)
4. Defines route handlers
5. Exports router

Example:
```javascript
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { someService } = require('../services/someService');

router.get('/endpoint', authMiddleware, async (req, res) => {
  // Handler logic
});

module.exports = router;
```

## Route Registration

All routes are registered in `app.js`:
```javascript
const tasksRoutes = require('./routes/tasks');
app.use('/api/tasks', tasksRoutes);
```

## Finding Routes

1. Check `app.js` for route registration (line 135+)
2. Find route file in this directory
3. Check route handler function in that file

## Adding a New Route

1. Create `newRoutes.js` in this directory
2. Define routes using Express router
3. Register in `app.js`:
   ```javascript
   const newRoutes = require('./routes/newRoutes');
   app.use('/api/new', newRoutes);
   ```
