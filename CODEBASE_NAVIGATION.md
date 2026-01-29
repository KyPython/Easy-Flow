# EasyFlow Codebase Navigation

Quick guide to navigate the EasyFlow codebase.

## Directory Structure

```
Easy-Flow/
├── rpa-system/
│   ├── backend/          # Express.js API server
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Express middleware
│   │   ├── utils/        # Shared utilities
│   │   └── app.js        # Main application entry
│   │
│   └── rpa-dashboard/    # React frontend
│       └── src/
│           ├── pages/        # Page components
│           ├── components/   # Reusable UI components
│           ├── hooks/        # Custom React hooks
│           ├── utils/        # Frontend utilities
│           └── contexts/     # React contexts
│
├── docs/                 # Documentation
├── scripts/              # CI/CD and utility scripts
└── infrastructure/       # Terraform configs
```

## Key Entry Points

| Area | File | Description |
|------|------|-------------|
| Backend | `rpa-system/backend/app.js` | Express server setup |
| Frontend | `rpa-system/rpa-dashboard/src/App.jsx` | React app root |
| Routes | `rpa-system/rpa-dashboard/src/App.dashboard.jsx` | Frontend routing |
| Auth | `rpa-system/rpa-dashboard/src/utils/AuthContext.js` | Authentication |

## Finding Code

### By Feature
- **Workflows**: `backend/routes/workflowRoutes.js`, `frontend/pages/WorkflowsPage.jsx`
- **Tasks**: `backend/routes/taskRoutes.js`, `frontend/pages/TasksPage.jsx`
- **Analytics**: `backend/routes/businessMetrics.js`, `frontend/pages/DashboardPage.jsx`
- **Auth**: `backend/middleware/auth.js`, `frontend/utils/AuthContext.js`

### By Type
- **API Endpoints**: `rpa-system/backend/routes/`
- **React Pages**: `rpa-system/rpa-dashboard/src/pages/`
- **UI Components**: `rpa-system/rpa-dashboard/src/components/`
- **Hooks**: `rpa-system/rpa-dashboard/src/hooks/`

## Related Docs
- [ROUTE_MAP.md](./ROUTE_MAP.md) - API endpoint reference
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Common commands
