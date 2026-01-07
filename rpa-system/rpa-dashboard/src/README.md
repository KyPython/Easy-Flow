# Frontend Dashboard (`rpa-dashboard`)

**React application for EasyFlow automation platform**

## 📍 Navigation

- **Main Router**: [`App.dashboard.jsx`](./App.dashboard.jsx) - All routes defined here
- **Pages**: [`pages/`](./pages/) - One component per route
- **Components**: [`components/`](./components/) - Reusable UI components
- **Hooks**: [`hooks/`](./hooks/) - React hooks for state management

## 🗺️ Route Structure

All routes are defined in `App.dashboard.jsx`. See [CODEBASE_NAVIGATION.md](../../CODEBASE_NAVIGATION.md) for complete route map.

### Quick Route Reference

- `/` -> `LandingPage.jsx`
- `/auth` -> `AuthPage.jsx`
- `/app` -> `DashboardPage.jsx`
- `/app/tasks` -> `TasksPage.jsx`
- `/app/workflows` -> `WorkflowPage.jsx` (in `components/WorkflowBuilder/`)

## 📁 Directory Structure

```
src/
+── pages/              # Route components (one per URL)
|   +── LandingPage.jsx
|   +── DashboardPage.jsx
|   +── ...
+── components/         # Reusable components
|   +── Header/         # Navigation header
|   +── WorkflowBuilder/ # Workflow UI
|   +── ...
+── hooks/              # React hooks
|   +── useWorkflow.js
|   +── ...
+── utils/              # Utilities
|   +── api.js          # API client
|   +── logger.js       # Logging
|   +── ThemeContext.jsx # Theme provider
+── App.dashboard.jsx   # Main router
```

##  Theming

All components should use `ThemeContext`:

```jsx
import { useTheme } from './utils/ThemeContext';

const MyComponent = () => {
  const { theme } = useTheme();
  return <div data-theme={theme}>...</div>;
};
```

## 📝 Logging

All logs should use the observability logger:

```jsx
import { createLogger } from './utils/logger';

const logger = createLogger('MyComponent');
logger.info('User action', { data });
```

## 🔗 Related Files

- **Backend API**: `../../backend/routes/`
- **Backend Services**: `../../backend/services/`
- **Main Navigation**: [CODEBASE_NAVIGATION.md](../../CODEBASE_NAVIGATION.md)

