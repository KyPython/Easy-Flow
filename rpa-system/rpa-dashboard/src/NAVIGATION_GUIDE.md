# Frontend Navigation Guide

**Quick reference for navigating the frontend codebase**

## 🗺️ Route to Component Map

All routes are defined in `App.dashboard.jsx` starting at line 312.

### Public Routes
- `/` → `LandingPage.jsx`
- `/auth` → `AuthPage.jsx`
- `/auth/reset` → `ResetLanding.jsx`
- `/pricing` → `PricingPage.jsx`
- `/shared/:token` → `SharedFilePage.jsx`

### Protected Routes (`/app/*`)
- `/app` → `DashboardPage.jsx`
- `/app/tasks` → `TasksPage.jsx`
- `/app/history` → `HistoryPage.jsx`
- `/app/files` → `FilesPage.jsx`
- `/app/settings` → `SettingsPage.jsx`
- `/app/teams` → `TeamsPage.jsx`
- `/app/analytics` → `AnalyticsPage.jsx`
- `/app/metrics` → `BusinessMetricsPage.jsx`
- `/app/integrations` → `IntegrationsPage.jsx`
- `/app/unified-dashboard` → `UnifiedDashboardPage.jsx`
- `/app/webhooks` → `WebhooksPage.jsx`
- `/app/rules` → `RulesPage.jsx`

### Workflow Routes
- `/app/workflows` → `components/WorkflowBuilder/WorkflowPage.jsx`
- `/app/workflows/builder` → Same component
- `/app/workflows/builder/:workflowId` → Same component

## 📂 Directory Structure

```
src/
├── pages/              # Route components (one per route)
├── components/         # Reusable UI components
├── hooks/             # React hooks
├── utils/             # Utility functions
│   ├── api.js         # ⭐ ALL API CALLS GO THROUGH HERE
│   └── logger.js      # Logging
├── contexts/          # React contexts
└── App.dashboard.jsx  # ⭐ MAIN ROUTER (all routes defined here)
```

## 🔍 Finding Components

### "Where is the task creation form?"
→ `components/TaskForm/TaskForm.jsx`

### "Where is the workflow builder?"
→ `components/WorkflowBuilder/WorkflowBuilder.jsx`

### "Where is the header navigation?"
→ `components/Header/Header.jsx`

### "Where are API calls made?"
→ `utils/api.js` - All API calls go through this file

## 🖱️ Click Flow Example

**User clicks "Create Task" button:**

1. **UI**: `pages/TasksPage.jsx` renders `TaskForm`
2. **Form**: `components/TaskForm/TaskForm.jsx` handles submit
3. **API**: `utils/api.js` → `POST /api/tasks`
4. **Backend**: `backend/routes/tasks.js` handles request

## 📝 Import Patterns

```javascript
// Pages
import TasksPage from './pages/TasksPage';

// Components
import TaskForm from './components/TaskForm/TaskForm';

// Hooks
import useTasks from './hooks/useTasks';

// Utils
import api from './utils/api';
import { createLogger } from './utils/logger';
import { useTheme } from './utils/ThemeContext';
```

## 🎨 Theme Usage

All components should use theme:
```javascript
import { useTheme } from '../utils/ThemeContext';

function MyComponent() {
  const { theme } = useTheme();
  return <div data-theme={theme}>...</div>;
}
```

## 📚 More Information

- See root `CODEBASE_NAVIGATION.md` for complete navigation guide
- See `pages/README.md` for page documentation
- See `components/README.md` for component documentation

