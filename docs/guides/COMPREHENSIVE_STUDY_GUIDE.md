# EasyFlow Comprehensive Study Guide

This guide gives a high-level map of the EasyFlow codebase so new contributors can quickly understand where things live and how they fit together.

---

## Frontend Overview (`rpa-system/rpa-dashboard`)

### Pages

#### **Pages**

- `LandingPage.jsx` - Marketing landing page and pricing overview.
- `DashboardPage.jsx` - Main logged-in dashboard shell.
- `HistoryPage.jsx` - Automation history and execution logs.
- `IntegrationsPage.jsx` - Third‑party integrations management.
- `WebhooksPage.jsx` - Webhook configuration and paywall.

These live in:

- `rpa-system/rpa-dashboard/src/pages/`

### Components

#### **Key Components**

- `Header/` - Top navigation and global layout chrome.
- `WorkflowBuilder/` - Visual workflow canvas and builder UI.
- `TaskProgressPanel/` - Real‑time task and run progress UI.
- `Analytics/` - Usage charts and performance dashboards.

Components live under:

- `rpa-system/rpa-dashboard/src/components/`

### Hooks

#### **Hooks**

- `useWorkflow.js` - Core workflow data loading and mutations.
- `useWorkflowTesting.js` - Workflow testing and validation helpers.
- `usePlan.js` - Plan / entitlement awareness in the dashboard.

Hooks live under:

- `rpa-system/rpa-dashboard/src/hooks/`

---

## Backend Overview (`rpa-system/backend`)

### Core Services

#### **Core Services**

- `workflowExecutor.js` - Orchestrates workflow execution.
- `workflowQueue.js` - Queueing and background processing.
- `aiWorkflowAgent.js` - AI‑assisted workflow reasoning and actions.
- `integrationFramework.js` - High‑level integration orchestration layer.

Backend services live under:

- `rpa-system/backend/services/`

### Integration Services

#### **Integration Services**

- `integrations/notionIntegration.js` - Notion API integration.
- `integrations/googleCalendarIntegration.js` - Google Calendar integration.
- `integrations/googleDriveIntegration.js` - Google Drive integration.
- `integrations/gmailIntegration.js` - Gmail integration.

Integration services live under:

- `rpa-system/backend/services/integrations/`

---

## Automation Service (`rpa-system/automation`)

- `automation-service/` - Python automation workers and scraping logic.
- `automation-service/requirements.txt` - Python dependency list for automation.

---

## Tech Stack Snapshot

- **Frontend**: React (dashboard SPA) — see `rpa-system/rpa-dashboard/package.json`.
- **Backend**: Node.js + Express — see `rpa-system/backend/package.json`.
- **Automation**: Python 3.x — see `rpa-system/automation/automation-service/requirements.txt`.

For exact versions, check the respective `package.json` and `requirements.txt` files; the study‑guide validator cross‑checks these against this document.

---

## How to Use This Guide

1. Start with **Pages** to understand top‑level routes.
2. Drill into **Key Components** for the main UI building blocks.
3. Use **Core Services** and **Integration Services** to find the backend entry points.
4. Refer to the automation section when working on Python‑based flows.

This document is intentionally high‑level; detailed architecture lives in `docs/architecture/*.md`.

