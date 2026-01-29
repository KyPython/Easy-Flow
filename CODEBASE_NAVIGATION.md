# EasyFlow Codebase Navigation

Quick guide to navigate the EasyFlow codebase with click-through navigation to all major modules.

## Directory Structure

```
Easy-Flow/
├── rpa-system/
│   ├── backend/              # Express.js API server
│   │   ├── routes/           # API endpoints
│   │   │   ├── [tasks.js](./rpa-system/backend/routes/tasks.js)
│   │   │   ├── [workflowRoutes.js](./rpa-system/backend/routes/workflowRoutes.js)
│   │   │   ├── [aiAgentRoutes.js](./rpa-system/backend/routes/aiAgentRoutes.js)
│   │   │   └── [更多...](./rpa-system/backend/routes/)
│   │   ├── services/         # Business logic
│   │   │   ├── [UniversalLearningService.js](./rpa-system/backend/services/UniversalLearningService.js)
│   │   │   ├── [workflowExecutor.js](./rpa-system/backend/services/workflowExecutor.js)
│   │   │   ├── [aiWorkflowAgent.js](./rpa-system/backend/services/aiWorkflowAgent.js)
│   │   │   └── [更多...](./rpa-system/backend/services/)
│   │   ├── middleware/       # Express middleware
│   │   │   ├── [auth.js](./rpa-system/backend/middleware/auth.js)
│   │   │   ├── [structuredLogging.js](./rpa-system/backend/middleware/structuredLogging.js)
│   │   │   └── [更多...](./rpa-system/backend/middleware/)
│   │   ├── utils/            # Shared utilities
│   │   │   ├── [logger.js](./rpa-system/backend/utils/logger.js)
│   │   │   ├── [supabaseClient.js](./rpa-system/backend/utils/supabaseClient.js)
│   │   │   └── [更多...](./rpa-system/backend/utils/)
│   │   ├── [app.js](./rpa-system/backend/app.js)          # Main application entry
│   │   └── [server.js](./rpa-system/backend/server.js)   # Server startup
│   │
│   └── rpa-dashboard/        # React frontend
│       └── src/
│           ├── pages/            # Page components
│           │   ├── [DashboardPage.jsx](./rpa-system/rpa-dashboard/src/pages/DashboardPage.jsx)
│           │   ├── [WorkflowsPage.jsx](./rpa-system/rpa-dashboard/src/pages/WorkflowsPage.jsx)
│           │   └── [更多...](./rpa-system/rpa-dashboard/src/pages/)
│           ├── components/       # Reusable UI components
│           │   └── [更多...](./rpa-system/rpa-dashboard/src/components/)
│           ├── hooks/            # Custom React hooks
│           │   └── [更多...](./rpa-system/rpa-dashboard/src/hooks/)
│           ├── utils/            # Frontend utilities
│           │   ├── [logger.js](./rpa-system/rpa-dashboard/src/utils/logger.js)
│           │   ├── [auth.js](./rpa-system/rpa-dashboard/src/utils/auth.js)
│           │   ├── [commonEnv.js](./rpa-system/rpa-dashboard/src/utils/commonEnv.js)
│           │   └── [更多...](./rpa-system/rpa-dashboard/src/utils/)
│           ├── contexts/         # React contexts
│           │   └── [更多...](./rpa-system/rpa-dashboard/src/contexts/)
│           ├── [App.jsx](./rpa-system/rpa-dashboard/src/App.jsx)           # React app root
│           └── [App.dashboard.jsx](./rpa-system/rpa-dashboard/src/App.dashboard.jsx)  # Frontend routing
│
├── docs/                     # Documentation
│   ├── [INDEX.md](./docs/INDEX.md)                    # Documentation index
│   ├── [DAILY_DEVELOPER_GUIDE.md](./docs/development/DAILY_DEVELOPER_GUIDE.md)  # Daily workflow
│   ├── architecture/         # Architecture docs
│   ├── development/          # Development guides
│   ├── setup/                # Setup guides
│   └── [更多...](./docs/)
│
├── scripts/                  # CI/CD and utility scripts
│   ├── [validate-all.sh](./scripts/validate-all.sh)           # Run all validations
│   ├── [validate-learning-system.sh](./scripts/validate-learning-system.sh)  # Learning system validation
│   └── [更多...](./scripts/)
│
└── infrastructure/           # Terraform configs
    └── [main.tf](./infrastructure/main.tf)
```

## Key Entry Points

| Area | File | Description |
|------|------|-------------|
| Backend | [`rpa-system/backend/app.js`](./rpa-system/backend/app.js) | Express server setup |
| Backend | [`rpa-system/backend/server.js`](./rpa-system/backend/server.js) | Server startup |
| Frontend | [`rpa-system/rpa-dashboard/src/App.jsx`](./rpa-system/rpa-dashboard/src/App.jsx) | React app root |
| Routes | [`rpa-system/rpa-dashboard/src/App.dashboard.jsx`](./rpa-system/rpa-dashboard/src/App.dashboard.jsx) | Frontend routing |
| Auth | [`rpa-system/rpa-dashboard/src/utils/auth.js`](./rpa-system/rpa-dashboard/src/utils/auth.js) | Authentication |
| Logging | [`rpa-system/rpa-dashboard/src/utils/logger.js`](./rpa-system/rpa-dashboard/src/utils/logger.js) | Frontend logging |
| Logging | [`rpa-system/backend/utils/logger.js`](./rpa-system/backend/utils/logger.js) | Backend logging |

## Finding Code

### By Feature

- **Workflows**: [`backend/routes/workflowRoutes.js`](./rpa-system/backend/routes/workflowRoutes.js), [`frontend/pages/WorkflowsPage.jsx`](./rpa-system/rpa-dashboard/src/pages/WorkflowsPage.jsx)
- **Tasks**: [`backend/routes/tasks.js`](./rpa-system/backend/routes/tasks.js), [`frontend/pages/TasksPage.jsx`](./rpa-system/rpa-dashboard/src/pages/TasksPage.jsx)
- **Analytics**: [`backend/routes/businessMetrics.js`](./rpa-system/backend/routes/businessMetrics.js), [`frontend/pages/DashboardPage.jsx`](./rpa-system/rpa-dashboard/src/pages/DashboardPage.jsx)
- **AI Agent**: [`backend/routes/aiAgentRoutes.js`](./rpa-system/backend/routes/aiAgentRoutes.js), [`backend/services/aiWorkflowAgent.js`](./rpa-system/backend/services/aiWorkflowAgent.js)
- **Auth**: [`backend/middleware/auth.js`](./rpa-system/backend/middleware/auth.js), [`frontend/utils/auth.js`](./rpa-system/rpa-dashboard/src/utils/auth.js)
- **Learning System**: [`backend/services/UniversalLearningService.js`](./rpa-system/backend/services/UniversalLearningService.js)

### By Type

- **API Endpoints**: [`rpa-system/backend/routes/`](./rpa-system/backend/routes/)
- **React Pages**: [`rpa-system/rpa-dashboard/src/pages/`](./rpa-system/rpa-dashboard/src/pages/)
- **UI Components**: [`rpa-system/rpa-dashboard/src/components/`](./rpa-system/rpa-dashboard/src/components/)
- **Hooks**: [`rpa-system/rpa-dashboard/src/hooks/`](./rpa-system/rpa-dashboard/src/hooks/)
- **Backend Services**: [`rpa-system/backend/services/`](./rpa-system/backend/services/)
- **Backend Middleware**: [`rpa-system/backend/middleware/`](./rpa-system/backend/middleware/)
- **Frontend Utilities**: [`rpa-system/rpa-dashboard/src/utils/`](./rpa-system/rpa-dashboard/src/utils/)

### By File Extension

- **JavaScript/JSX**: [`rpa-system/`](./rpa-system/)
- **TypeScript**: [`rpa-system/backend/controllers/`](./rpa-system/backend/controllers/)
- **Python**: [`rpa-system/automation/`](./rpa-system/automation/)
- **Shell Scripts**: [`scripts/`](./scripts/)
- **Terraform**: [`infrastructure/`](./infrastructure/)
- **Markdown Docs**: [`docs/`](./docs/)

## Validation & Testing

- **Run All Validations**: [`scripts/validate-all.sh`](./scripts/validate-all.sh)
- **Learning System Validation**: [`scripts/validate-learning-system.sh`](./scripts/validate-learning-system.sh)
- **Duplicate Code Detection**: [`scripts/validate-duplicate-code.sh`](./scripts/validate-duplicate-code.sh)
- **Test Coverage**: [`scripts/validate-test-coverage.sh`](./scripts/validate-test-coverage.sh)

## Related Docs

- [ROUTE_MAP.md](./ROUTE_MAP.md) - API endpoint reference
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Common commands
- [docs/development/DAILY_DEVELOPER_GUIDE.md](./docs/development/DAILY_DEVELOPER_GUIDE.md) - Daily development workflow
- [docs/INDEX.md](./docs/INDEX.md) - Complete documentation index
