# EasyFlow: The Actual Study Guide

## One Pattern, Everything Else Is Details

```
User clicks button → Backend receives → Creates DB record → 
Publishes to Kafka queue → Worker picks up message → 
Executes task/workflow → Updates DB with result → 
Frontend polls and shows result
```

**That's it. Master this and you understand EasyFlow.**

---

## The Stack (Why Each Exists)

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + ReactFlow | User builds workflows visually, makes API calls, polls for results |
| Backend | Node.js/Express | Receives requests, queues tasks, returns responses (stateless, scales) |
| Queue | Kafka | Decouples backend from workers; survives restarts; distributes work |
| Workers | Python + Puppeteer | Executes actual automation (browser control, file downloads, web scraping) |
| Database | Supabase/PostgreSQL | Source of truth; RLS prevents cross-user data leakage |
| Observability | Grafana/Loki/Tempo | Trace every request end-to-end; debug production issues |

---

## How a Workflow Actually Executes

### 1. User builds workflow in UI (ReactFlow canvas)
- Nodes: web_scrape, api_call, slack_send, etc.
- Edges: data flows from one step to next
- Saved to DB as JSON (canvas_config)

### 2. User clicks "Run"
- Frontend: POST /api/workflows/execute
- Backend receives, creates workflow_execution record, publishes to Kafka

### 3. Worker picks up Kafka message
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

### 4. Results flow between steps
- Step 1 scrapes website → returns `{ title: "Hello", price: "$10" }`
- Step 2 API call uses: `{ url: "{{step1.title}}" }` → becomes `{ url: "Hello" }`
- Step 3 sends Slack message with Step 2's result

### 5. Execution completes
- Worker updates workflow_execution.status = "completed"
- Frontend polling detects change, displays results

---

## Database: One Table for Each Thing

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

---

## The 5 Services You Actually Need to Know

### 1. workflowExecutor.js (The Core)
- `startExecution()`: Main entry point
- Loops through workflow steps
- Substitutes variables between steps
- Handles retries on failure
- File: ~4000 lines but only 100 lines matter (the step loop)

### 2. executionModeService.js (Cost Optimization)

Decision tree:

```javascript
if (triggeredBy === 'user') return 'real-time';     // $0.004
if (triggeredBy === 'schedule') return 'eco';       // $0.003 (25% cheaper)
return 'balanced';                                   // $0.0035
```

### 3. integrationFramework.js (OAuth)
- User clicks "Connect Slack"
- Browser redirects to Slack OAuth
- Slack redirects back with auth code
- Backend exchanges code for token
- Token encrypted and stored
- Done—user can now use Slack in workflows

### 4. smartScheduler.js (Cron)
- Stores cron schedule
- Triggers workflows at scheduled time
- Timezone-aware

### 5. aiWorkflowAgent.js (Not Essential Yet)
- User: "Monitor Reddit for my product mentions"
- LLM: "I'll create a workflow with 3 steps: monitor, analyze, email"
- Auto-generates workflow config
- Useful but not core to your understanding

---

## What Happens When You...

### Add a New Workflow Step Type

1. Update `workflowExecutor.js`: Add case in switch statement

```javascript
case 'my_new_step':
  result = await executeMyNewStep(config);
  break;
```

2. Implement the executor:

```javascript
async function executeMyNewStep(config) {
  // Do something
  return result;
}
```

3. Update frontend: Add UI to configure this step in WorkflowBuilder

4. Test: Create workflow with step, run it, check logs in Grafana

### Add a New Integration (Slack, Gmail, etc.)

1. OAuth setup: `integrationFramework.js`
   - Generate OAuth URL
   - Handle callback
   - Store encrypted token

2. Workflow executor: `workflowExecutorIntegrations.js`

```javascript
case 'slack_send':
  const creds = await getIntegrationCredentials(userId, 'slack');
  const token = decrypt(creds.credentials_encrypted);
  await slack.chat.postMessage({ token, channel, text });
  break;
```

3. Frontend: Add "Connect [Service]" button, add step type in builder

### Debug a Failing Workflow

1. Get workflow_execution.id (from database or UI)
2. Open Grafana: http://localhost:3001
3. Query: `{service="backend"} | json | workflow_id="abc123"`
4. Search logs for the trace
5. See exact error and stack trace

---

## Observability: The Superpower

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

---

## Development Pattern (Every Service Follows This)

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

---

## Plan Limits & Rate Limiting

Middleware checks:
- `authMiddleware`: Is user logged in?
- `planEnforcement`: Is user's plan allowed to do this?
- `comprehensiveRateLimit`: Is user over rate limit?

If any fail, return error immediately. This protects against abuse.

---

## Testing Strategy

### Backend Tests

```javascript
describe('Service', () => {
  it('should do something', async () => {
    const result = await service.doSomething();
    expect(result.success).toBe(true);
  });
});
```

### Frontend Tests

```javascript
test('renders component', () => {
  render(<Component />);
  expect(screen.getByText('Expected')).toBeInTheDocument();
});
```

Run: `npm run test`

---

## Deployment

```
git push main
  ↓
GitHub Actions: lint + test + security scan
  ↓
Vercel: Deploy frontend (auto)
Render: Deploy backend (manual or auto)
Docker: Deploy workers
  ↓
Grafana monitors everything
```

---

## What You Actually Need to Do

### To Ship a Feature:
1. Understand the pattern (queue → worker → poll)
2. Find the relevant service file
3. Add your logic following the established pattern
4. Write a test
5. Deploy (npm run ship)
6. Monitor in Grafana

### To Debug:
1. Get the request/workflow ID
2. Search Grafana by trace ID
3. Read the logs
4. Find the error
5. Fix it

### To Learn Something:
1. Read one relevant file
2. Find an existing example
3. Modify it slightly
4. Test locally
5. Check logs in Grafana

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

## The Truth

You don't need to "master" everything. You need to:

1. **Understand the pattern** (done in 5 minutes)
2. **Know where to find things** (read the 5 key files)
3. **Be able to trace requests** (Grafana)
4. **Follow the established patterns** (copy existing code)

That's it. Everything else is details you'll learn by doing.
