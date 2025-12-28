# 🚀 Quick Navigation Reference

**Find any code in seconds**

## 🔍 Common Questions

### "Where is the login form?"
→ `rpa-dashboard/src/pages/AuthPage.jsx`

### "Where is the task creation form?"
→ `rpa-dashboard/src/components/TaskForm/TaskForm.jsx`

### "Where is the workflow builder?"
→ `rpa-dashboard/src/components/WorkflowBuilder/WorkflowBuilder.jsx`

### "Where is the API endpoint for creating tasks?"
→ `backend/routes/tasks.js` → `POST /api/tasks`

### "Where is workflow execution logic?"
→ `backend/services/workflowExecutor.js`

### "Where are all routes defined?"
→ Frontend: `rpa-dashboard/src/App.dashboard.jsx` (line 312+)
→ Backend: `backend/app.js` (line 135+)

### "Where does a task get executed?"
→ `automation/automation-service/production_automation_service.py`

## 📍 Route Quick Reference

### Frontend Routes
- `/` → `pages/LandingPage.jsx`
- `/auth` → `pages/AuthPage.jsx`
- `/app` → `pages/DashboardPage.jsx`
- `/app/tasks` → `pages/TasksPage.jsx`
- `/app/history` → `pages/HistoryPage.jsx`
- `/app/workflows` → `components/WorkflowBuilder/WorkflowPage.jsx`

### Backend Routes
- `/api/tasks` → `routes/tasks.js`
- `/api/executions` → `routes/executionRoutes.js`
- `/api/workflows` → `routes/workflowRoutes.js` + `app.js`
- `/api/integrations` → `routes/integrationRoutes.js`

## 🗺️ Full Navigation Guide

See **[CODEBASE_NAVIGATION.md](CODEBASE_NAVIGATION.md)** for complete details.

