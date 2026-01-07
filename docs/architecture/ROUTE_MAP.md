# EasyFlow Route Map

**Visual guide to all routes and their relationships**

## 🌐 Frontend Routes

```
+─────────────────────────────────────────────────────────────────+
| PUBLIC ROUTES |
+─────────────────────────────────────────────────────────────────+

/ (LandingPage)
 +─-> /auth (AuthPage) ──-> Login/Signup
 +─-> /pricing (PricingPage)
 +─-> /shared/:token (SharedFilePage)

+─────────────────────────────────────────────────────────────────+
| PROTECTED ROUTES (/app/*) |
+─────────────────────────────────────────────────────────────────+

/app (DashboardPage)
 |
 +─-> /app/tasks (TasksPage)
 | +─-> Create automation tasks
 |
 +─-> /app/history (HistoryPage)
 | +─-> View automation history
 |
 +─-> /app/files (FilesPage)
 | +─-> File management
 |
 +─-> /app/workflows (WorkflowPage)
 | +─-> /app/workflows/builder
 | +─-> /app/workflows/builder/:workflowId
 | +─-> /app/workflows/builder/:workflowId/templates
 | +─-> /app/workflows/builder/:workflowId/schedules
 | +─-> /app/workflows/builder/:workflowId/executions
 | +─-> /app/workflows/builder/:workflowId/testing
 |
 +─-> /app/integrations (IntegrationsPage)
 | +─-> Third-party integrations
 |
 +─-> /app/unified-dashboard (UnifiedDashboardPage)
 | +─-> External tools status
 |
 +─-> /app/analytics (AnalyticsPage)
 | +─-> Analytics dashboard
 |
 +─-> /app/metrics (BusinessMetricsPage)
 | +─-> Business metrics
 |
 +─-> /app/webhooks (WebhooksPage)
 | +─-> Webhook management
 |
 +─-> /app/rules (RulesPage)
 | +─-> Business rules
 |
 +─-> /app/teams (TeamsPage)
 | +─-> Team management
 |
 +─-> /app/settings (SettingsPage)
 | +─-> User settings
 |
 +─-> /app/bulk-processor (BulkInvoiceProcessor)
 | +─-> Bulk invoice processing
 |
 +─-> /app/admin/* (Admin Routes)
 +─-> /app/admin/templates (AdminTemplates)
 +─-> /app/admin/analytics (AdminAnalyticsPage)
```

## 🔌 Backend API Routes

```
+─────────────────────────────────────────────────────────────────+
| API ENDPOINTS |
+─────────────────────────────────────────────────────────────────+

/api
 |
 +─-> /api/tasks/* (tasks.js)
 | +─-> POST /api/tasks
 | +─-> GET /api/tasks
 | +─-> GET /api/tasks/:id
 |
 +─-> /api/executions/* (executionRoutes.js)
 | +─-> POST /api/executions
 | +─-> GET /api/executions
 | +─-> GET /api/executions/:id
 |
 +─-> /api/workflows/* (workflowRoutes.js)
 | +─-> POST /api/workflows
 | +─-> GET /api/workflows
 | +─-> GET /api/workflows/:id
 | +─-> PUT /api/workflows/:id
 |
 +─-> /api/integrations/* (integrationRoutes.js)
 | +─-> GET /api/integrations
 | +─-> POST /api/integrations/:name/connect
 | +─-> GET /api/integrations/:name/oauth/start
 |
 +─-> /api/ai-agent/* (aiAgentRoutes.js)
 | +─-> POST /api/ai-agent/chat
 | +─-> POST /api/ai-agent/generate-workflow
 |
 +─-> /api/schedules/* (scheduleRoutes.js)
 | +─-> POST /api/schedules
 | +─-> GET /api/schedules
 |
 +─-> /api/webhooks/* (webhookRoutes.js)
 | +─-> POST /api/webhooks
 | +─-> GET /api/webhooks
 |
 +─-> /api/teams/* (teamRoutes.js)
 | +─-> GET /api/teams
 | +─-> POST /api/teams
 |
 +─-> /api/scraping/* (scrapingRoutes.js)
 | +─-> POST /api/scraping/discover-links
 |
 +─-> /api/admin/* (adminRoutes.js)
 | +─-> /api/admin/templates/* (adminTemplates.js)
 | +─-> /api/admin/analytics/* (adminAnalyticsRoutes.js)
 |
 +─-> /api/internal/* (internalRoutes.js)
 +─-> POST /api/internal/front-logs
```

## 🔄 User Flow

```
1. Landing Page (/)
 |
 +─-> Sign Up -> /auth -> /app (Dashboard)
 |
 +─-> Login -> /auth -> /app (Dashboard)
 |
 +─-> Create Task -> /app/tasks
 | +─-> View History -> /app/history
 |
 +─-> Create Workflow -> /app/workflows/builder
 | +─-> Add Steps
 | +─-> Configure Schedule -> /app/workflows/builder/:id/schedules
 | +─-> Test -> /app/workflows/builder/:id/testing
 |
 +─-> Connect Integration -> /app/integrations
 | +─-> View Status -> /app/unified-dashboard
 |
 +─-> Settings -> /app/settings
```

## 📍 File Locations

### Frontend Pages
- All pages: `rpa-system/rpa-dashboard/src/pages/`
- Router: `rpa-system/rpa-dashboard/src/App.dashboard.jsx`

### Backend Routes
- All routes: `rpa-system/backend/routes/`
- Route registration: `rpa-system/backend/app.js`

## 🔗 Related Documentation

- **[CODEBASE_NAVIGATION.md](CODEBASE_NAVIGATION.md)** - Complete navigation guide
- **[Frontend README](rpa-system/rpa-dashboard/src/README.md)** - Frontend structure
- **[Backend README](rpa-system/backend/README.md)** - Backend structure

