# Components Directory

**Purpose:** Contains all reusable UI components. Components are organized by feature/domain.

## Component Organization

### Layout Components
- `Header/` - Main navigation header
- `Navigation/` - Sidebar navigation
- `BreadcrumbNavigation/` - Breadcrumb trail

### Feature Components
- `WorkflowBuilder/` - Workflow creation and management UI
- `TaskForm/` - Task creation form
- `AIWorkflowAgent/` - AI assistant for workflow creation
- `BulkProcessor/` - Bulk invoice processing
- `FileManager/` - File management UI
- `IntegrationsPage/` - Integration management (moved to pages)

### UI Components
- `UI/` - Generic UI components (Button, Input, etc.)
- `Modal/` - Generic modal component
- `StatusBadge/` - Status indicator badges
- `Skeleton/` - Loading skeleton components

### Form Components
- `TaskForm/` - Task creation form
- `ScheduleBuilder/` - Schedule creation UI
- `IntegrationKeyModal/` - API key entry modal

### Display Components
- `Dashboard/` - Dashboard widgets
- `Analytics/` - Analytics charts and graphs
- `MetricCard/` - Metric display cards

## Component Structure

Each component directory typically contains:
```
ComponentName/
+── ComponentName.jsx # Main component
+── ComponentName.module.css # Styles
+── index.js # Export (optional)
```

## Usage Pattern

```jsx
// Import component
import ComponentName from './components/ComponentName/ComponentName';

// Use in page/component
<ComponentName prop1={value1} prop2={value2} />
```

## Theme Integration

All components should:
- Use `useTheme()` hook from `../utils/ThemeContext.jsx`
- Use CSS variables from `../theme.css`
- Support light/dark theme via `data-theme` attribute

## Adding a New Component

1. Create directory: `components/NewComponent/`
2. Create files:
 - `NewComponent.jsx` - Component code
 - `NewComponent.module.css` - Styles
 - `index.js` - Export (optional)
3. Import and use in pages/components
