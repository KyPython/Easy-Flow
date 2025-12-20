# EasyFlow Observability & Development Guide

**📌 Your complete guide to developing, debugging, and maintaining EasyFlow**

---

## 🚀 Quick Start: Development Workflow

**Daily workflow:**
```bash
# 1. Start everything
./start-dev.sh

# 2. Make your changes, test manually

# 3. Before committing: Quick validation
npm run lint:test

# 4. Commit
git commit -m "feat(scope): what you did"

# 5. Before pushing: Full check
npm run test:all

# 6. Push
git push

# 7. Stop when done
./stop-dev.sh
```

**See [Development Workflow](../development/DEVELOPMENT_WORKFLOW.md) for complete workflow details.**

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

## Step 1: Start the Observability Stack

**Before you can debug, you need the observability stack running:**

**Start everything (recommended):**
```bash
./start-dev.sh
```
This starts your app (backend, frontend, automation worker) AND the observability stack (Grafana, Prometheus, Loki, Tempo, OTEL Collector).

**Stop everything:**
```bash
./stop-dev.sh
```

**Start only observability stack (if app is already running):**
```bash
docker compose -f rpa-system/docker-compose.monitoring.yml up -d
```

**Stop only observability stack:**
```bash
docker compose -f rpa-system/docker-compose.monitoring.yml down
```

**Verify observability stack is running:**
```bash
docker ps | grep -E "grafana|prometheus|loki|tempo|otel"
```

**Access URLs (after starting):**
- **Grafana:** http://localhost:3001 (admin/admin123)
- **Prometheus:** http://localhost:9090
- **Loki:** http://localhost:3100
- **Tempo:** http://localhost:3200
- **OTEL Collector:** http://localhost:4318 (HTTP) / 4317 (gRPC)

---

## Step 2: Verify Everything Is Running

**Quick Health Check:**

```bash
# Check all containers are running
docker ps | grep -E "grafana|prometheus|loki|promtail|tempo|otel"

# Check backend metrics are available
curl http://localhost:9091/metrics | head -5

# Check Grafana is ready
curl http://localhost:3001/api/health

# Check Loki is ready
curl http://localhost:3100/ready

# Check Promtail is ready
curl http://localhost:9080/ready
```

**In Grafana:**
1. Open http://localhost:3001 (login: admin/admin123)
2. Go to **Explore** → Select **Prometheus**
3. Query: `up` - Should show all services as `1` (UP)
4. Go to **Explore** → Select **Loki**
5. Query: `{job=~".+"}` - Should show recent logs
6. Go to **Explore** → Select **Tempo**
7. Query: `{resource.service.name="rpa-system-backend"}` - Should show traces (if you've made requests)

---

## Step 3: Understanding What You're Looking At

### Metrics (Prometheus)
**Where:** Grafana Explore → Prometheus datasource

**What they tell you:**
- How many requests per second
- How fast requests are (latency)
- Error rates
- Resource usage (CPU, memory)

**Example queries:**
```promql
# Service availability (should all be 1)
up

# HTTP request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Traces (Tempo)
**Where:** Grafana Explore → Tempo datasource

**What they tell you:**
- The complete path of a request through your system
- Which service/function is slow
- How services communicate (HTTP, Kafka, etc.)

**Example queries:**
```traceql
# All backend traces
{resource.service.name="rpa-system-backend"}

# Slow requests (>2 seconds)
{resource.service.name="rpa-system-backend"} && {duration>2s}

# Workflow execution traces
{resource.service.name="rpa-system-backend"} && {name=~".*workflow.*execute.*"}

# Find a specific trace by its ID (paste the ID directly)
244cab272c869a88c72f6c3c5fa75c79
```

### Logs (Loki)
**Where:** Grafana Explore → Loki datasource

**What they tell you:**
- Detailed error messages
- What data was processed
- Trace IDs for correlation

**Example queries:**
```logql
# All backend logs
{job="easyflow-backend"}

# Backend errors only
{job="easyflow-backend", level="error"}

# Search for specific text
{job="easyflow-backend"} |= "workflow"
```

---

## Step 4: Finding Your Workflow Execution

**Key Distinction:** Background tasks vs. Workflow Executions

- **Background tasks** (like cleanup jobs) have empty `trace: {}` fields - these are NOT workflow executions
- **Workflow executions** have `trace.traceId` populated - these are actual user requests/workflow runs

**To find your workflow execution:**

**1. In Grafana Explore → Tempo:**
```
{resource.service.name="rpa-system-backend"} && {name=~"workflow.execute.*"}
```
This shows only workflow execution traces, not background tasks.

**2. In Grafana Explore → Loki:**
```
{job="easyflow-backend"} | json | trace_id != ""
```
This filters out background tasks (which have empty trace_id) and shows only logs with trace IDs.

**3. Find logs for a specific trace:**
- Get trace ID from Tempo (click on a trace)
- In Loki, query: `{job="easyflow-backend"} | json | trace_id = "<trace-id>"`

**4. Find workflow by execution ID:**
```
{job="easyflow-backend"} | json | execution_id = "<your-execution-id>"
```

**5. Understanding the "No Steps Executed" Error:**

If you see `❌ Workflow marked as completed but no steps executed` in logs:

**Root Cause:** The workflow completes immediately after the start step because `getNextSteps()` returns an empty array. This happens when:
- No `workflow_connections` exist linking the start step to action steps
- Connections exist but target step IDs don't match any workflow steps
- Connection conditions don't match (e.g., `success` connection when `data.success === false`)

**Debugging Steps:**

1. **Check workflow connections in Loki:**
```
{job="easyflow-backend"} | json | msg =~ "Workflow structure before execution"
```
Look for `connections_from_start: 0` - this means no connections from start step.

2. **Check if connections exist but aren't matching:**
```
{job="easyflow-backend"} | json | msg =~ "No connections found from current step"
```
This shows which step has no outgoing connections.

3. **Verify workflow structure:**
```
{job="easyflow-backend"} | json | msg =~ "Workflow structure before execution" | json | all_connections
```
This shows all connections in the workflow.

**Fix:** Ensure your workflow canvas has edges connecting the start node to action nodes. The backend expects `workflow_connections` table entries with `source_step_id` and `target_step_id` matching the step UUIDs.

---

## Step 5: Debugging Common Problems

### Problem 1: "No data" or "0 series returned" in Tempo

**Step-by-step debugging:**

**1. Verify traces are being generated:**
```bash
tail -50 logs/backend.log | grep -i "telemetry\|otel\|trace"
```
Look for: `[server] ✅ OpenTelemetry initialized successfully`

**2. Check OTEL Collector is running:**
```bash
docker ps | grep otel-collector
docker logs easyflow-otel-collector --tail 50 | grep -i "trace\|span\|export"
```

**3. Check Tempo is running:**
```bash
docker ps | grep tempo
curl http://localhost:3200/api/search?limit=10
```

**4. Try the simplest query:**
```
{resource.service.name="rpa-system-backend"}
```

**5. Trigger a request and check immediately:**
- Make a request to your backend (e.g., load workflows page)
- Wait 10-15 seconds
- Set Grafana time range to "Last 5 minutes"
- Try query again

**Common fixes:**
- **Observability stack not running:** `./start-dev.sh`
- **Time range too narrow:** Expand to "Last 1 hour"
- **No requests made:** Make a request first, then query
- **OTEL Collector not exporting to Tempo:** 
  
  **The Problem:** If traces pipeline only exports to `debug`, traces are printed to console but never sent to Tempo.
  
  **The Fix:** Ensure config has `otlp/tempo` exporter and traces pipeline includes it:
  ```yaml
  exporters:
    otlp/tempo:
      endpoint: tempo:4317  # Docker resolves 'tempo' hostname to container IP
      tls:
        insecure: true       # Required for local development (no TLS)
  
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, spanmetrics, batch]
      exporters: [otlp/tempo, debug]  # Must include otlp/tempo!
  ```
  
  **Why this works:**
  - `otlp/tempo` exporter sends traces to Tempo via gRPC (port 4317)
  - Docker's internal networking resolves `tempo` hostname to the Tempo container
  - `insecure: true` allows HTTP communication without TLS (local dev only)
  - Traces flow: Backend → OTEL Collector → Tempo → Grafana
  
  **Apply fix:** Restart OTEL Collector: `docker restart easyflow-otel-collector` or restart stack: `./start-dev.sh`

---

### Problem 2: "Query timeout" Errors

**Symptom:** Frontend shows "Query timeout" when loading workflows, especially on first load. Refresh fixes it.

**Step-by-step debugging:**

**1. Check if it's a cold start issue:**
```bash
# Check backend logs for warm-up messages
tail -50 logs/backend.log | grep -i "DatabaseWarmup\|warm-up"
```
Should see: `[DatabaseWarmup] ✅ Database warm-up completed`

**2. Check database indexes:**
```sql
-- Run in Supabase SQL editor
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'workflows' 
ORDER BY indexname;
```
Should see indexes on `user_id`, `updated_at`, `status`.

**3. If indexes are missing, add them:**
Run migration: `rpa-system/backend/migrations/add_performance_indexes.sql`

**4. Verify query performance:**
```sql
EXPLAIN ANALYZE
SELECT * FROM workflows 
WHERE user_id = '<test-user-id>'
ORDER BY updated_at DESC;
```
Should show "Index Scan" (not "Seq Scan").

---

### Problem 3: Slow Save Operations

**Symptom:** Workflow save operations hang or take very long.

**Step-by-step debugging:**

**1. Trigger the slow save:**
- Open browser dev tools (F12) → Network tab
- Make a change in Workflow Builder
- Click "Save"
- Note the request time

**2. Find the trace in Grafana:**
- Open Grafana: http://localhost:3001
- Go to **Explore** → **Tempo**
- Query: `{resource.service.name="rpa-system-backend"} && {name=~".*workflows.*"} && {duration>2s}`
- Set time range to when you clicked "Save"
- Click on the trace

**3. Analyze the trace:**
Look for the **longest span**:
- **`db.query` or `db.update`** → Database is slow (check indexes)
- **`workflow.validate`** → Validation is slow (optimize or make async)
- **`workflow.save`** → Check child spans inside

**4. Check logs for context:**
In Grafana Explore → Loki:
```logql
{job="easyflow-backend"} |= "<trace-id-from-step-2>"
```

**5. Apply fixes:**
- **If database slow:** Add indexes, use batch operations
- **If validation slow:** Make async or cache results
- **If save logic slow:** Batch operations, move non-critical work to background

---

### Problem 4: "Workflow completed but no steps executed"

**Step-by-step debugging:**

**1. Check backend metrics:**
Open: http://localhost:9091/metrics
Look for: `workflow_step_execution_total` - Should be > 0

**2. Check Prometheus targets:**
Open: http://localhost:9090/targets
Verify: `easyflow-backend` shows "UP"

**3. Find the trace:**
In Grafana Explore → Tempo:
```
{resource.service.name="rpa-system-backend"} && {name=~".*workflow.*execute.*"}
```

**4. Check logs:**
In Grafana Explore → Loki:
```logql
# Find the execution error
{job="easyflow-backend"} |= "NO_STEPS_EXECUTED"

# Get the trace ID
{job="easyflow-backend"} |= "execution_id" |= "<your-execution-id>"

# Search worker logs for that trace ID
{job="easyflow-automation"} |= "<trace-id>"
```

**5. If trace ID not in worker logs:**
- **Most likely:** Backend never dispatched a job (workflow logic issue)
- **Less likely:** Trace context not propagating (check Kafka headers)

**6. Force a step to execute:**
Add a debug step (Delay 100ms) as the first step in your workflow to force backend to dispatch a job.

---

### Problem 5: Slow UI Rendering (Data Over-Fetching)

**Symptom:** API calls are fast (25ms), but UI feels sluggish. Browser dev tools show large response payloads.

**Step-by-step debugging:**

**1. Check Network tab:**
- Open browser dev tools → Network tab
- Load workflows/executions list
- Check response size - should be small (<100KB for list)

**2. Trace the query in Tempo:**
```
{resource.service.name="rpa-system-backend"} && {name=~".*executions.*"}
```

**3. Check what fields are being fetched:**
- Look at the trace spans
- Check if `input_data` and `output_data` are being fetched for list views
- These should only be fetched for detail views

**4. Verify optimization:**
- List queries should exclude large JSON fields
- Detail queries should fetch full data on-demand

---

## Step 5: Using the Tools Effectively

### Grafana Dashboards

**Workflow Execution Observability:**
- **URL:** http://localhost:3001/d/workflow-execution
- **Use when:** You want to see why workflows are failing or slow
- **Shows:** Execution rate, P95 duration, traces

**Backend Metrics Dashboard:**
- **URL:** http://localhost:3001/d/backend-metrics
- **Use when:** Backend seems slow or unresponsive
- **Shows:** HTTP request rate, error rate, latency heatmap, memory/CPU

### Common Queries Reference

**Tempo (Traces):**
```
# All backend traces
{resource.service.name="rpa-system-backend"}

# Workflow execution traces (most important for debugging workflows)
{resource.service.name="rpa-system-backend"} && {name=~"workflow.execute.*"}

# Slow workflow executions (>2 seconds)
{resource.service.name="rpa-system-backend"} && {name=~"workflow.execute.*"} && {duration>2s}

# Workflow saves/updates
{resource.service.name="rpa-system-backend"} && {name=~".*workflows.*"}

# Execution detail queries
{resource.service.name="rpa-system-backend"} && {name=~".*executions.*"}

# AI agent traces (AI workflow generation, actions, conversations)
{resource.service.name="rpa-system-backend"} && {name=~".*ai.*"}

# Slow requests (>2 seconds) - general API calls
{resource.service.name="rpa-system-backend"} && {duration>2s}
```

**Loki (Logs):**
```logql
# All backend logs
{job="easyflow-backend"}

# Backend errors only
{job="easyflow-backend", level="error"}

# IMPORTANT: Filter out background tasks - only show logs with trace IDs
# Background tasks have empty trace: {} and won't have trace_id labels
{job="easyflow-backend"} | json | trace_id != ""

# Workflow-related logs (with trace IDs)
{job="easyflow-backend"} | json | trace_id != "" |= "workflow"

# AI agent logs (all AI functionality uses backend logs)
{job="easyflow-backend"} | json | trace_id != "" |= "ai."

# Search by trace ID (from Tempo trace)
{job="easyflow-backend"} | json | trace_id = "<trace-id-from-tempo>"

# Search by execution ID
{job="easyflow-backend"} | json | execution_id = "<execution-id>"

# Find workflow execution logs (exclude background cleanup)
{job="easyflow-backend"} | json | trace_id != "" | json | workflow_id != ""
```

**Prometheus (Metrics):**
```promql
# Service availability
up

# HTTP request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

---

## Step 6: System Health Checklist

Use this to verify everything is working:

### Infrastructure
- [ ] `docker ps` shows all containers running (prometheus, grafana, loki, promtail, tempo, otel-collector)
- [ ] `http://localhost:9090/targets` - all targets UP
- [ ] `http://localhost:3001` - Grafana loads (login: admin/admin123)
- [ ] `http://localhost:9091/metrics` - Backend metrics available
- [ ] `http://localhost:3100/ready` - Loki is ready

### Application
- [ ] `http://localhost:3000` - Frontend loads
- [ ] `http://localhost:3030/health` - Backend healthy
- [ ] `http://localhost:7070/health` - Worker healthy

### Observability
- [ ] Metrics flowing: Query `up` in Prometheus
- [ ] Logs flowing: Query `{job=~".+"}` in Grafana Explore → Loki
- [ ] Traces flowing: Query `{resource.service.name="rpa-system-backend"}` in Grafana Explore → Tempo

---

## Quick Access Links

### Observability Services
- **Grafana Dashboards:** http://localhost:3001 (admin/admin123)
- **Prometheus UI:** http://localhost:9090
- **Loki API:** http://localhost:3100
- **Tempo API:** http://localhost:3200
- **Backend Metrics:** http://localhost:9091/metrics

### Application Services
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3030
- **Backend Health:** http://localhost:3030/health
- **Automation Worker:** http://localhost:7070

---

## 🔄 Development Workflow Integration

**Observability is part of your daily workflow:**

1. **Start development:**
   ```bash
   ./start-dev.sh  # Starts app + observability
   ```

2. **While developing:**
   - Make changes
   - Test manually in browser/API
   - Check Grafana if something seems off

3. **Before committing:**
   ```bash
   npm run lint:test  # Quick validation
   ```

4. **Before pushing:**
   ```bash
   npm run test:all  # Full validation
   ```

5. **When debugging:**
   - Check logs: `tail -f logs/backend.log`
   - Check Grafana: http://localhost:3001
   - Use the debugging steps above

6. **Stop when done:**
   ```bash
   ./stop-dev.sh
   ```

**See [Development Workflow](../development/DEVELOPMENT_WORKFLOW.md) for the complete workflow.**

---

## Integrated Logs

All application logs are automatically collected and shipped to Loki via Promtail.

| Log Source | File Path | Job Name | Status |
|------------|-----------|----------|--------|
| **Backend** | `logs/backend.log` | `easyflow-backend` | ✅ Integrated |
| **Backend Errors** | `logs/backend-error.log` | `easyflow-backend-errors` | ✅ Integrated |
| **Frontend** | `logs/frontend.log` | `easyflow-frontend` | ✅ Integrated |
| **Frontend Errors** | `logs/frontend-error.log` | `easyflow-frontend-errors` | ✅ Integrated |
| **Automation Worker** | `logs/automation-worker.log` | `easyflow-automation` | ✅ Integrated |

**Note:** AI agent logs (AI workflow generation, actions, conversations) are part of the backend logs (`easyflow-backend`) and use structured logging with trace context. All AI functionality is automatically observable through the same backend log queries.

**Verify logs are flowing:**
```bash
# List all available jobs
curl http://localhost:3100/loki/api/v1/label/job/values

# Query recent logs
curl "http://localhost:3100/loki/api/v1/query_range?query={job=\"easyflow-backend\"}&limit=10&start=$(date -u -v-1H +%s)000000000&end=$(date -u +%s)000000000"
```

---

**Last Updated:** 2025-12-16  
**Version:** 2.0.0
