# 🗺️ EasyFlow Codebase Navigation Guide

**Complete map of the codebase - know exactly where each click takes you**

> **📘 For daily workflow, see [DAILY_DEVELOPER_GUIDE.md](DAILY_DEVELOPER_GUIDE.md)**  
> **📋 For quick reference, see [QUICK_REFERENCE.md](QUICK_REFERENCE.md)**

## 📍 Quick Navigation

- [Frontend Routes](#frontend-routes) - All user-facing pages and URLs
- [Backend Routes](#backend-routes) - All API endpoints  
- [Click-to-Code Flow](#click-to-code-flow) - Trace any UI click to its code
- [Directory Structure](#directory-structure) - What each folder contains
- [Component Map](#component-map) - Where each UI component lives
- [Service Map](#service-map) - Backend services and their purposes

---

## 🌐 Frontend Routes

### Public Routes (No Authentication Required)

| Route | Component | Purpose | File Location |
|-------|-----------|---------|---------------|
| `/` | `LandingPage` | Marketing landing page | `rpa-dashboard/src/pages/LandingPage.jsx` |
| `/auth` | `AuthPage` | Login/Signup | `rpa-dashboard/src/pages/AuthPage.jsx` |
| `/auth/reset` | `ResetLanding` | Password reset | `rpa-dashboard/src/pages/ResetLanding.jsx` |
| `/pricing` | `PricingPage` | Pricing plans | `rpa-dashboard/src/pages/PricingPage.jsx` |
| `/shared/:token` | `SharedFilePage` | Public file sharing | `rpa-dashboard/src/pages/SharedFilePage.jsx` |

### Protected Routes (Authentication Required)

All protected routes are under `/app/*` and require authentication via `Protected` component.

| Route | Component | Purpose | File Location |
|-------|-----------|---------|---------------|
| `/app` | `DashboardPage` | Main dashboard | `rpa-dashboard/src/pages/DashboardPage.jsx` |
| `/app/tasks` | `TasksPage` | Create automation tasks | `rpa-dashboard/src/pages/TasksPage.jsx` |
| `/app/history` | `HistoryPage` | View automation history | `rpa-dashboard/src/pages/HistoryPage.jsx` |
| `/app/files` | `FilesPage` | File management | `rpa-dashboard/src/pages/FilesPage.jsx` |
| `/app/bulk-processor` | `BulkInvoiceProcessor` | Bulk invoice processing | `rpa-dashboard/src/components/BulkProcessor/BulkInvoiceProcessor.jsx` |
| `/app/settings` | `SettingsPage` | User settings | `rpa-dashboard/src/pages/SettingsPage.jsx` |
| `/app/teams` | `TeamsPage` | Team management | `rpa-dashboard/src/pages/TeamsPage.jsx` |
| `/app/analytics` | `AnalyticsPage` | Analytics dashboard | `rpa-dashboard/src/pages/AnalyticsPage.jsx` |
| `/app/metrics` | `BusinessMetricsPage` | Business metrics | `rpa-dashboard/src/pages/BusinessMetricsPage.jsx` |
| `/app/integrations` | `IntegrationsPage` | Third-party integrations | `rpa-dashboard/src/pages/IntegrationsPage.jsx` |
| `/app/unified-dashboard` | `UnifiedDashboardPage` | External tools status | `rpa-dashboard/src/pages/UnifiedDashboardPage.jsx` |
| `/app/webhooks` | `WebhooksPage` | Webhook management | `rpa-dashboard/src/pages/WebhooksPage.jsx` |
| `/app/rules` | `RulesPage` | Business rules | `rpa-dashboard/src/pages/RulesPage.jsx` |

### Workflow Routes

| Route | Component | Purpose | File Location |
|-------|-----------|---------|---------------|
| `/app/workflows` | `WorkflowPage` | Workflow list | `rpa-dashboard/src/components/WorkflowBuilder/WorkflowPage.jsx` |
| `/app/workflows/builder` | `WorkflowPage` | Create new workflow | Same as above |
| `/app/workflows/builder/:workflowId` | `WorkflowPage` | Edit workflow | Same as above |
| `/app/workflows/builder/:workflowId/templates` | `WorkflowPage` | Workflow templates | Same as above |
| `/app/workflows/builder/:workflowId/schedules` | `WorkflowPage` | Schedule workflow | Same as above |
| `/app/workflows/builder/:workflowId/executions` | `WorkflowPage` | View executions | Same as above |
| `/app/workflows/builder/:workflowId/testing` | `WorkflowPage` | Test workflow | Same as above |

### Admin Routes

| Route | Component | Purpose | File Location |
|-------|-----------|---------|---------------|
| `/app/admin/templates` | `AdminTemplates` | Admin template management | `rpa-dashboard/src/pages/AdminTemplates.jsx` |
| `/app/admin/analytics` | `AdminAnalyticsPage` | Admin analytics | `rpa-dashboard/src/pages/AdminAnalyticsPage.jsx` |

### Debug Routes (Development Only)

| Route | Component | Purpose | File Location |
|-------|-----------|---------|---------------|
| `/app/debug` | `UsageDebugPage` | Usage debugging | `rpa-dashboard/src/pages/debug/UsageDebugPage.jsx` |

**Route Definition:** All routes are defined in `rpa-dashboard/src/App.dashboard.jsx` starting at line 312.

---

## 🔌 Backend Routes

All backend routes are under `/api/*` and defined in `rpa-system/backend/routes/`.

### Core Routes

| Endpoint | Route File | Purpose | Handler Function |
|----------|------------|---------|-----------------|
| `/api/tasks/*` | `routes/tasks.js` | Task management | Various handlers |
| `/api/executions/*` | `routes/executionRoutes.js` | Execution management | Various handlers |
| `/api/workflows/*` | `routes/workflowRoutes.js` | Workflow CRUD | Various handlers |
| `/api/integrations/*` | `routes/integrationRoutes.js` | Third-party integrations | Various handlers |
| `/api/auth/*` | `routes/authRoutes.js` | Authentication | Various handlers |

### Feature Routes

| Endpoint | Route File | Purpose |
|----------|------------|---------|
| `/api/scraping/*` | `routes/scrapingRoutes.js` | Web scraping |
| `/api/ai-agent/*` | `routes/aiAgentRoutes.js` | AI workflow agent |
| `/api/schedules/*` | `routes/scheduleRoutes.js` | Workflow scheduling |
| `/api/webhooks/*` | `routes/webhookRoutes.js` | Webhook management |
| `/api/teams/*` | `routes/teamRoutes.js` | Team management |
| `/api/analytics/*` | `routes/analyticsRoutes.js` | Analytics |
| `/api/business-metrics/*` | `routes/businessMetrics.js` | Business metrics |
| `/api/rules/*` | `routes/businessRulesRoutes.js` | Business rules |
| `/api/files/*` | `routes/fileRoutes.js` | File management |

### Admin Routes

| Endpoint | Route File | Purpose |
|----------|------------|---------|
| `/api/admin/*` | `routes/adminRoutes.js` | Admin operations |
| `/api/admin/templates/*` | `routes/adminTemplates.js` | Template management |
| `/api/admin/analytics/*` | `routes/adminAnalyticsRoutes.js` | Admin analytics |

### Internal Routes

| Endpoint | Route File | Purpose |
|----------|------------|---------|
| `/api/internal/*` | `routes/internalRoutes.js` | Internal operations |
| `/api/internal/front-logs` | `routes/internalRoutes.js` | Frontend log collection |

**Route Registration:** All routes are registered in `rpa-system/backend/app.js` starting around line 135.

---

## 🖱️ Click-to-Code Flow

### Example: User Clicks "Create Task" Button

```
1. UI Click
   ↓
   Location: rpa-dashboard/src/pages/TasksPage.jsx
   Component: TasksPage renders TaskForm
   ↓
2. Form Submission
   ↓
   Location: rpa-dashboard/src/components/TaskForm/TaskForm.jsx
   Handler: handleSubmit() function
   ↓
3. API Call
   ↓
   Location: rpa-dashboard/src/utils/api.js
   Function: api.post('/api/tasks', taskData)
   ↓
4. Backend Route
   ↓
   Location: rpa-system/backend/routes/tasks.js
   Route: POST /api/tasks
   Handler: createTask() function
   ↓
5. Service Layer
   ↓
   Location: rpa-system/backend/services/workflowExecutor.js
   Function: executeTask() or similar
   ↓
6. Automation Worker
   ↓
   Location: rpa-system/automation/automation-service/production_automation_service.py
   Function: process_task() function
```

### Example: User Clicks "Run Workflow" Button

```
1. UI Click
   ↓
   Location: rpa-dashboard/src/components/WorkflowBuilder/WorkflowBuilder.jsx
   Component: WorkflowBuilder
   Handler: handleExecute() function
   ↓
2. API Call
   ↓
   Location: rpa-dashboard/src/utils/api.js
   Function: api.post('/api/workflows/execute', workflowData)
   ↓
3. Backend Route
   ↓
   Location: rpa-system/backend/app.js (line 1194)
   Route: POST /api/workflows/execute
   Handler: Inline async function
   ↓
4. Service Layer
   ↓
   Location: rpa-system/backend/services/workflowExecutor.js
   Function: executeWorkflow() function
   ↓
5. Integration Execution
   ↓
   Location: rpa-system/backend/services/workflowExecutorIntegrations.js
   Function: executeIntegrationStep() function
```

### Example: User Clicks "Connect Integration" Button

```
1. UI Click
   ↓
   Location: rpa-dashboard/src/pages/IntegrationsPage.jsx
   Component: IntegrationsPage
   Handler: handleConnect() function
   ↓
2. OAuth Flow or API Key Modal
   ↓
   Location: rpa-dashboard/src/pages/IntegrationsPage.jsx
   Component: IntegrationKeyModal (for non-OAuth)
   OR
   Location: rpa-dashboard/src/pages/IntegrationsPage.jsx
   Function: Opens OAuth popup
   ↓
3. Backend Route
   ↓
   Location: rpa-system/backend/routes/integrationRoutes.js
   Route: GET /api/integrations/:name/oauth/start
   Handler: getOAuthUrl() function
   ↓
4. Service Layer
   ↓
   Location: rpa-system/backend/services/integrationFramework.js
   Function: getIntegrationConfig() function
```

---

## 📁 Directory Structure

### Root Level

```
Easy-Flow/
├── rpa-system/          # Main application code
│   ├── backend/         # Node.js/Express backend
│   ├── rpa-dashboard/   # React frontend
│   └── automation/      # Python automation workers
├── scripts/             # Development and deployment scripts
├── docs/                # Documentation
├── infrastructure/      # Terraform IaC
├── migrations/         # Database migrations
└── public/             # Public assets
```

### Frontend (`rpa-system/rpa-dashboard/src/`)

```
src/
├── pages/               # Route components (one per route)
│   ├── LandingPage.jsx
│   ├── AuthPage.jsx
│   ├── DashboardPage.jsx
│   ├── TasksPage.jsx
│   └── ...
├── components/          # Reusable UI components
│   ├── Header/         # Navigation header
│   │   ├── Header.jsx
│   │   └── Header.module.css
│   ├── WorkflowBuilder/ # Workflow creation UI
│   │   ├── WorkflowBuilder.jsx
│   │   ├── WorkflowPage.jsx
│   │   └── ...
│   ├── TaskForm/       # Task creation form
│   │   ├── TaskForm.jsx
│   │   └── TaskForm.module.css
│   └── ...
├── hooks/              # React hooks
│   ├── useWorkflow.js
│   ├── useTasks.ts
│   ├── useNotifications.js
│   └── ...
├── utils/              # Utility functions
│   ├── api.js          # API client (all API calls go through here)
│   ├── logger.js       # Logging
│   ├── ThemeContext.jsx # Theme provider
│   └── ...
├── contexts/           # React contexts
│   ├── SessionContext.jsx
│   └── AccessibilityContext.tsx
└── App.dashboard.jsx  # Main app router (ALL ROUTES DEFINED HERE)
```

### Backend (`rpa-system/backend/`)

```
backend/
├── app.js              # Express app setup (ALL ROUTES REGISTERED HERE)
├── server.js           # Server entry point
├── routes/             # API route handlers
│   ├── tasks.js        # Task routes
│   ├── executionRoutes.js
│   ├── workflowRoutes.js
│   └── ...
├── services/           # Business logic
│   ├── workflowExecutor.js
│   ├── aiWorkflowAgent.js
│   ├── executionModeService.js
│   └── ...
├── middleware/         # Express middleware
│   ├── auth.js         # Authentication
│   ├── structuredLogging.js
│   ├── planEnforcement.js
│   └── ...
├── utils/              # Utility functions
│   ├── logger.js
│   ├── firebaseAdmin.js
│   └── ...
└── controllers/        # Request controllers
    └── TaskController.ts
```

### Automation (`rpa-system/automation/`)

```
automation/
└── automation-service/
    ├── production_automation_service.py  # Main worker (processes all tasks)
    ├── generic_scraper.py             # Web scraping logic
    └── web_automation.py              # Selenium automation
```

---

## 🧩 Component Map

### Layout Components

| Component | Location | Purpose | Used By |
|-----------|----------|---------|---------|
| `Header` | `components/Header/Header.jsx` | Main navigation | All pages (via App.dashboard.jsx) |
| `BreadcrumbNavigation` | `components/BreadcrumbNavigation/` | Breadcrumb trail | Pages with deep navigation |
| `Navigation` | `components/Navigation/Sidebar.tsx` | Sidebar navigation | Dashboard pages |

### Feature Components

| Component | Location | Purpose | Used By |
|-----------|----------|---------|---------|
| `WorkflowBuilder` | `components/WorkflowBuilder/` | Workflow creation UI | WorkflowPage |
| `TaskForm` | `components/TaskForm/` | Task creation form | TasksPage |
| `AIWorkflowAgent` | `components/AIWorkflowAgent/` | AI assistant | All pages (floating) |
| `BulkInvoiceProcessor` | `components/BulkProcessor/` | Bulk processing | BulkProcessorPage |
| `FileManager` | `components/FileManager/` | File management | FilesPage |

### UI Components

| Component | Location | Purpose | Used By |
|-----------|----------|---------|---------|
| `Modal` | `components/WorkflowBuilder/Modal.jsx` | Generic modal | Various |
| `Button` | `components/UI/Button.tsx` | Styled button | Various |
| `StatusBadge` | `components/StatusBadge/` | Status indicator | HistoryPage, TasksPage |
| `Skeleton` | `components/Skeleton/` | Loading skeleton | Various |

---

## 🔧 Service Map

### Backend Services

| Service | Location | Purpose | Used By |
|---------|----------|---------|---------|
| `workflowExecutor` | `services/workflowExecutor.js` | Execute workflows | executionRoutes.js |
| `aiWorkflowAgent` | `services/aiWorkflowAgent.js` | AI workflow generation | aiAgentRoutes.js |
| `executionModeService` | `services/executionModeService.js` | Execution mode logic | workflowExecutor.js |
| `smartScheduler` | `services/smartScheduler.js` | Workflow scheduling | scheduleRoutes.js |
| `integrationFramework` | `services/integrationFramework.js` | Integration management | integrationRoutes.js |

### Frontend Hooks

| Hook | Location | Purpose | Used By |
|------|----------|---------|---------|
| `useWorkflow` | `hooks/useWorkflow.js` | Workflow state management | WorkflowBuilder |
| `useTasks` | `hooks/useTasks.ts` | Task state management | TasksPage |
| `useNotifications` | `hooks/useNotifications.js` | Notification handling | All pages |
| `useRealtimeSync` | `hooks/useRealtimeSync.js` | Real-time data sync | HistoryPage, DashboardPage |

---

## 🗺️ Navigation Flow

### User Journey Map

```
1. Landing Page (/)
   ↓ Click "Sign Up"
2. Sign Up/Login (/auth)
   ↓ Login Success
3. Dashboard (/app)
   ├─→ Click "Tasks" → /app/tasks
   ├─→ Click "History" → /app/history
   ├─→ Click "Files" → /app/files
   ├─→ Click "Workflows" → /app/workflows
   ├─→ Click "Integrations" → /app/integrations
   └─→ Click "Settings" → /app/settings
```

### Workflow Creation Flow

```
/app/workflows
   ↓ Click "Create Workflow"
/app/workflows/builder
   ↓ Workflow Created
/app/workflows/builder/:workflowId
   ├─→ Templates tab → /app/workflows/builder/:workflowId/templates
   ├─→ Schedules tab → /app/workflows/builder/:workflowId/schedules
   ├─→ Executions tab → /app/workflows/builder/:workflowId/executions
   └─→ Testing tab → /app/workflows/builder/:workflowId/testing
```

---

## 🔍 Finding Things

### "Where is the login form?"
→ `rpa-dashboard/src/pages/AuthPage.jsx`

### "Where is the task creation form?"
→ `rpa-dashboard/src/components/TaskForm/TaskForm.jsx`

### "Where is the workflow execution logic?"
→ `rpa-system/backend/services/workflowExecutor.js`

### "Where is the API endpoint for creating tasks?"
→ `rpa-system/backend/routes/tasks.js` → `POST /api/tasks`

### "Where is the header navigation?"
→ `rpa-dashboard/src/components/Header/Header.jsx`

### "Where are the routes defined?"
→ `rpa-dashboard/src/App.dashboard.jsx` (frontend routes, line 312+)
→ `rpa-system/backend/app.js` (backend routes, line 135+)

### "Where does a task get executed?"
→ `rpa-system/automation/automation-service/production_automation_service.py`

### "Where is the theme defined?"
→ `rpa-dashboard/src/theme.css` (CSS variables)
→ `rpa-dashboard/src/utils/ThemeContext.jsx` (React context)

---

## 📝 Quick Reference

### File Naming Conventions

- **Pages**: `*Page.jsx` (e.g., `DashboardPage.jsx`)
- **Components**: `ComponentName/ComponentName.jsx`
- **Routes**: `*Routes.js` (e.g., `executionRoutes.js`)
- **Services**: `*Service.js` (e.g., `executionModeService.js`)
- **Hooks**: `use*.js` (e.g., `useWorkflow.js`)

### Import Patterns

```javascript
// Pages
import DashboardPage from './pages/DashboardPage';

// Components
import Header from './components/Header/Header';

// Hooks
import useWorkflow from './hooks/useWorkflow';

// Utils
import { createLogger } from './utils/logger';
```

### API Call Pattern

```javascript
// All API calls go through utils/api.js
import api from './utils/api';

// Example: Create task
const response = await api.post('/api/tasks', taskData);
```

---

## 🚀 Getting Started

1. **Start the app**: `./start-dev.sh`
2. **Open browser**: http://localhost:3000
3. **Check routes**: See [Frontend Routes](#frontend-routes) above
4. **Find components**: See [Component Map](#component-map) above
5. **Trace a click**: See [Click-to-Code Flow](#click-to-code-flow) above

---

**Last Updated**: See git history for latest changes  
**Main Router**: `rpa-dashboard/src/App.dashboard.jsx` (line 312+)  
**Backend Entry**: `rpa-system/backend/app.js` (line 135+)
