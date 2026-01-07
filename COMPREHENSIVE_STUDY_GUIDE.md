# EasyFlow Comprehensive Study Guide
## Master the Architecture & System

> **Goal**: Understand the entire EasyFlow system architecture, data flows, and how all components work together.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Layers](#2-architecture-layers)
3. [Technology Stack](#3-technology-stack)
4. [Core Components](#4-core-components)
5. [Data Flow & Execution Paths](#5-data-flow--execution-paths)
6. [Database Schema](#6-database-schema)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Backend Services](#8-backend-services)
9. [Integration Patterns](#9-integration-patterns)
10. [Observability System](#10-observability-system)
11. [Execution Modes & Cost Optimization](#11-execution-modes--cost-optimization)
12. [Development Patterns](#12-development-patterns)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & Infrastructure](#14-deployment--infrastructure)
15. [Key Concepts Deep Dive](#15-key-concepts-deep-dive)
16. [Learning Path](#16-learning-path)

---

## 1. System Overview

### What is EasyFlow?

EasyFlow is an **RPA (Robotic Process Automation) platform** that allows users to:
- Automate repetitive tasks (web scraping, form submission, invoice downloads)
- Create multi-step workflows (visual workflow builder)
- Integrate with external services (Slack, Gmail, Google Sheets, etc.)
- Schedule automated tasks (recurring executions)
- Monitor usage and costs (execution modes, subscription monitoring)

### Core Value Propositions

1. **Browser Automation**: Automate web tasks without APIs (using Puppeteer/Python)
2. **Visual Workflow Builder**: Drag-and-drop automation creation
3. **Cost Optimization**: Execution modes (real-time, balanced, eco) to control costs
4. **Multi-Service Integration**: Connect to 500+ apps via Composio
5. **AI-Powered**: AI workflow generation, data extraction, and insights

---

## 2. Architecture Layers

```
+-------------------------------------------------------------+
|                    FRONTEND LAYER                           |
|  React (rpa-dashboard/)                                     |
|  - Pages: Dashboard, Workflows, Tasks, History, etc.       |
|  - Components: WorkflowBuilder, TaskForm, etc.               |
|  - State: AuthContext, ThemeContext, SessionContext        |
|  - Observability: Frontend logs -> Backend -> Loki          |
+-------------------------------------------------------------+
                            |
                            | HTTP/REST API
                            | (W3C Trace Context)
                            v
+-------------------------------------------------------------+
|                    BACKEND LAYER                            |
|  Node.js/Express (backend/)                                 |
|  - API Routes: /api/tasks, /api/workflows, etc.            |
|  - Services: workflowExecutor, aiWorkflowAgent, etc.        |
|  - Middleware: auth, rateLimit, structuredLogging          |
|  - Observability: Structured logs -> Loki, Traces -> Tempo  |
+-------------------------------------------------------------+
                            |
                    +-------+-------+
                    |               |
                    v               v
        +------------------+  +------------------+
        |   DATABASE       |  |   KAFKA QUEUE    |
        |   (Supabase)     |  |   (Task Queue)   |
        |                  |  |                  |
        |  - PostgreSQL    |  |  - Task messages |
        |  - RLS Policies |  |  - Trace context |
        |  - Realtime     |  +------------------+
        +------------------+           |
                                       |
                                       v
                        +--------------------------+
                        |   WORKER LAYER           |
                        |   Python (automation/)  |
                        |                          |
                        |  - Puppeteer automation  |
                        |  - Web scraping          |
                        |  - Form submission       |
                        |  - File downloads        |
                        |  - Observability: Logs   |
                        +--------------------------+
```

### Key Architectural Principles

1. **Separation of Concerns**: Frontend (UI) ↔ Backend (API) ↔ Workers (Automation)
2. **Event-Driven**: Kafka queues tasks to workers
3. **Observability First**: Every request has trace context, all logs are structured
4. **Stateless Backend**: Horizontal scaling ready
5. **Database-First**: Supabase as source of truth

---

## 3. Technology Stack

### Frontend (`rpa-dashboard/`)
- **Framework**: React 19.1.1
- **Routing**: React Router DOM 7.8.2
- **State**: Context API (AuthContext, ThemeContext, SessionContext)
- **UI**: Custom components with CSS variables for theming
- **Workflow Builder**: ReactFlow 11.11.4
- **Observability**: OpenTelemetry web instrumentation
- **Build**: react-scripts 5.0.1 (via react-app-rewired)

### Backend (`backend/`)
- **Runtime**: Node.js ≥20.0.0
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL with RLS)
- **Message Queue**: Kafka (for task distribution)
- **Authentication**: Firebase Auth + Supabase Auth
- **Observability**: 
  - OpenTelemetry (traces)
  - Pino (structured logging)
  - Prometheus (metrics)
- **HTTP Client**: Axios (instrumented with trace propagation)

### Workers (`automation/automation-service/`)
- **Language**: Python 3.12+
- **Automation**: Puppeteer (via Pyppeteer) for browser automation
- **Message Queue**: Kafka consumer
- **Testing**: Pytest

### Infrastructure
- **Hosting**: Vercel (Frontend), Render/Backend (Backend), Docker (Workers)
- **Monitoring**: Grafana + Loki + Tempo + Prometheus
- **Database**: Supabase (PostgreSQL)
- **CDN**: Vercel Edge Network

---

## 4. Core Components

### 4.1 Frontend Components

#### **Pages** (`rpa-dashboard/src/pages/`)
- `DashboardPage.jsx` - Main dashboard (metrics, quick actions)
- `WorkflowBuilder.jsx` - Visual workflow builder (ReactFlow)
- `TasksPage.jsx` - Task management (one-time automations)
- `HistoryPage.jsx` - Automation execution history
- `IntegrationsPage.jsx` - OAuth integrations setup
- `SettingsPage.jsx` - User settings
- `AuthPage.jsx` - Authentication (signup/login)

#### **Key Components** (`rpa-dashboard/src/components/`)
- `WorkflowBuilder/` - Workflow canvas, node configuration, toolbar
- `AIWorkflowAgent/` - AI assistant for workflow generation
- `TaskForm/` - Task creation form (invoice download, scraping, form submission)
- `Header/` - Navigation and user menu
- `ThemeContext/` - Dark/light theme management

#### **Hooks** (`rpa-dashboard/src/hooks/`)
- `useWorkflow.js` - Workflow CRUD operations
- `useWorkflowExecutions.js` - Execution tracking
- `usePlan.js` - User plan/limits management
- `useAnalytics.js` - Event tracking
- `useAuth.js` - Authentication state

### 4.2 Backend Services

#### **Core Services** (`backend/services/`)
1. **`workflowExecutor.js`** (4085 lines) - THE HEART
   - Executes workflows step-by-step
   - Handles: web_scrape, api_call, data_transform, condition, email, delay
   - Manages execution state, retries, timeouts
   - Integrates with integration services

2. **`aiWorkflowAgent.js`** - AI Assistant
   - Generates workflows from natural language
   - Handles user conversations
   - Creates automated workflows (generate + schedule)

3. **`executionModeService.js`** - Cost Optimization
   - Determines execution mode (real-time, balanced, eco)
   - Auto-detects from context (user-triggered -> real-time, scheduled -> eco)
   - Manages cost/performance trade-offs

4. **`smartScheduler.js`** - Workflow Scheduling
   - Cron-based scheduling
   - Handles recurring executions
   - Timezone-aware

5. **`integrationFramework.js`** - Integration Management
   - OAuth flow management
   - Credential storage (encrypted)
   - Service-specific integrations

#### **Integration Services** (`backend/services/integrations/`)
- `slackIntegration.js` - Slack API wrapper
- `gmailIntegration.js` - Gmail API wrapper
- `redditIntegration.js` - Reddit monitoring & analysis
- `notionIntegration.js` - Notion API wrapper

#### **Feature Services**
- `linkDiscoveryService.js` - Discover clickable links on pages
- `aiDataExtractor.js` - AI-powered data extraction from PDFs/HTML
- `jobParserService.js` - Parse job listings
- `leadScoringService.js` - Score leads
- `subscriptionMonitoringService.js` - Monitor subscription usage

### 4.3 Middleware (`backend/middleware/`)

1. **`auth.js`** - Authentication
   - Verifies Firebase tokens
   - Extracts user ID
   - Requires auth for protected routes

2. **`structuredLogging.js`** - Logging
   - Pino JSON logger
   - Auto-injects trace context
   - Request/response logging

3. **`telemetryInit.js`** - OpenTelemetry
   - Initializes tracing
   - Configures exporters (Tempo, Grafana Cloud)
   - Sets sampling rates

4. **`planEnforcement.js`** - Plan Limits
   - Checks user plan limits
   - Enforces workflow/task/storage limits
   - Returns appropriate errors

5. **`comprehensiveRateLimit.js`** - Rate Limiting
   - Per-user rate limits
   - Plan-based limits
   - Protects against abuse

6. **`databaseInstrumentation.js`** - DB Observability
   - Wraps Supabase client
   - Logs all queries with duration
   - Injects trace context

---

## 5. Data Flow & Execution Paths

### 5.1 User Creates a Task

```
1. USER ACTION
   User fills TaskForm (URL, credentials, selectors)
   ↓
2. FRONTEND SUBMISSION
   POST /api/automation/execute
   Headers: { Authorization: Bearer token, traceparent: ... }
   ↓
3. BACKEND RECEIVES
   - authMiddleware: Verifies token, extracts userId
   - structuredLogging: Logs request with trace context
   - planEnforcement: Checks plan limits
   ↓
4. TASK CREATION
   - Creates record in automation_tasks table
   - Creates record in automation_runs table (status: 'queued')
   ↓
5. KAFKA MESSAGE
   - Publishes task to Kafka queue
   - Includes: taskId, userId, trace context in headers
   ↓
6. WORKER CONSUMES
   - Python worker polls Kafka
   - Extracts trace context, continues trace
   - Executes automation (Puppeteer)
   ↓
7. STATUS UPDATES
   - Worker updates automation_runs.status: 'running' -> 'completed'
   - Stores results (artifacts, extracted data)
   ↓
8. FRONTEND POLLS
   - Frontend polls /api/automation/runs/:id
   - Displays status updates in real-time
```

### 5.2 User Executes a Workflow

```
1. USER ACTION
   User clicks "Run Workflow" in WorkflowBuilder
   ↓
2. FRONTEND SUBMISSION
   POST /api/workflows/execute
   Body: { workflowId, inputData, executionMode }
   ↓
3. BACKEND RECEIVES
   - authMiddleware: Verifies user
   - planEnforcement: Checks workflow execution limits
   ↓
4. WORKFLOW EXECUTOR
   - WorkflowExecutor.startExecution()
   - Determines execution mode (real-time/balanced/eco)
   - Creates workflow_execution record
   ↓
5. STEP-BY-STEP EXECUTION
   For each step in workflow.config.nodes:
     - Execute step (web_scrape, api_call, etc.)
     - Store step result
     - Pass output to next step (via {{stepName.field}})
   ↓
6. INTEGRATION ACTIONS
   - If step.type === 'slack_send': executeSlackAction()
   - If step.type === 'gmail_send': executeGmailAction()
   - If step.type === 'sheets_write': executeSheetsAction()
   ↓
7. EXECUTION COMPLETE
   - Updates workflow_execution.status: 'completed'
   - Stores final output
   - Sends notification (if configured)
   ↓
8. FRONTEND UPDATES
   - Real-time status updates via polling/WebSocket
   - Shows results in execution history
```

### 5.3 AI Generates a Workflow

```
1. USER REQUEST
   User: "Monitor Reddit daily for my product mentions"
   ↓
2. AI AGENT PROCESSES
   - aiWorkflowAgent.handleMessage()
   - Calls OpenAI with system prompt (capabilities, examples)
   - OpenAI returns: { action: 'create_automated_workflow', ... }
   ↓
3. WORKFLOW GENERATION
   - generateFullyConfiguredWorkflow()
   - Creates nodes: [start, reddit_monitor, reddit_analyze, email]
   - Configures each step (keywords, schedule, email template)
   ↓
4. WORKFLOW CREATION
   - Inserts into workflows table
   - Stores canvas_config (nodes, edges)
   ↓
5. SCHEDULING
   - If trigger_type === 'schedule': smartScheduler.schedule()
   - Creates cron job
   - Sets execution_mode: 'eco' (scheduled = cost-optimized)
   ↓
6. EXECUTION
   - Cron triggers at scheduled time
   - WorkflowExecutor runs workflow
   - Results stored in workflow_execution
```

---

## 6. Database Schema

### 6.1 Core Tables

#### **`workflows`**
- Stores workflow definitions
- `canvas_config`: JSON with nodes and edges (ReactFlow format)
- `status`: active, paused, archived
- `user_id`: Owner

#### **`workflow_executions`**
- Tracks workflow execution runs
- `workflow_id`: FK to workflows
- `status`: queued, running, completed, failed
- `input_data`: JSON input
- `output_data`: JSON output
- `execution_mode`: real-time, balanced, eco

#### **`automation_tasks`**
- One-time task definitions
- `task_type`: invoice_download, web_scraping, form_submission
- `target_url`, `credentials`, `selectors`

#### **`automation_runs`**
- Task execution records
- `task_id`: FK to automation_tasks
- `status`: queued, running, completed, failed
- `artifact_url`: Link to downloaded file (PDF)
- `extracted_data`: AI-extracted data (JSON)

#### **`profiles`**
- User profile data
- `plan_id`: FK to plans (free, hobbyist, pro, enterprise)
- `is_trial`, `trial_ends_at`, `plan_expires_at`

#### **`plans`**
- Subscription plans
- `name`, `monthly_cost`, `features` (JSON)

#### **`integration_credentials`**
- OAuth credentials (encrypted)
- `service`: slack, gmail, google_sheets, etc.
- `credentials_encrypted`: Encrypted JSON

#### **`subscriptions`** (New)
- External service subscriptions to monitor
- `service_provider`, `plan_limit`, `alert_threshold`
- Links to workflows for usage checks

#### **`subscription_usage_checks`**
- Usage check records
- `subscription_id`, `current_usage_value`, `is_over_threshold`

#### **`subscription_alerts`**
- Alert records
- `subscription_id`, `alert_type`, `severity`, `message`

### 6.2 Key Relationships

```
users (auth.users)
  +─ profiles (1:1)
  |   +─ plans (many:1)
  +─ workflows (1:many)
  |   +─ workflow_executions (1:many)
  +─ automation_tasks (1:many)
  |   +─ automation_runs (1:many)
  +─ integration_credentials (1:many)
  +─ subscriptions (1:many)
      +─ subscription_usage_checks (1:many)
      +─ subscription_alerts (1:many)
```

### 6.3 Row-Level Security (RLS)

All tables have RLS policies:
- Users can only access their own data
- Queries automatically filtered by `auth.uid()`
- No cross-user data leakage

---

## 7. Frontend Architecture

### 7.1 Component Hierarchy

```
App.js
  +─ Router (React Router)
      +─ /auth -> AuthPage
      +─ /app -> App.dashboard.jsx
      |   +─ Header (Navigation)
      |   +─ DashboardPage
      |   +─ WorkflowBuilder (ReactFlow)
      |   +─ TasksPage
      |   +─ HistoryPage
      |   +─ SettingsPage
      +─ / (Landing) -> LandingPage
```

### 7.2 State Management

- **AuthContext**: User authentication state
- **ThemeContext**: Dark/light theme (stored in localStorage)
- **SessionContext**: Session management
- **Local State**: React hooks (useState, useEffect) for component state

### 7.3 API Communication

- **`utils/devNetLogger.js`**: `fetchWithAuth()` wrapper
  - Auto-adds auth headers
  - Handles errors
  - Logs to observability system
  - Includes trace context

### 7.4 Observability Integration

- **`utils/logger.js`**: Frontend logger
  - Creates trace context (traceId, spanId, requestId)
  - Sends logs to `/api/internal/front-logs`
  - All logs include: level, component, message, trace, user

---

## 8. Backend Services

### 8.1 WorkflowExecutor - Core Engine

**File**: `backend/services/workflowExecutor.js` (4085 lines)

**Responsibilities**:
1. Execute workflows step-by-step
2. Handle step types: web_scrape, api_call, data_transform, condition, email, delay
3. Manage execution state (running, completed, failed)
4. Retry failed steps with exponential backoff
5. Timeout protection
6. Variable substitution (`{{stepName.field}}`)

**Key Methods**:
- `startExecution()` - Main entry point
- `executeWorkflow()` - Step-by-step execution loop
- `_executeStep()` - Execute single step
- `_substituteVariables()` - Replace `{{variables}}` in step configs

**Step Execution Flow**:
```javascript
for (const step of workflow.steps) {
  // 1. Substitute variables: {{previousStep.field}}
  const config = _substituteVariables(step.config, stepResults);
  
  // 2. Execute step based on type
  switch (step.type) {
    case 'web_scrape':
      result = await _executeWebScrape(config);
    case 'api_call':
      result = await _executeApiCall(config);
    case 'slack_send':
      result = await executeSlackAction(config, userId);
    // ... etc
  }
  
  // 3. Store result for next step
  stepResults[step.id] = result;
}
```

### 8.2 AI Workflow Agent

**File**: `backend/services/aiWorkflowAgent.js`

**Responsibilities**:
1. Process user messages (natural language)
2. Generate workflows from descriptions
3. Configure workflow steps automatically
4. Schedule workflows (if requested)

**System Prompt** (Key Capabilities):
- Quick Actions: Scrape websites, send emails, check status
- Build Workflows: Multi-step automations
- Available Steps: 50+ integration actions
- Plain English: No technical jargon

### 8.3 Execution Mode Service

**File**: `backend/services/executionModeService.js`

**Execution Modes**:
1. **Real-Time** ($0.004/workflow)
   - User-triggered, immediate execution
   - High priority queue
   - Fast response time

2. **Balanced** ($0.0035/workflow)
   - Default mode
   - Standard priority

3. **Eco/Scheduled** ($0.003/workflow, 25% savings)
   - Scheduled workflows
   - Lower priority
   - Can batch multiple jobs

**Auto-Detection Logic**:
```javascript
if (context.triggeredBy === 'user') return 'real-time';
if (context.triggeredBy === 'schedule') return 'eco';
if (workflow.deadline && isNearDeadline()) return 'real-time';
return 'balanced';
```

### 8.4 Integration Framework

**File**: `backend/services/integrationFramework.js`

**OAuth Flow**:
1. User clicks "Connect Slack"
2. Backend generates OAuth URL
3. User authorizes in browser
4. OAuth callback -> Backend exchanges code for tokens
5. Tokens stored encrypted in `integration_credentials`
6. User can now use Slack actions in workflows

**Integration Actions**:
- `slack_send`: Send Slack message
- `gmail_send`: Send email
- `sheets_write`: Write to Google Sheets
- `reddit_monitor`: Monitor Reddit posts
- `reddit_analyze`: AI sentiment analysis

---

## 9. Integration Patterns

### 9.1 OAuth Integration Pattern

```javascript
// 1. Initiate OAuth (GET /api/integrations/oauth-url)
app.get('/api/integrations/:service/oauth-url', async (req, res) => {
  const state = generateStateToken();
  const oauthUrl = buildOAuthUrl(service, state);
  // Store state in integration_oauth_states table
  return res.json({ url: oauthUrl });
});

// 2. OAuth Callback (GET /api/integrations/oauth/callback)
app.get('/api/integrations/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  // Verify state token
  // Exchange code for access_token
  // Store encrypted credentials
  // Redirect to frontend success page
});
```

### 9.2 Workflow Step Integration

Workflow steps can call integrations:
```javascript
// In workflowExecutorIntegrations.js
async function executeSlackAction(stepConfig, userId) {
  // 1. Get user's Slack credentials
  const credentials = await getIntegrationCredentials(userId, 'slack');
  
  // 2. Decrypt credentials
  const { access_token } = decrypt(credentials.credentials_encrypted);
  
  // 3. Call Slack API
  const response = await axios.post('https://slack.com/api/chat.postMessage', {
    channel: stepConfig.channel,
    text: stepConfig.message
  }, {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  
  // 4. Return result for next step
  return { success: true, messageId: response.data.ts };
}
```

### 9.3 External API Calls

Workflow steps can make generic API calls:
```javascript
case 'api_call':
  const response = await axios({
    method: stepConfig.method, // GET, POST, PUT, DELETE
    url: stepConfig.url,
    headers: stepConfig.headers,
    data: stepConfig.body
  });
  return { status: response.status, data: response.data };
```

---

## 10. Observability System

### 10.1 Trace Context Propagation

**W3C Trace Context Standard**:
```
traceparent: 00-{traceId}-{spanId}-{flags}
```

**Flow**:
1. Frontend generates traceId, spanId
2. Sends `traceparent` header with API request
3. Backend extracts, creates child span
4. All logs include trace context automatically
5. Database queries include trace context
6. Kafka messages include trace context
7. Workers continue trace

### 10.2 Logging Architecture

**Frontend** -> **Backend** -> **Loki**:
```javascript
// Frontend
logger.error('Task failed', { error, taskId }, traceContext);
// -> POST /api/internal/front-logs
// -> Backend logs to stdout (Pino JSON)
// -> Promtail collects from Docker
// -> Loki stores and indexes
```

**Backend** -> **Loki**:
```javascript
// Backend
logger.info('Database query', { operation: 'SELECT', table: 'workflows' }, traceContext);
// -> stdout (Pino JSON)
// -> Promtail -> Loki
```

**Traces** -> **Tempo**:
```javascript
// OpenTelemetry automatically creates spans
const span = tracer.startSpan('execute_workflow');
// -> OTLP exporter -> Tempo
```

### 10.3 Querying Logs in Grafana

**LogQL Examples**:
```
# All logs for a trace
{service="rpa-system-backend"} | json | traceId="abc123"

# All errors in last hour
{service="rpa-system-backend"} | json | level="error"

# Slow database queries (>1000ms)
{service="rpa-system-backend"} | json | database.operation="SELECT" | performance.duration > 1000

# All logs for a user
{service="rpa-system-backend"} | json | trace.userId="user-123"
```

**Trace-to-Logs Correlation**:
- Click trace in Grafana -> See all related logs
- Click log in Loki -> See full trace

---

## 11. Execution Modes & Cost Optimization

### 11.1 Execution Modes

**Real-Time Mode**:
- Use Case: User clicks "Run Now"
- Cost: $0.004/workflow
- Speed: Fast (immediate execution)
- Priority: High

**Balanced Mode**:
- Use Case: Default for most workflows
- Cost: $0.0035/workflow
- Speed: Standard
- Priority: Normal

**Eco Mode**:
- Use Case: Scheduled workflows, batch jobs
- Cost: $0.003/workflow (25% savings)
- Speed: Acceptable delay (can batch)
- Priority: Low

### 11.2 Auto-Detection

```javascript
// executionModeService.js
determineExecutionMode(workflow, context) {
  // 1. Explicit mode
  if (workflow.execution_mode) return workflow.execution_mode;
  
  // 2. User-triggered -> Real-time
  if (context.triggeredBy === 'user') return 'real-time';
  
  // 3. Scheduled -> Eco (save costs)
  if (context.triggeredBy === 'schedule') return 'eco';
  
  // 4. Default
  return 'balanced';
}
```

### 11.3 Cost Savings Example

**Scenario**: 1000 scheduled workflows/month
- Real-time: 1000 × $0.004 = $4.00/month
- Eco: 1000 × $0.003 = $3.00/month
- **Savings: $1.00/month (25%)**

For subscription monitoring (daily checks):
- 30 checks/month × multiple subscriptions
- Eco mode = Significant cost savings

---

## 12. Development Patterns

### 12.1 Service Pattern

**All services follow this pattern**:
```javascript
const { createLogger } = require('../middleware/structuredLogging');
const logger = createLogger('serviceName');

async function doSomething(params) {
  try {
    logger.info('Starting operation', { params });
    
    // Business logic
    
    logger.info('Operation completed', { result });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Operation failed', { error: error.message, params });
    return { success: false, error: error.message };
  }
}

module.exports = { doSomething };
```

### 12.2 Route Pattern

**All routes follow this pattern**:
```javascript
app.post('/api/my-endpoint', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    // Validate input
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Missing data' });
    
    // Call service
    const result = await myService.doSomething(userId, data);
    
    // Return response
    return res.json(result);
  } catch (error) {
    logger.error('Endpoint error', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});
```

### 12.3 Component Pattern

**All React components**:
```javascript
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('ComponentName');

function MyComponent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  
  // Component logic
  
  return (
    <div data-theme={theme}>
      {/* JSX */}
    </div>
  );
}
```

### 12.4 Error Handling

**Structured Errors**:
```javascript
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: { userId, workflowId }
  });
  throw error; // Re-throw or return error response
}
```

---

## 13. Testing Strategy

### 13.1 Backend Tests (`backend/tests/`)

**Jest Test Pattern**:
```javascript
describe('MyService', () => {
  beforeEach(() => {
    // Mock Supabase
    global.supabase.from.mockImplementation(...);
  });
  
  it('should do something', async () => {
    const result = await myService.doSomething();
    expect(result.success).toBe(true);
  });
});
```

**Test Files**:
- `subscriptionMonitoringService.test.js` - Subscription service tests
- `executionModeService.test.js` - Execution mode tests
- `userPlanResolver.test.js` - Plan resolution tests

### 13.2 Frontend Tests (`rpa-dashboard/src/pages/__tests__/`)

**React Testing Library Pattern**:
```javascript
import { render, screen } from '@testing-library/react';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### 13.3 Python Tests (`automation/automation-service/`)

**Pytest Pattern**:
```python
def test_scraper_initialization():
    scraper = GenericScraper()
    assert scraper is not None
```

### 13.4 CI/CD Tests

**GitHub Actions Workflows**:
- `qa-dev.yml` - Dev branch tests (non-blocking)
- `qa-core.yml` - Core tests (blocking)
- `qa-integration.yml` - Integration tests
- `auto-fix.yml` - Auto-fix linting errors

---

## 14. Deployment & Infrastructure

### 14.1 Deployment Flow

```
1. Developer commits to dev branch
   ↓
2. GitHub Actions runs:
   - Linting
   - Tests
   - Security scan (Snyk)
   - Build verification
   ↓
3. Developer: npm run ship
   - Merges dev -> main
   - Runs all validations (blocking)
   - Pushes to main
   ↓
4. Vercel (Frontend):
   - Auto-deploys from main branch
   - Builds React app
   - Deploys to CDN
   ↓
5. Backend (Render/Other):
   - Manual or auto-deploy
   - Runs Node.js server
   ↓
6. Workers (Docker):
   - Deployed separately
   - Kafka consumer for tasks
```

### 14.2 Environment Variables

**Backend** (`backend/.env`):
```bash
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Firebase
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY=xxx

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_TRACE_SAMPLING_RATIO=0.1

# Kafka
KAFKA_BROKERS=localhost:9092

# Workers
AUTOMATION_URL=http://localhost:8000
```

**Frontend** (`rpa-dashboard/.env.local`):
```bash
REACT_APP_SUPABASE_URL=https://xxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=xxx
REACT_APP_FIREBASE_API_KEY=xxx
```

### 14.3 Monitoring Stack

**Docker Compose** (`rpa-system/monitoring/`):
- **Prometheus**: Metrics collection
- **Loki**: Log aggregation
- **Tempo**: Trace storage
- **Grafana**: Visualization
- **Promtail**: Log collector

**Access**:
- Grafana: http://localhost:3001 (admin/admin123)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100

---

## 15. Key Concepts Deep Dive

### 15.1 Workflow Execution Lifecycle

```
1. WORKFLOW CREATION
   - User builds workflow in ReactFlow
   - Saves to database (workflows table)
   - canvas_config stores nodes + edges

2. WORKFLOW EXECUTION REQUEST
   - User clicks "Run" or scheduled trigger
   - POST /api/workflows/execute
   - executionMode determined

3. EXECUTION INITIALIZATION
   - WorkflowExecutor.startExecution()
   - Creates workflow_execution record
   - Loads workflow + steps from DB

4. STEP EXECUTION LOOP
   - For each step in order:
     a. Substitute variables: {{previousStep.field}}
     b. Execute step based on type
     c. Store result in stepResults map
     d. Pass to next step

5. COMPLETION
   - All steps complete
   - Final output stored
   - Status: 'completed'
   - Notification sent (if configured)
```

### 15.2 Variable Substitution

**Syntax**: `{{stepId.fieldName}}`

**Example**:
```javascript
// Step 1: web_scrape
result: { title: "Hello", price: "$10" }

// Step 2: api_call uses result
config: {
  url: "https://api.example.com",
  body: { title: "{{step1.title}}", cost: "{{step1.price}}" }
}
// Becomes: { title: "Hello", cost: "$10" }
```

**Implementation**:
```javascript
function _substituteVariables(template, stepResults) {
  return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, stepId, field) => {
    return stepResults[stepId]?.[field] || match;
  });
}
```

### 15.3 Plan Enforcement

**Middleware**: `planEnforcement.js`

**Checks**:
- `requireWorkflowRun`: Can user execute workflows? (plan limit)
- `requireFeature`: Does plan include feature? (e.g., scheduled workflows)
- `checkStorageLimit`: Is user under storage limit?

**Plan Levels**:
- **Free**: Limited workflows, no scheduling
- **Hobbyist**: More workflows, basic scheduling
- **Pro**: Unlimited workflows, advanced features
- **Enterprise**: Custom limits

### 15.4 Rate Limiting

**Middleware**: `comprehensiveRateLimit.js`

**Limits**:
- Per-user rate limits
- Plan-based limits (higher plans = more requests)
- Protects against abuse
- Returns 429 Too Many Requests when exceeded

### 15.5 Security

**SSRF Protection**:
- `validateUrlForSSRF()` utility
- Prevents Server-Side Request Forgery
- Blocks private IPs, localhost, etc.

**Authentication**:
- Firebase Auth (frontend) -> JWT tokens
- Backend verifies tokens
- Supabase RLS enforces data access

**Credential Storage**:
- OAuth tokens encrypted in `integration_credentials`
- Never exposed in logs or responses

---

## 16. Learning Path

### Phase 1: Foundation (Week 1)

1. **Understand the Architecture**
   - Read this study guide
   - Explore `README.md` and `DAILY_DEVELOPER_GUIDE.md`
   - Understand frontend ↔ backend ↔ worker flow

2. **Set Up Development Environment**
   ```bash
   ./start-dev.sh
   # Access: http://localhost:3000 (frontend)
   # Access: http://localhost:3030 (backend)
   ```

3. **Explore Key Files**
   - `rpa-system/backend/app.js` - Route registration
   - `rpa-system/backend/services/workflowExecutor.js` - Core engine
   - `rpa-system/rpa-dashboard/src/App.dashboard.jsx` - Frontend router

### Phase 2: Core Components (Week 2)

1. **Workflow Execution**
   - Study `workflowExecutor.js` (lines 536-832: startExecution)
   - Understand step execution loop
   - Trace a simple workflow execution

2. **Frontend Workflow Builder**
   - Study `rpa-dashboard/src/components/WorkflowBuilder/`
   - Understand ReactFlow integration
   - See how workflows are saved/loaded

3. **Database Schema**
   - Read `docs/database/master_schema.sql`
   - Understand key tables: workflows, workflow_executions, automation_tasks
   - Query database directly (Supabase dashboard)

### Phase 3: Integrations (Week 3)

1. **OAuth Flow**
   - Study `backend/routes/integrationRoutes.js`
   - Trace: User clicks "Connect Slack" -> OAuth -> Credential storage
   - Test with a real integration

2. **Integration Actions**
   - Study `backend/services/workflowExecutorIntegrations.js`
   - See how Slack/Gmail/Sheets actions work
   - Create a workflow using integrations

3. **External APIs**
   - Study `api_call` step execution
   - Make API calls from workflows
   - Handle authentication

### Phase 4: Advanced Features (Week 4)

1. **AI Workflow Generation**
   - Study `backend/services/aiWorkflowAgent.js`
   - Understand system prompt structure
   - Test AI assistant conversations

2. **Execution Modes**
   - Study `backend/services/executionModeService.js`
   - Understand cost optimization
   - Create scheduled workflows (eco mode)

3. **Observability**
   - Set up Grafana: http://localhost:3001
   - Query logs in Loki
   - Follow a trace end-to-end
   - Understand trace context propagation

### Phase 5: Mastery (Ongoing)

1. **Read All Service Files**
   - Go through each service in `backend/services/`
   - Understand responsibilities
   - See how they interact

2. **Build Features**
   - Add a new workflow step type
   - Add a new integration
   - Create a new API endpoint

3. **Debug Production Issues**
   - Use Grafana to trace issues
   - Query logs for errors
   - Understand error flows

---

## Quick Reference

### Key Files to Master

**Backend Core**:
- `backend/app.js` - All routes (8113 lines)
- `backend/services/workflowExecutor.js` - Workflow execution (4085 lines)
- `backend/services/aiWorkflowAgent.js` - AI assistant
- `backend/services/executionModeService.js` - Cost optimization

**Frontend Core**:
- `rpa-dashboard/src/App.dashboard.jsx` - Router
- `rpa-dashboard/src/components/WorkflowBuilder/` - Workflow builder
- `rpa-dashboard/src/pages/DashboardPage.jsx` - Main dashboard

**Integration**:
- `backend/services/workflowExecutorIntegrations.js` - Integration actions
- `backend/routes/integrationRoutes.js` - OAuth flows

**Observability**:
- `backend/middleware/structuredLogging.js` - Logging
- `backend/middleware/telemetryInit.js` - Tracing
- `backend/middleware/databaseInstrumentation.js` - DB logs

### Common Commands

```bash
# Start development
./start-dev.sh

# Run tests
npm run test:all

# Lint and fix
npm run lint:fix

# Ship to production
npm run ship

# Watch logs
npm run logs
```

### Key URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3030
- Grafana: http://localhost:3001
- Supabase Dashboard: https://supabase.com/dashboard

---

## Study Tips

1. **Start Small**: Understand one component at a time
2. **Trace Execution**: Follow a request from frontend -> backend -> database
3. **Use Observability**: Grafana shows you exactly what's happening
4. **Read Tests**: Tests show how components are used
5. **Experiment**: Modify code, see what breaks, understand why
6. **Ask Questions**: Use observability to answer your own questions

---

## Next Steps

1. Read this study guide completely
2. Set up development environment
3. Trace a simple workflow execution end-to-end
4. Explore Grafana dashboards
5. Read core service files
6. Build a simple feature

You're ready to master EasyFlow!

