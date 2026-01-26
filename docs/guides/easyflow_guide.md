# EasyFlow: Complete System Guide

This guide provides a comprehensive overview of the EasyFlow RPA automation platform, covering architecture, development, and common use cases.

---

## Table of Contents

1. [What is EasyFlow?](#what-is-easyflow)
2. [Core Value Proposition](#core-value-proposition)
3. [System Architecture](#system-architecture)
4. [Key Use Cases](#key-use-cases)
5. [Development Guide](#development-guide)
6. [Integration Patterns](#integration-patterns)
7. [Observability & Monitoring](#observability--monitoring)

---

## What is EasyFlow?

EasyFlow is a **Robotic Process Automation (RPA) platform** that automates repetitive browser-based workflows. It serves as your "robot intern" that handles:

- Portal logins and data extraction
- CSV/file downloads from web applications
- Form filling and data entry
- Report generation and scheduling
- Cross-app integrations (Slack, Google Sheets, email, etc.)

### Key Features

- **Visual Workflow Builder**: Drag-and-drop interface with ReactFlow
- **Headless Browser Automation**: Puppeteer-powered web scraping
- **Smart Scheduling**: Cron-based execution with timezone support
- **Cost Optimization**: Execution modes (realtime, balanced, eco)
- **Enterprise Security**: RLS, encrypted credentials, OAuth flows
- **Full Observability**: Grafana/Loki/Tempo tracing

---

## Core Value Proposition

### The "Robot Intern" for Data Pipelines

EasyFlow eliminates the manual "log in + export" layer, enabling downstream tools (Python, DuckDB, BI dashboards) to work with always-up-to-date data automatically.

#### Traditional Workflow (Manual)
```
Human → Login to portal → Navigate → Filter → Export CSV → Download → Organize file → Remember to repeat
```

#### EasyFlow Workflow (Automated)
```
EasyFlow → Login (headless) → Navigate → Filter → Export → Upload to S3/Drive/Folder → Notify downstream systems
```

### Benefits

✅ **Eliminate Manual Work**: No more weekly portal logins  
✅ **Standardized Output**: Consistent file locations and naming  
✅ **Reliable Scheduling**: Never miss a data export  
✅ **Automatic Retries**: Handles portal slowness/failures  
✅ **Real-time Notifications**: Know immediately if something fails (Slack/Email)  
✅ **Cost Effective**: Batch processing during off-peak hours  
✅ **Scalable**: Handle hundreds of portals with one platform  
✅ **Observable**: Full visibility into execution metrics (P50, P95, P99)

**See**: [Portal CSV Automation Guide](../use-cases/PORTAL_CSV_AUTOMATION.md) for detailed use case

---

## System Architecture

EasyFlow follows a **queue-based, stateless architecture** designed for scalability and reliability.

### The Pattern (One Pattern, Everything Else Is Details)

```
User clicks button → Backend receives → Creates DB record → 
Publishes to Kafka queue → Worker picks up message → 
Executes task/workflow → Updates DB with result → 
Frontend polls and shows result
```

**That's it. Master this and you understand EasyFlow.**

### The Stack (Why Each Exists)

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + ReactFlow | User builds workflows visually, makes API calls, polls for results |
| Backend | Node.js/Express | Receives requests, queues tasks, returns responses (stateless, scales) |
| Queue | Kafka | Decouples backend from workers; survives restarts; distributes work |
| Workers | Python + Puppeteer | Executes actual automation (browser control, file downloads, web scraping) |
| Database | Supabase/PostgreSQL | Source of truth; RLS prevents cross-user data leakage |
| Observability | Grafana/Loki/Tempo | Trace every request end-to-end; debug production issues |

### Architecture Principles

1. **Statelessness**: API returns 202 Accepted immediately, decoupling from long-running tasks
2. **CP Consistency**: Following CAP Theorem, we prioritize Consistency and Partition Tolerance
3. **P99 Focus**: Log duration of every call to track tail-end latency (1% of slowest users)
4. **Queue-Based**: Kafka decouples request handling from execution
5. **Observable**: Every request has a trace ID for end-to-end debugging

---

## Key Use Cases

### 1. Portal CSV Automation

EasyFlow can be the "robot intern" that does the portal + CSV export for you, so your Python/DuckDB/BI stack just picks up clean files on autopilot.

**How it works:**

1. **Replace manual portal logins**: Headless browser logs into portals, navigates to reports, clicks export buttons
2. **Standardize where CSVs land**: Download to server folder, S3/Drive bucket, or Google Sheet
3. **Schedule everything**: Daily/weekly/hourly automated exports with retries
4. **Feed dashboards/AI**: Python/DuckDB reads latest CSVs, BI tools display metrics

**Example Setup ($197 typical):**
- Map out each portal's export flow
- Build and test browser automations
- Wire outputs into existing script/DB/dashboard

**See**: [Portal CSV Automation Guide](../use-cases/PORTAL_CSV_AUTOMATION.md) for complete details

### 2. Notion Workspace Automation

Automate Notion organization and life OS management:

- **Ingest and Understand**: Connect via API, discover all pages/databases
- **Classify and Clean**: Auto-detect content types, flag duplicates, normalize titles
- **Restructure Workspace**: Propose structure, move pages, create databases
- **Turn Notes Into Tasks**: Scan for todos, create proper tasks with metadata
- **AI Editing**: Rewrite messy notes, summarize long pages, standardize templates
- **Automations**: Triggers on events, scheduled jobs, notifications

### 3. Reddit Monitoring

Monitor Reddit for product mentions:
- LLM generates workflow: monitor subreddits → analyze sentiment → email summary
- Scheduled checks with customizable frequency
- Sentiment analysis and alert routing

---

## Development Guide

### How a Workflow Actually Executes

#### 1. User builds workflow in UI (ReactFlow canvas)
- Nodes: web_scrape, api_call, slack_send, etc.
- Edges: data flows from one step to next
- Saved to DB as JSON (canvas_config)

#### 2. User clicks "Run"
- Frontend: POST /api/workflows/execute
- Backend receives, creates workflow_execution record, publishes to Kafka

#### 3. Worker picks up Kafka message
- Loads workflow config from database
- Executes step-by-step

```javascript
for (const step of workflow.steps) {
  // Replace {{previousStep.field}} with actual values
  const config = substituteVariables(step.config, stepResults);
  
  // Execute based on type
  const result = await executeStep(step.type, config);
  
  // Store for next step
  stepResults[step.id] = result;
}
```

#### 4. Results flow between steps
- Step 1 scrapes website → returns `{ title: "Hello", price: "$10" }`
- Step 2 API call uses: `{ url: "{{step1.title}}" }` → becomes `{ url: "Hello" }`
- Step 3 sends Slack message with Step 2's result

#### 5. Execution completes
- Worker updates workflow_execution.status = "completed"
- Frontend polling detects change, displays results

### Database: One Table for Each Thing

```
workflows           → Store workflow definitions (JSON canvas + settings)
workflow_executions → Store execution records (one per run)
automation_tasks    → Store one-off tasks (invoice download, scrape, etc.)
automation_runs     → Store task execution records
profiles            → User settings + subscription plan
integration_creds   → Encrypted OAuth tokens (Slack, Gmail, etc.)
```

**Key security**: RLS policies automatically filter: `WHERE user_id = auth.uid()`

You cannot query another user's data even if you try.

### The 5 Services You Actually Need to Know

#### 1. workflowExecutor.js (The Core)
- `startExecution()`: Main entry point
- Loops through workflow steps
- Substitutes variables between steps
- Handles retries on failure
- File: ~4000 lines but only 100 lines matter (the step loop)

#### 2. executionModeService.js (Cost Optimization)

Decision tree:

```javascript
if (triggeredBy === 'user') return 'real-time';     // $0.004
if (triggeredBy === 'schedule') return 'eco';       // $0.003 (25% cheaper)
return 'balanced';                                   // $0.0035
```

#### 3. integrationFramework.js (OAuth)
- User clicks "Connect Slack"
- Browser redirects to Slack OAuth
- Slack redirects back with auth code
- Backend exchanges code for token
- Token encrypted and stored
- Done—user can now use Slack in workflows

#### 4. smartScheduler.js (Cron)
- Stores cron schedule
- Triggers workflows at scheduled time
- Timezone-aware

#### 5. aiWorkflowAgent.js (Not Essential Yet)
- User: "Monitor Reddit for my product mentions"
- LLM: "I'll create a workflow with 3 steps: monitor, analyze, email"
- Auto-generates workflow config
- Useful but not core to your understanding

### Development Pattern (Every Service Follows This)

```javascript
const logger = createLogger('ServiceName');

async function doSomething(userId, params) {
  try {
    logger.info('Starting', { params });
    
    // Business logic here
    const result = await somethingAsync();
    
    logger.info('Completed', { result });
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed', { error: error.message, params });
    return { success: false, error: error.message };
  }
}

module.exports = { doSomething };
```

Every route:

```javascript
app.post('/api/endpoint', authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Missing data' });
  
  const result = await service.doSomething(userId, data);
  return res.json(result);
});
```

**Copy this pattern. Don't deviate.**

### What You Actually Need to Do

#### To Ship a Feature:
1. Understand the pattern (queue → worker → poll)
2. Find the relevant service file
3. Add your logic following the established pattern
4. Write a test
5. Deploy (npm run ship)
6. Monitor in Grafana

#### To Debug:
1. Get the request/workflow ID
2. Search Grafana by trace ID
3. Read the logs
4. Find the error
5. Fix it

#### To Learn Something:
1. Read one relevant file
2. Find an existing example
3. Modify it slightly
4. Test locally
5. Check logs in Grafana

---

## Integration Patterns

### Pattern 1: File-Based Integration

```
EasyFlow → Download CSV → Local/Cloud Storage → Python Script → DuckDB → Dashboard
```

**Advantages:**
- Simple file-based interface
- No API dependencies
- Works with any downstream tool

### Pattern 2: Database Integration

```
EasyFlow → Download CSV → Parse & Insert → Landing Table → ETL Pipeline → Data Warehouse
```

**Advantages:**
- Centralized data storage
- Better data validation
- Transactional consistency

### Pattern 3: API/Webhook Integration

```
EasyFlow → Download CSV → Upload to S3 → Webhook → Python Script → Process → Notify
```

**Advantages:**
- Real-time processing
- Event-driven architecture
- Better error handling

---

## Observability & Monitoring

### Observability: The Superpower

Every request has a `traceparent` header:

```
traceparent: 00-{traceId}-{spanId}-{flags}
```

This single ID ties together:
- Frontend API request
- Backend processing
- Database queries
- Kafka message
- Worker execution
- All logs

In Grafana, search by traceId and see the entire request flow end-to-end.

### Execution Monitoring

**Metrics Tracked:**
- Real-time execution status
- Success/failure rates
- Execution duration (P50, P95, P99)
- File download statistics
- Cost per execution

**Alerting:**
- Failed exports → Slack/Email
- Portal login failures → Immediate notification
- File processing errors → Alert downstream systems

**Analytics:**
- Portal availability tracking
- Export success rates
- Processing times
- Cost optimization opportunities

### Grafana Dashboard

Access: http://localhost:3001 (admin/admin123)

**Key Views:**
- Request traces (by trace ID)
- Service logs (by service name)
- Error rates
- Latency percentiles (P50, P95, P99)
- Execution costs

---

## Quick Reference

| Need to... | Action |
|-----------|--------|
| Add workflow step type | Edit `workflowExecutor.js`, add case in switch |
| Add integration | OAuth in `integrationFramework.js`, executor in `workflowExecutorIntegrations.js` |
| Debug failing execution | Search Grafana by workflow_id or trace ID |
| Create new API endpoint | Copy route pattern, follow middleware checklist |
| Write test | Copy existing test pattern, modify |
| Deploy | `npm run ship` |
| Check logs | Grafana → Loki → search by service/trace/userId |

---

## The Files You Actually Read

### Must read (in order):
1. `backend/services/workflowExecutor.js` - lines 536-600 (startExecution method)
2. `backend/services/executionModeService.js` - entire file (simple decision tree)
3. `backend/services/integrationFramework.js` - OAuth flow section
4. `backend/middleware/structuredLogging.js` - how logging works
5. One route file (e.g., `backend/routes/workflowRoutes.js`) - see the pattern

### Can skim:
- All other services (understand from descriptions)
- Database schema (understand relationships, not details)
- Frontend components (you'll understand from using the UI)

### Don't read:
- Line-by-line code walkthroughs
- Concept explanations for things you already know

---

## Related Documentation

- **[Portal CSV Automation](../use-cases/PORTAL_CSV_AUTOMATION.md)** - Detailed use case guide
- **[Daily Developer Guide](../../DAILY_DEVELOPER_GUIDE.md)** - Daily workflow guide
- **[Architecture Overview](../architecture/OBSERVABILITY_ARCHITECTURE.md)** - Deep dive into architecture
- **[Route Map](../architecture/ROUTE_MAP.md)** - API route documentation

---

## The Truth

You don't need to "master" everything. You need to:

1. **Understand the pattern** (done in 5 minutes)
2. **Know where to find things** (read the 5 key files)
3. **Be able to trace requests** (Grafana)
4. **Follow the established patterns** (copy existing code)

That's it. Everything else is details you'll learn by doing.
