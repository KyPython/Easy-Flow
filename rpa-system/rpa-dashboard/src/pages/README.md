# Pages Directory

**Purpose:** Contains all route-level page components. Each file corresponds to a route in `App.dashboard.jsx`.

## Route Mapping

| File | Route | Purpose |
|------|-------|---------|
| `LandingPage.jsx` | `/` | Marketing landing page |
| `AuthPage.jsx` | `/auth` | Login/Signup |
| `ResetLanding.jsx` | `/auth/reset` | Password reset |
| `PricingPage.jsx` | `/pricing` | Pricing plans |
| `SharedFilePage.jsx` | `/shared/:token` | Public file sharing |
| `DashboardPage.jsx` | `/app` | Main dashboard |
| `TasksPage.jsx` | `/app/tasks` | Create automation tasks |
| `HistoryPage.jsx` | `/app/history` | View automation history |
| `FilesPage.jsx` | `/app/files` | File management |
| `SettingsPage.jsx` | `/app/settings` | User settings |
| `TeamsPage.jsx` | `/app/teams` | Team management |
| `AnalyticsPage.jsx` | `/app/analytics` | Analytics dashboard |
| `BusinessMetricsPage.jsx` | `/app/metrics` | Business metrics |
| `IntegrationsPage.jsx` | `/app/integrations` | Third-party integrations |
| `UnifiedDashboardPage.jsx` | `/app/unified-dashboard` | External tools status |
| `WebhooksPage.jsx` | `/app/webhooks` | Webhook management |
| `RulesPage.jsx` | `/app/rules` | Business rules |
| `AdminTemplates.jsx` | `/app/admin/templates` | Admin template management |
| `AdminAnalyticsPage.jsx` | `/app/admin/analytics` | Admin analytics |

## Workflow Pages

Workflow pages are in `components/WorkflowBuilder/WorkflowPage.jsx` (not in this directory).

## Adding a New Page

1. Create `NewPage.jsx` in this directory
2. Add route to `App.dashboard.jsx`:
   ```jsx
   const NewPage = lazy(() => import('./pages/NewPage'));
   // ...
   <Route path="/app/new-page" element={<Protected><NewPage /></Protected>} />
   ```
3. Add navigation link to `components/Header/Header.jsx` if needed

## File Structure

Each page typically:
- Imports necessary components from `../components/`
- Uses hooks from `../hooks/`
- Makes API calls via `../utils/api.js`
- Uses theme via `useTheme()` from `../utils/ThemeContext.jsx`
