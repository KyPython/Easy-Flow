# EasyFlow Observability System - Complete Guide

**📌 Single Source of Truth for Monitoring & Debugging**

---

## 🎯 What Is This System For?

Your observability stack gives you **three superpowers** to understand your application in real-time:

1. **📊 Metrics** - Numbers that change (performance, counts, rates)
2. **🔍 Traces** - Request paths through services (distributed tracing)
3. **📝 Logs** - Detailed event context (what happened and why)

**Think of it like this:**
- **Metrics** tell you there's a problem
- **Logs** tell you what the problem is
- **Traces** tell you where the problem is happening

---

## 🚀 Quick Start

### Starting the System
```bash
./start-dev.sh
```

This **ONE COMMAND** starts everything:
- ✅ Kafka & Zookeeper (message broker)
- ✅ Backend API (Node.js on port 3030)
- ✅ Frontend (React on port 3000)
- ✅ Automation Worker (Python on port 7070)
- ✅ **Prometheus** (metrics - port 9090)
- ✅ **Grafana** (dashboards - port 3001, login: admin/admin123)
- ✅ **Loki** (log aggregation - port 3100)
- ✅ **Promtail** (log collector - port 9080, ships logs to Loki)
- ✅ **Tempo** (distributed tracing - port 3200)
- ✅ **OTEL Collector** (telemetry ingestion - ports 4317/4318)
- ✅ **Alertmanager** (alerts - port 9093)
- ✅ **Backend Metrics** (Prometheus endpoint - port 9091)

### Stopping the System
```bash
./stop-dev.sh
```

Stops **everything** including observability stack, verifies ports are free.

---

## 🔍 Troubleshooting Workflows (Your Current Issue)

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

**Note:** OTEL Collector metrics endpoint (localhost:8889) may not be available if the collector is not running or configured.

If backend shows "DOWN", metrics aren't being exported properly. Check:
- Backend is running: `pm2 list`
- Metrics endpoint accessible: `curl http://localhost:9091/metrics`
- Prometheus can reach backend: Check network connectivity

#### 3. Query Workflow Traces in Grafana
Open: http://localhost:3001
- **Login:** admin / admin123

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

**What to look for in your case:**
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

**If no results found** → Trace context isn't propagating to the worker. This means the trace ID isn't being passed through Kafka headers.

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

**This is NOT a trace propagation issue** - it's a workflow logic issue. The backend orchestrator (`rpa-system-backend`) decides there are no steps to execute BEFORE dispatching any jobs to the automation worker.

**How to Debug This:**
1. **Check backend logs** for why steps weren't executed:
   ```logql
   {job="easyflow-backend"} |= "NO_STEPS_EXECUTED" |= "steps_total"
   ```
   Look for logs showing `steps_total: 2, steps_executed: 0`

2. **Add a debug/logging step** to force the backend to dispatch at least one job:
   - Create a simple "logger" step that does nothing but print its input
   - Add it as the first step in your workflow
   - This forces the orchestrator to dispatch at least one job to Kafka
   - You'll then see the trace ID in worker logs

3. **Check workflow configuration**:
   - Are workflow steps properly defined?
   - Are step conditions preventing execution?
   - Is the workflow in a valid state?

#### Cause 2: Trace Context Not Propagating (Less Common)
**What's happening:**
- Backend created a trace ✅
- Backend published message to Kafka ✅
- **But**: Trace context (trace ID, span ID) wasn't included in Kafka message headers ❌
- Worker can't correlate its logs with the backend trace ❌

**Step-by-Step Fix:**

#### 1. Verify Kafka Message Headers
Check if trace context is in Kafka headers:
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
- Check: `rpa-system/backend/utils/kafkaService.js` - should use OpenTelemetry propagation

#### 2. Check Backend Kafka Producer Code
Verify backend is using OpenTelemetry context propagation:

```javascript
// ✅ CORRECT - Uses OpenTelemetry propagation
const { propagation, context } = require('@opentelemetry/api');
const headers = {};
propagation.inject(context.active(), headers);
await producer.send({
  topic: 'automation-tasks',
  messages: [{
    value: JSON.stringify(message),
    headers: headers  // ← Trace context in headers
  }]
});

// ❌ WRONG - No trace context
await producer.send({
  topic: 'automation-tasks',
  messages: [{ value: JSON.stringify(message) }]  // ← Missing headers
});
```

#### 3. Check Automation Worker Consumer Code
Verify worker extracts trace context from Kafka headers:

```python
# ✅ CORRECT - Extracts trace context
from opentelemetry import trace, propagation
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

propagator = TraceContextTextMapPropagator()
headers = {k: v for k, v in message.headers}  # Convert Kafka headers to dict
ctx = propagator.extract(headers)  # Extract trace context

with trace.use_span(trace.get_tracer(__name__).start_span("workflow.execute", context=ctx)):
    # Worker code here - will inherit trace context
    logger.info("Processing workflow", extra={"trace_id": trace.get_current_span().get_span_context().trace_id})
```

#### 4. Debugging: Force a Step to Execute

**If the backend never dispatches jobs**, add a debug/logging step to force execution:

**Why This Happens:**
The backend orchestrator (`rpa-system-backend`) evaluates workflow steps BEFORE dispatching any jobs to Kafka. If it decides there are no valid steps to execute (e.g., no "start" step, all steps filtered out by conditions, or workflow configuration issues), it marks the workflow as `NO_STEPS_EXECUTED` and **never sends anything to Kafka**. This is why you won't see trace IDs in automation worker logs - the worker was never contacted.

**Create a Simple Logger Step:**

1. **Check your workflow configuration:**
   ```logql
   {job="easyflow-backend"} |= "No start step found" |= "workflow_id"
   ```
   Or:
   ```logql
   {job="easyflow-backend"} |= "steps_total" |= "steps_executed: 0"
   ```

2. **Add a debug step as the first action step:**
   - In your workflow editor, add a new step
   - Set step type to `action`
   - Set action type to something simple like `log` or `delay`
   - This forces the backend to dispatch at least one job to Kafka
   - You'll then see the trace ID in worker logs

3. **Or check workflow structure:**
   ```bash
   # Check if workflow has a start step
   # Check if workflow has action steps
   # Check if step conditions are preventing execution
   ```

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

### 2. Modify Your Workflow to Run the Logger First

**Option A: Using the UI (Recommended)**

1. **Open your workflow** in the Workflow Builder (http://localhost:3000/workflows/:id)
2. **Add a new step:**
   - Click the "+" button or drag an action from the toolbar
   - Select "Delay" action (or any simple action)
3. **Configure the debug step:**
   - Set name: "Debug: Log Workflow Input"
   - For delay: Set duration to 100ms (minimal delay)
   - For other actions: Use minimal configuration
4. **Connect it as the first step:**
   - Connect the "Start" step → "Debug: Log Workflow Input" step
   - Connect "Debug: Log Workflow Input" → your original first step
5. **Save the workflow**
6. **Execute the workflow** - the debug step will force backend to dispatch to Kafka

**Option B: Direct Database Modification (Advanced)**

If you need to modify the workflow directly in the database:

1. **Find your workflow ID:**
   ```sql
   SELECT id, name FROM workflows WHERE name LIKE '%your-workflow-name%';
   ```

2. **Check current workflow structure:**
   ```sql
   SELECT id, step_type, action_type, name, config 
   FROM workflow_steps 
   WHERE workflow_id = '<your-workflow-id>'
   ORDER BY position_y, position_x;
   ```

3. **Insert a debug step:**
   ```sql
   INSERT INTO workflow_steps (
     workflow_id,
     step_type,
     action_type,
     name,
     step_key,
     config,
     position_x,
     position_y
   ) VALUES (
     '<your-workflow-id>',
     'action',
     'delay',
     'Debug: Log Workflow Input',
     'debug-logger-' || gen_random_uuid()::text,
     '{"duration_ms": 100}'::jsonb,
     200,  -- Position after Start step
     100
   ) RETURNING id;
   ```

4. **Update workflow connections:**
   ```sql
   -- Get the Start step ID
   SELECT id INTO start_step_id FROM workflow_steps 
   WHERE workflow_id = '<your-workflow-id>' AND step_type = 'start';
   
   -- Get the debug step ID (from INSERT above)
   -- Get the original first action step ID
   SELECT id INTO first_action_id FROM workflow_steps 
   WHERE workflow_id = '<your-workflow-id>' 
     AND step_type = 'action' 
     AND name != 'Debug: Log Workflow Input'
   ORDER BY position_y, position_x LIMIT 1;
   
   -- Connect Start → Debug step
   INSERT INTO workflow_connections (
     workflow_id,
     source_step_id,
     target_step_id,
     connection_type
   ) VALUES (
     '<your-workflow-id>',
     start_step_id,
     '<debug-step-id>',
     'next'
   );
   
   -- Connect Debug → Original first step
   INSERT INTO workflow_connections (
     workflow_id,
     source_step_id,
     target_step_id,
     connection_type
   ) VALUES (
     '<your-workflow-id>',
     '<debug-step-id>',
     first_action_id,
     'next'
   );
   
   -- Remove old Start → Original first step connection
   DELETE FROM workflow_connections
   WHERE workflow_id = '<your-workflow-id>'
     AND source_step_id = start_step_id
     AND target_step_id = first_action_id;
   ```

5. **Update canvas_config** (if workflow uses canvas):
   ```sql
   -- Get current canvas_config
   SELECT canvas_config FROM workflows WHERE id = '<your-workflow-id>';
   
   -- Add debug node to canvas_config.nodes array
   -- Add edges to canvas_config.edges array
   -- Update workflows table
   UPDATE workflows 
   SET canvas_config = '<updated-canvas-config>'::jsonb
   WHERE id = '<your-workflow-id>';
   ```

**Option C: Using API (Programmatic)**

```bash
# Get workflow details
curl http://localhost:3030/api/workflows/<workflow-id>

# Add debug step via API (if endpoint exists)
# Or use Supabase client directly in your code
```

**After Adding Debug Step:**

1. **Execute the workflow** via UI or API
2. **Check backend logs** for trace ID:
   ```logql
   {job="easyflow-backend"} |= "execution_id" |= "<your-execution-id>"
   ```
3. **Check automation worker logs** - you should now see the trace ID:
   ```logql
   {job="easyflow-automation"} |= "<trace-id>"
   ```
4. **Verify in Kafka** that message was sent:
   ```bash
   docker exec -it easy-flow-kafka-1 kafka-console-consumer \
     --bootstrap-server localhost:9092 \
     --topic automation-tasks \
     --from-beginning \
     --max-messages 1 \
     --property print.headers=true
   ```

#### 5. Verify Trace Context Propagation
After fixing code or adding debug step, test end-to-end:

1. **Execute a workflow** via frontend
2. **Get trace ID from backend logs:**
   ```logql
   {job="easyflow-backend"} |= "execution_id" |= "<your-execution-id>"
   ```
   Copy the `traceId` from the log

3. **Search automation logs for same trace ID:**
   ```logql
   {job="easyflow-automation"} |= "<trace-id>"
   ```

4. **If still not found:**
   - Check Kafka message headers (step 1)
   - Verify backend producer code (step 2)
   - Verify worker consumer code (step 3)
   - Check worker logs for Kafka connection errors

#### 5. Check Tempo for Complete Trace
Even if logs don't show trace ID, check Tempo for the trace:

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
- Check worker logging code to include trace context

#### 7. Common Issues and Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| **No Kafka headers** | Backend trace exists, worker trace doesn't | Add `propagation.inject()` in backend Kafka producer |
| **Worker not extracting** | Headers exist but worker doesn't use them | Add `propagation.extract()` in worker Kafka consumer |
| **Worker not logging trace ID** | Trace exists in Tempo but not in logs | Update worker logger to include trace context |
| **Kafka connection issues** | Worker can't connect to Kafka | Check Kafka is running, worker can reach Kafka |
| **Different trace IDs** | Backend and worker have different trace IDs | Ensure worker extracts context from Kafka headers, doesn't create new trace |

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

### 3. System Overview
**URL:** http://localhost:3001/d/system-overview

**Panels:**
- **Container CPU** - Docker container resource usage
- **Container Memory** - RAM usage per container
- **Network I/O** - Traffic in/out
- **Disk I/O** - Read/write operations

**Use this when:** Checking if infrastructure is the bottleneck.

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

# Kafka consumer lag
kafka_consumer_group_lag

# Memory leak detection (should be stable, not growing)
nodejs_heap_size_used_bytes
```

### Loki (Grafana Explore)

**⚠️ Important:** Loki queries require at least one label matcher. You cannot use empty queries or wildcards like `.*` without a label.

**Available Labels:**
- `job` - easyflow-backend, easyflow-frontend, easyflow-automation, easyflow-backend-errors, easyflow-frontend-errors
- `service` - rpa-system-backend, rpa-system-frontend, automation-worker
- `level` - info, error, warn, debug (extracted from JSON logs)
- `logger` - logger name (extracted from JSON logs)
- `environment` - development

**Basic Query Structure:**
```
{label="value"}
```

**Common Queries:**

```logql
# All backend logs
{job="easyflow-backend"}

# Backend errors only
{job="easyflow-backend", level="error"}
# or
{job="easyflow-backend-errors"}

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

# Backend database query performance
{job="easyflow-backend"} 
  |= "query_duration_ms" 
  | json 
  | query_duration_ms > 1000

# Trace context propagation check
{job=~"easyflow-.*"} 
  | json 
  | traceId != ""

# Search for execution IDs
{job="easyflow-backend"} |= "execution_id"

# Search for trace IDs
{job="easyflow-backend"} |= "trace_id"

# Frontend logs
{job="easyflow-frontend"}

# Automation worker logs
{job="easyflow-automation"}

# Filter by service
{service="rpa-system-backend"}
```

**LogQL Operators:**
- `|= "text"` - Contains text (case-sensitive)
- `!= "text"` - Does not contain text
- `|~ "regex"` - Matches regex
- `!~ "regex"` - Does not match regex

**Examples with Text Search:**
```logql
# Multiple text filters
{job="easyflow-backend"} |= "workflow" |= "execution"

# Regex search
{job="easyflow-backend"} |~ "error|exception|failed"

# Exclude certain text
{level="error"} != "timeout"
```

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

## 🏗️ Architecture

### Data Flow

```
┌─────────────┐
│  Frontend   │ (React)
│  Port 3000  │
└──────┬──────┘
       │ HTTP Requests
       ↓
┌──────────────┐      ┌──────────────┐
│   Backend    │─────→│    Kafka     │
│  Port 3030   │      │  Port 9092   │
│              │←─────│              │
│ /metrics     │      └──────┬───────┘
│  Port 9091   │             │
└──────┬───────┘             │ automation-tasks topic
       │                     ↓
       │              ┌──────────────┐
       │              │  Automation  │
       │              │   Worker     │
       │              │  Port 7070   │
       │              └──────────────┘
       │
       │ Telemetry Data (OpenTelemetry Protocol)
       ↓
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ OTEL         │─────→│  Prometheus  │      │    Tempo     │
│ Collector    │      │  Port 9090   │      │  Port 3200   │
│ 4317/4318    │      │              │      │   (traces)   │
└──────┬───────┘      └──────┬───────┘      └──────────────┘
       │                     │
       │ Logs                │ Metrics
       ↓                     ↓
┌──────────────┐      ┌──────────────┐
│    Loki      │←─────│  Promtail    │
│  Port 3100   │      │  Port 9080   │
└──────┬───────┘      └──────────────┘
       │                     ↑
       │                     │ Reads logs from
       │                     │ /Users/ky/Easy-Flow/logs/
       │                     │ (mounted as /app/logs in container)
       │
       └─────────────┬───────┘
                     │
                     ↓
              ┌──────────────┐
              │   Grafana    │
              │  Port 3001   │
              │  (Dashboards)│
              └──────────────┘
```

### What Each Component Does

| Component | Port | Purpose | When You Need It |
|-----------|------|---------|------------------|
| **Prometheus** | 9090 | Stores time-series metrics | Check performance trends |
| **Grafana** | 3001 | Visualizes everything | See dashboards, query logs/traces (login: admin/admin123) |
| **Loki** | 3100 | Stores logs | Debug errors, search events |
| **Promtail** | 9080 | Collects logs from files | Automatic (always running, ships logs to Loki) |
| **Tempo** | 3200 | Stores distributed traces | See request flow through services |
| **OTEL Collector** | 4317/4318 | Receives telemetry data | Automatic (middleware between app & storage) |
| **Alertmanager** | 9093 | Routes alerts | Get notified of issues (future use) |
| **Backend Metrics** | 9091 | Prometheus metrics endpoint | Direct metrics access (scraped by Prometheus) |

---

## 📝 Logging Best Practices

### All logs MUST follow this structure:

```javascript
// ✅ GOOD - Structured logging with trace context
logger.error('Workflow execution failed', {
  error: {
    execution_id: executionId,
    workflow_id: workflowId,
    error_category: 'NO_STEPS_EXECUTED',
    steps_total: workflow.steps.length,
    steps_executed: 0
  },
  trace: {
    traceId: req.traceId,
    spanId: req.spanId,
    userId: req.user.id
  },
  business: {
    workflow_name: workflow.name,
    user_email: req.user.email
  }
});

// ❌ BAD - Console.log with no context
console.log('Workflow failed');

// ❌ BAD - Missing trace context
logger.error('Workflow failed', { workflowId });
```

### Why This Matters

**With proper logging:**
1. User sees: "Workflow execution failed. Please try again."
2. You search Loki for `execution_id` → find the error log
3. Copy the `traceId` → search Tempo for that trace
4. See the entire request flow and which step failed

**Without proper logging:**
1. User sees: "Workflow execution failed."
2. You search logs → 100 generic "Workflow failed" messages
3. No way to find the specific failure
4. Hours of debugging

---

## 🎓 Understanding the "No Steps Executed" Issue

### The Problem

Your logs show:
```json
{
  "msg": "❌ Workflow marked as completed but no steps executed",
  "error": {
    "steps_total": 2,
    "steps_executed": 0
  }
}
```

### The Flow (What SHOULD Happen)

1. **Frontend** sends POST `/execute` with `workflow_id`
2. **Backend** receives request, creates `execution_id` in database
3. **Backend** publishes Kafka message to `automation-tasks` topic:
   ```json
   {
     "execution_id": "318b436c-51dd-40da-ab23-e7af7ab75438",
     "workflow_id": "57b50ac6-81bf-415a-9816-34d170348e37",
     "user_id": "1196aa93-a166-43f7-8d21-16676a82436e",
     "steps": [...]
   }
   ```
4. **Automation Worker** (Python) consumes message from Kafka
5. **Worker** processes each step, updates execution status in database
6. **Backend** polls database, sees steps completed, returns success

### What's Happening (The Bug)

Based on your logs:
1. ✅ Frontend sends request
2. ✅ Backend receives request, creates execution record
3. ✅ Backend publishes to Kafka (you'd see Kafka errors otherwise)
4. ❌ **Worker isn't consuming the message**
5. ⏱️ Backend timeout (5 seconds), marks execution as failed
6. ❌ Frontend shows "Workflow execution failed"

### Why Worker Isn't Consuming

From your logs:
```
[automation:err] kafka.coordinator - INFO - Successfully joined group automation-workers
[automation:err] kafka.consumer.subscription_state - INFO - Updated partition assignment: []
```

**The partition assignment is empty!** This means:
- Worker connected to Kafka ✅
- Worker joined consumer group ✅
- **But**: No partitions were assigned to this consumer ❌

**Root cause:** Kafka topic `automation-tasks` either:
1. Doesn't exist yet
2. Exists but has no partitions
3. Has partitions but they're assigned to a different consumer group member

### How to Fix It

```bash
# 1. Check if topic exists
docker exec -it easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --list

# 2. Describe the topic
docker exec -it easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --describe --topic automation-tasks

# Expected output:
# Topic: automation-tasks    PartitionCount: 1    ReplicationFactor: 1

# 3. If topic doesn't exist, create it
docker exec -it easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --create --topic automation-tasks --partitions 1 --replication-factor 1

# 4. Check consumer group
docker exec -it easy-flow-kafka-1 kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group automation-workers

# Expected output shows partitions assigned to consumers
```

### Verifying the Fix

After creating the topic, check worker logs:
```bash
tail -f logs/automation-worker.log
```

You should see:
```
Updated partition assignment: [TopicPartition(topic='automation-tasks', partition=0)]
Setting newly assigned partitions {TopicPartition...} for group automation-workers
```

Then run a workflow and check Loki:
```logql
{job="easyflow-automation"} |= "Processing workflow execution"
```

---

## 🚨 Consumer-Friendly Error Messages

### Current vs. Improved

| Current (Developer Message) | Improved (Consumer Message) | When to Show Details |
|-----------------------------|------------------------------|----------------------|
| "Workflow completed but no steps executed. Check if Kafka and the automation worker are running." | "Workflow failed to start. Our system is having trouble processing automations right now. Please try again in a few minutes." | Never show to consumers |
| "apiTracker.addAttribute is not a function" | "Something went wrong loading your workflows. Please refresh the page." | Never show to consumers |
| "Query timeout" | "Taking longer than expected. Please refresh the page." | Never show to consumers |

### Implementation

In `/rpa-system/backend/src/middleware/errorHandler.js`:

```javascript
// Consumer-friendly error messages
const CONSUMER_FRIENDLY_ERRORS = {
  'NO_STEPS_EXECUTED': {
    message: 'Your workflow failed to start. Please try again.',
    userAction: 'If this persists, contact support.',
    statusCode: 500
  },
  'KAFKA_CONNECTION_ERROR': {
    message: 'Service temporarily unavailable. Please try again in a moment.',
    userAction: 'Check our status page for updates.',
    statusCode: 503
  },
  'DATABASE_TIMEOUT': {
    message: 'Request timed out. Please try again.',
    userAction: null,
    statusCode: 504
  }
};

// Return consumer message in API response
res.status(error.statusCode).json({
  error: CONSUMER_FRIENDLY_ERRORS[error.category].message,
  action: CONSUMER_FRIENDLY_ERRORS[error.category].userAction,
  executionId: error.execution_id // For support tickets
});

// But log full technical details
logger.error('Workflow execution failed', {
  error: {
    category: 'NO_STEPS_EXECUTED',
    execution_id: executionId,
    kafka_status: 'disconnected',
    worker_status: 'no_partitions_assigned',
    // ... all technical details
  }
});
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

## 🆘 Getting Help

### Debug Checklist

When asking for help, include:

1. **Observability links:**
   - Grafana dashboard screenshot
   - Prometheus query results
   - Loki log snippet

2. **Identifiers:**
   - `execution_id` (from failed workflow)
   - `traceId` (from logs)
   - `workflow_id`

3. **Logs:**
   ```bash
   # Last 50 lines of each service
   tail -50 logs/backend.log
   tail -50 logs/automation-worker.log
   tail -50 logs/frontend.log
   ```

4. **System state:**
   ```bash
   docker ps
   docker exec easy-flow-kafka-1 kafka-topics --list
   docker exec easy-flow-kafka-1 kafka-consumer-groups --list
   ```

---

## 📚 Additional Resources

- **OpenTelemetry Docs:** https://opentelemetry.io/docs/
- **Prometheus Query Language:** https://prometheus.io/docs/prometheus/latest/querying/basics/
- **LogQL (Loki Queries):** https://grafana.com/docs/loki/latest/logql/
- **TraceQL (Tempo Queries):** https://grafana.com/docs/tempo/latest/traceql/

---

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
**Version:** 1.1.0
