# EasyFlow Observability Debugging Guide

**📌 Your guide to debugging the app using observability tools**

---

## 🎯 What Is This System For?

Your observability stack gives you **three superpowers** to debug your application:

1. **📊 Metrics** - Numbers that change (performance, counts, rates)
2. **🔍 Traces** - Request paths through services (distributed tracing)
3. **📝 Logs** - Detailed event context (what happened and why)

**Think of it like this:**
- **Metrics** tell you there's a problem
- **Logs** tell you what the problem is
- **Traces** tell you where the problem is happening

---

## ⚡ Performance Troubleshooting

### Problem: "Query timeout" Errors

**Symptom:** Frontend shows "Query timeout" when loading workflows, especially on first load. Refresh fixes it.

**Root Causes:**
1. **Missing database indexes** - Slow queries without proper indexes
2. **Database cold start** - Supabase serverless instances pause when inactive

**Solution 1: Add Database Indexes**

Run the migration: `rpa-system/backend/migrations/add_performance_indexes.sql`

**Verify indexes were created:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'workflows' 
ORDER BY indexname;
```

**Test query performance:**
```sql
EXPLAIN ANALYZE
SELECT * FROM workflows 
WHERE user_id = '<test-user-id>'
ORDER BY updated_at DESC;
```

**Before indexes:** Should show "Seq Scan" (slow)  
**After indexes:** Should show "Index Scan" (fast)

**Solution 2: Database Warm-Up (Cold Start Fix)**

**Problem:** Supabase free tier pauses inactive databases. First request after inactivity times out while database wakes up (5-15 seconds).

**Solution:** Database warm-up blocks server startup until database is ready.

**How to verify it's working:**
- Check backend logs for `[DatabaseWarmup]` messages
- Monitor database query duration metrics in Grafana
- Watch for timeout errors in Loki logs

**Monitoring:**
- Check backend logs for `[DatabaseWarmup]` messages
- Monitor database query duration metrics in Grafana
- Watch for timeout errors in Loki logs

---

### Problem: Save Operation Hanging

**Symptom:** Workflow save operations (PATCH/PUT `/api/workflows/:id`) hang or take very long to complete, even after cold start is fixed.

**Root Cause:** The bottleneck is likely in one of these areas:
1. **Database queries** - Slow UPDATE/INSERT operations
2. **Synchronous validation** - Complex validation logic blocking the request
3. **Nested operations** - Multiple sequential database calls

**Solution: Use Distributed Tracing to Find the Bottleneck**

#### Step 1: Trigger the Slow Save

1. **Open browser developer tools:**
   - Press `F12` or right-click → Inspect
   - Go to the **Network** tab
   - Filter by "XHR" or "Fetch"

2. **Save your workflow:**
   - Make a change in the Workflow Builder
   - Click "Save"
   - Watch for the PATCH/PUT request to `/api/workflows/:id`

3. **Note the request details:**
   - Request URL (contains workflow ID)
   - Request start time
   - Duration (if it completes)

#### Step 2: Find the Trace in Grafana

**Option A: Via Tempo Explore (Recommended)**

1. **Open Grafana:** http://localhost:3001
2. **Go to Explore** → Select **Tempo** datasource
3. **Search for the trace:**
   ```
   {service.name="rpa-system-backend"} && name=~".*workflows.*"
   ```
   Or more specifically:
   ```
   {service.name="rpa-system-backend"} && name=~"PATCH.*workflows|PUT.*workflows"
   ```

4. **Filter by time range:**
   - Set time range to include when you clicked "Save"
   - Look for traces with long duration

5. **Click on a trace** to see the span breakdown

**Option B: Via Backend Metrics Dashboard**

1. **Open Grafana:** http://localhost:3001
2. **Navigate to:** Dashboards → Backend Metrics Dashboard
3. **Look at "Latency Heatmap"** panel
4. **Find the slow request** around the time you saved
5. **Click on the request** to view its trace (if linked)

#### Step 3: Analyze the Trace

**What to Look For:**

The trace will show a parent span like `PATCH /api/workflows/:id` with child spans underneath. Look for the **longest span**:

**If the longest span is:**
- **`db.query` or `db.update`** → Database is the bottleneck
  - **Solution:** Check database indexes, query optimization
  - **Check:** Are you updating multiple tables sequentially?
  - **Check:** Are you doing complex JOINs or subqueries?

- **`workflow.validate` or custom validation span** → Validation logic is slow
  - **Solution:** Optimize validation, make it async if possible
  - **Check:** Are you validating against external services?
  - **Check:** Are you doing expensive computations?

- **`workflow.save` or `workflow.update`** → The save operation itself
  - **Solution:** Check what's inside this span - look at its child spans
  - **Check:** Are you saving steps/connections individually?
  - **Check:** Are you doing versioning or audit logging synchronously?

**Example Trace Analysis:**

```
PATCH /api/workflows/:id (total: 5.2s)
├── authMiddleware (0.01s) ✅ Fast
├── workflow.validate (0.05s) ✅ Fast
├── db.update workflows (0.1s) ✅ Fast
├── db.update workflow_steps (4.8s) ❌ SLOW!
│   ├── db.delete old steps (2.1s)
│   └── db.insert new steps (2.7s)
└── db.update workflow_connections (0.2s) ✅ Fast
```

**In this example:** The bottleneck is updating `workflow_steps` - likely doing individual DELETE/INSERT operations instead of batch operations.

#### Step 4: Check Logs for More Context

Once you've identified the slow span, search logs for that operation:

```logql
# Find logs for the workflow save operation
{job="easyflow-backend"} |= "workflow" |= "save" |= "<workflow-id>"

# Or search by trace ID (from the trace you found)
{job="easyflow-backend"} |= "<trace-id>"
```

**Look for:**
- Database query logs showing slow queries
- Validation errors or warnings
- Any error messages that might indicate the problem

#### Step 5: Common Fixes

**If Database is Slow:**
1. **Check indexes:**
   ```sql
   -- Check if workflow_steps has indexes on workflow_id
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'workflow_steps';
   ```

2. **Use batch operations:**
   - Instead of individual DELETE/INSERT, use `upsert` or batch operations
   - Example: Use Supabase's `.upsert()` instead of `.delete().insert()`

3. **Optimize queries:**
   - Use transactions to batch multiple operations
   - Avoid N+1 queries (querying inside loops)

**If Validation is Slow:**
1. **Make validation async:**
   - Move expensive validation to background jobs
   - Return success immediately, validate later

2. **Cache validation results:**
   - Cache expensive validation checks
   - Only re-validate when data changes

**If Save Operation is Slow:**
1. **Batch database operations:**
   - Save all steps in one transaction
   - Use bulk INSERT/UPDATE operations

2. **Move non-critical work to background:**
   - Versioning, audit logging, notifications
   - Don't block the save response

#### Quick Query Reference

**Find slow workflow saves in Tempo:**
```
{service.name="rpa-system-backend"} && name=~".*workflows.*" && duration>2s
```

**Find slow database operations:**
```
{service.name="rpa-system-backend"} && name=~"db\\.(query|update|insert)" && duration>1s
```

**Find all slow requests (>5s):**
```
{service.name="rpa-system-backend"} && duration>5s
```

---

## 🔍 Troubleshooting Workflows

### Problem: "Workflow completed but no steps executed"

**What's happening:**
1. Frontend sends workflow execution request
2. Backend receives it and publishes task to Kafka
3. Automation worker should consume the task
4. **But**: Worker isn't getting the tasks from Kafka

### Step-by-Step Debugging

#### 1. Check Backend Metrics
Open: http://localhost:9091/metrics

**Look for:**
```
# Backend is exporting metrics
up 1

# Workflows are being attempted
workflow_execution_total 75

# But steps aren't executing
workflow_step_execution_total 0  # <-- This should be > 0!
```

#### 2. Check Prometheus Targets
Open: http://localhost:9090/targets

**Verify all targets are "UP":**
- ✅ easyflow-backend (host.docker.internal:9091)
- ✅ prometheus (127.0.0.1:9090)

If backend shows "DOWN", check:
- Backend is running: `pm2 list`
- Metrics endpoint accessible: `curl http://localhost:9091/metrics`

#### 3. Query Workflow Traces in Grafana
Open: http://localhost:3001 (login: admin/admin123)

**Navigate to:** Dashboards → Workflow Execution Observability

**What you should see:**
- Execution traces with parent-child spans
- Each trace should show: `backend.execute` → `kafka.produce` → `worker.consume` → `workflow.step.execute`

**If traces are missing spans:**
- Missing `kafka.produce` = Backend isn't publishing to Kafka
- Missing `worker.consume` = Worker isn't connected to Kafka
- Missing `workflow.step.execute` = Worker connected but not processing

#### 4. Check Logs in Loki
In Grafana, go to: **Explore** → Select "Loki" datasource

**Query examples:**
```logql
# All backend errors
{job="easyflow-backend"} |= "ERROR"

# Workflow execution errors
{job="easyflow-backend"} |= "Workflow marked as completed but no steps executed"

# Kafka connection errors
{job="easyflow-automation"} |= "kafka" |= "error"

# Trace a specific execution
{job="easyflow-backend"} |= "execution_id" |= "318b436c-51dd-40da-ab23-e7af7ab75438"
```

**What to look for:**
```json
{
  "msg": "❌ Workflow marked as completed but no steps executed",
  "trace": {
    "traceId": "bb1a1d6a689ba82b693ec04794a0c102",
    "userId": "1196aa93-a166-43f7-8d21-16676a82436e"
  },
  "error": {
    "workflow_id": "57b50ac6-81bf-415a-9816-34d170348e37",
    "steps_total": 2,
    "steps_executed": 0
  }
}
```

Then search automation worker logs for that `traceId`:
```logql
{job="easyflow-automation"} |= "bb1a1d6a689ba82b693ec04794a0c102"
```

**If no results found** → Trace context isn't propagating to the worker.

### Troubleshooting: Trace ID Not Found in Automation Logs

**Problem:** You found a trace ID in backend logs but it doesn't appear in automation worker logs.

**⚠️ IMPORTANT: Two Possible Causes**

#### Cause 1: Backend Never Dispatched a Job (Most Common)
**What's happening:**
- Backend receives workflow execution request ✅
- Backend evaluates workflow steps ✅
- **Backend decides there are NO steps to run** ❌
- Backend marks workflow as `NO_STEPS_EXECUTED` ❌
- **Backend NEVER sends anything to Kafka** ❌
- Worker is never contacted, so no trace ID in worker logs ✅ (This is expected!)

**This is NOT a trace propagation issue** - it's a workflow logic issue.

**How to Debug This:**
1. **Check backend logs** for why steps weren't executed:
   ```logql
   {job="easyflow-backend"} |= "NO_STEPS_EXECUTED" |= "steps_total"
   ```

2. **Add a debug/logging step** to force the backend to dispatch at least one job:
   - Create a simple "logger" step that does nothing but print its input
   - Add it as the first step in your workflow
   - This forces the orchestrator to dispatch at least one job to Kafka
   - You'll then see the trace ID in worker logs

#### Cause 2: Trace Context Not Propagating (Less Common)
**What's happening:**
- Backend created a trace ✅
- Backend published message to Kafka ✅
- **But**: Trace context (trace ID, span ID) wasn't included in Kafka message headers ❌

**How to verify:**
```bash
# Check Kafka topic for recent messages
docker exec -it easy-flow-kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic automation-tasks \
  --from-beginning \
  --max-messages 1 \
  --property print.headers=true
```

**Look for headers like:**
```
__headers__: traceparent=00-<trace-id>-<span-id>-01
```

**If headers are missing:**
- Backend isn't injecting trace context into Kafka messages
- Check: `rpa-system/backend/utils/kafkaService.js`

### Debugging: Force a Step to Execute

**If the backend never dispatches jobs**, add a debug/logging step to force execution:

**Example Debug Step Configuration:**
```json
{
  "step_type": "action",
  "action_type": "delay",
  "name": "Debug: Force Execution",
  "config": {
    "duration_ms": 100
  }
}
```

This simple delay step will:
- Force backend to dispatch a job to Kafka ✅
- Include trace context in Kafka headers ✅
- Worker receives job and logs trace ID ✅
- You can now see the full execution flow ✅

**Action Plan: Debugging NO_STEPS_EXECUTED**

#### Step 1: Add Debug Step
Add a logging step to the very beginning of your workflow (immediately after the "Start" step).

**Via UI:**
1. Open workflow in Workflow Builder: http://localhost:3000/workflows/:id
2. Add a Delay step as the first action
3. Set name: "Debug: Log Workflow Input"
4. Set duration: 100ms (minimal)
5. Connect: Start → Debug: Log Workflow Input → Your original first step
6. Save the workflow

#### Step 2: Trigger the Workflow
Execute the workflow and note the `execution_id` from the response.

#### Step 3: Check the Worker Logs
1. **Get trace ID from backend logs:**
   ```logql
   {job="easyflow-backend"} |= "execution_id" |= "<your-execution-id>"
   ```
   Copy the `traceId` from the log

2. **Search automation worker logs for the same trace ID:**
   ```logql
   {job="easyflow-automation"} |= "<trace-id>"
   ```

3. **You should now see logs like:**
   ```
   📨 Received Kafka task: <task-id> (type: delay, trace_id: <trace-id>)
   Processing task <task-id> of type delay
   ```

#### Step 4: Analyze the Logged Output
Check the task payload in worker logs:
```logql
{job="easyflow-automation"} |= "task_id" |= "<task-id>"
```

**Look for:**
- `input_data` - What data was passed to the workflow
- `workflow_id` - Confirms correct workflow
- `execution_id` - Links to backend execution
- `user_id` - User context

**Common Issues:**
- **Missing parameters:** A parameter used in a condition (`when:` clause) is missing
- **Unexpected values:** Parameter exists but has wrong type or value
- **Empty input_data:** `input_data: {}` when workflow expects specific fields
- **Condition evaluation:** Check if conditions are filtering out steps

#### Step 5: Check Tempo for Complete Trace
In Grafana Explore → Tempo datasource:
```
{service.name="rpa-system-backend"} && name=~"workflow.execute.*"
```

**If trace shows backend span but no worker span:**
- Worker isn't creating spans
- Worker isn't extracting trace context from Kafka
- Worker spans aren't being exported to Tempo

**If trace shows both backend and worker spans:**
- Trace context IS propagating ✅
- Issue is only in logging (worker not logging trace ID)

---

## 📊 Key Dashboards

### 1. Workflow Execution Observability
**URL:** http://localhost:3001/d/workflow-execution

**Panels:**
- **Execution Rate** - Workflows per minute
- **P95 Duration** - 95th percentile execution time
- **Execution Duration Over Time** - Scatter plot of all executions
- **Trace View** - Parent-child span relationships

**Use this when:** You want to see why workflows are failing or slow.

### 2. Backend Metrics Dashboard
**URL:** http://localhost:3001/d/backend-metrics

**Panels:**
- **HTTP Request Rate** - Requests per second
- **Error Rate** - % of failed requests
- **Latency Heatmap** - Distribution of response times
- **Memory Usage** - Node.js heap size
- **CPU Usage** - Process CPU percentage

**Use this when:** Backend seems slow or unresponsive.

---

## 🔧 Common Queries

### Prometheus (http://localhost:9090)

```promql
# Service availability (should all be 1)
up

# Workflow success rate
rate(workflow_execution_total{status="success"}[5m]) / 
rate(workflow_execution_total[5m])

# P95 workflow duration
histogram_quantile(0.95, 
  rate(workflow_execution_duration_seconds_bucket[5m]))

# HTTP request latency by endpoint
http_request_duration_seconds{path="/execute"}

# Memory leak detection (should be stable, not growing)
nodejs_heap_size_used_bytes
```

### Loki (Grafana Explore)

**⚠️ Important:** Loki queries require at least one label matcher.

**Available Labels:**
- `job` - easyflow-backend, easyflow-frontend, easyflow-automation, easyflow-backend-errors, easyflow-frontend-errors
- `service` - rpa-system-backend, rpa-system-frontend, automation-worker
- `level` - info, error, warn, debug (extracted from JSON logs)
- `logger` - logger name (extracted from JSON logs)
- `environment` - development

**Common Queries:**

```logql
# All backend logs
{job="easyflow-backend"}

# Backend errors only
{job="easyflow-backend", level="error"}

# Search for specific text in backend logs
{job="easyflow-backend"} |= "workflow"

# All errors across all services
{level="error"}

# Workflow execution flow for a specific user
{job=~"easyflow-.*"} 
  |= "userId" 
  |= "1196aa93-a166-43f7-8d21-16676a82436e"

# Kafka connection issues
{job="easyflow-automation"} 
  |= "kafka" 
  |~ "error|failed|timeout"

# Search for execution IDs
{job="easyflow-backend"} |= "execution_id"

# Search for trace IDs
{job="easyflow-backend"} |= "trace_id"

# Frontend logs
{job="easyflow-frontend"}

# Automation worker logs
{job="easyflow-automation"}
```

**LogQL Operators:**
- `|= "text"` - Contains text (case-sensitive)
- `!= "text"` - Does not contain text
- `|~ "regex"` - Matches regex
- `!~ "regex"` - Does not match regex

**Using in Grafana Explore:**
1. Select **Loki** datasource
2. Add a label filter: `{job="easyflow-backend"}`
3. Add text search (optional): `|= "your search term"`
4. Click **Run query** or press Shift+Enter

**Quick Start Queries:**
- See all backend logs: `{job="easyflow-backend"}`
- See all errors: `{level="error"}`
- Search for workflow executions: `{job="easyflow-backend"} |= "workflow"`
- See recent errors with trace context: `{level="error"} |= "trace_id"`

---

## 📝 Integrated Logs

All application logs are automatically collected and shipped to Loki via Promtail.

### Application Logs (via Promtail)

| Log Source | File Path | Job Name | Labels | Status |
|------------|-----------|----------|--------|--------|
| **Backend** | `logs/backend.log` | `easyflow-backend` | `service=rpa-system-backend`, `level`, `logger` | ✅ Integrated |
| **Backend Errors** | `logs/backend-error.log` | `easyflow-backend-errors` | `service=rpa-system-backend`, `log_level=error` | ✅ Integrated |
| **Frontend** | `logs/frontend.log` | `easyflow-frontend` | `service=rpa-system-frontend` | ✅ Integrated |
| **Frontend Errors** | `logs/frontend-error.log` | `easyflow-frontend-errors` | `service=rpa-system-frontend`, `log_level=error` | ✅ Integrated |
| **Automation Worker** | `logs/automation-worker.log` | `easyflow-automation` | `service=automation-worker` | ✅ Integrated |

### Log Collection Details

**Backend Logs:**
- Format: JSON (structured logging via Pino)
- Fields extracted: `level`, `msg`, `time`, `service`, `logger`, `trace_id`, `span_id`, `user_id`, `method`, `path`, `execution_id`, `workflow_id`
- Labels: `level`, `service`, `logger` (for filtering)

**Frontend Logs:**
- Format: Plain text (React app console output)
- Captured via PM2 stdout/stderr redirection

**Automation Worker Logs:**
- Format: Plain text with timestamp prefix
- Pattern: `YYYY-MM-DD HH:mm:ss: <message>`
- Extracts timestamp and content

### Verifying Log Integration

**Check if logs are flowing to Loki:**
```bash
# List all available jobs
curl http://localhost:3100/loki/api/v1/label/job/values

# Query recent logs
curl "http://localhost:3100/loki/api/v1/query_range?query={job=\"easyflow-backend\"}&limit=10&start=$(date -u -v-1H +%s)000000000&end=$(date -u +%s)000000000"
```

**In Grafana Explore:**
1. Select "Loki" datasource
2. Use label browser to see available jobs
3. Query: `{job="easyflow-backend"}`

**Check Promtail is shipping logs:**
```bash
# Check Promtail logs
docker logs easyflow-promtail --tail 50

# Look for "Adding target" messages
docker logs easyflow-promtail | grep "Adding target"
```

**Expected output:**
```
level=info msg="Adding target" key="/app/logs/backend*.log:{...}"
level=info msg="Adding target" key="/app/logs/frontend*.log:{...}"
level=info msg="Adding target" key="/app/logs/automation-worker*.log:{...}"
```

---

## ✅ System Health Checklist

Use this to verify everything is working:

### 1. Infrastructure
- [ ] `docker ps` shows all containers running (prometheus, grafana, loki, promtail, tempo, otel-collector, alertmanager)
- [ ] `http://localhost:9090/targets` - all targets UP
- [ ] `http://localhost:3001` - Grafana loads (login: admin/admin123)
- [ ] `http://localhost:9091/metrics` - Backend metrics available
- [ ] `http://localhost:3100/ready` - Loki is ready
- [ ] `http://localhost:9080/ready` - Promtail is ready

### 2. Application
- [ ] `http://localhost:3000` - Frontend loads
- [ ] `http://localhost:3030/health` - Backend healthy
- [ ] `http://localhost:7070/health` - Worker healthy

### 3. Messaging
- [ ] Kafka topic exists: `docker exec easy-flow-kafka-1 kafka-topics --list`
- [ ] Worker has partition assigned: Check `logs/automation-worker.log`

### 4. Observability
- [ ] Metrics flowing: Query `up` in Prometheus (http://localhost:9090)
- [ ] Logs flowing: Query `{job=~".+"}` in Grafana Explore → Loki datasource
- [ ] Traces flowing: Check "Workflow Execution Observability" dashboard in Grafana
- [ ] Promtail shipping logs: Check `docker logs easyflow-promtail` for "Adding target" messages

### 5. End-to-End
- [ ] Create workflow in UI
- [ ] Execute workflow
- [ ] Check execution appears in dashboard
- [ ] Check trace shows all spans (backend → kafka → worker → steps)
- [ ] Check logs show execution lifecycle

---

## 🔗 Quick Access Links

### Observability Services
- **Grafana Dashboards:** http://localhost:3001 (admin/admin123)
- **Prometheus UI:** http://localhost:9090
- **Loki API:** http://localhost:3100
- **Promtail Status:** http://localhost:9080/ready
- **Tempo API:** http://localhost:3200
- **OTEL Collector Health:** http://localhost:13133
- **Alertmanager UI:** http://localhost:9093
- **Backend Metrics:** http://localhost:9091/metrics

### Application Services
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3030
- **Backend Health:** http://localhost:3030/health
- **Automation Worker:** http://localhost:7070
- **Worker Health:** http://localhost:7070/health

### Infrastructure
- **Kafka:** localhost:9092
- **Zookeeper:** localhost:2181

---

**Last Updated:** 2025-12-16  
**Version:** 1.3.0
