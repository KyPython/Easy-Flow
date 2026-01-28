# Observability Architecture

## Overview

EasyFlow uses a **comprehensive observability stack** that integrates logs, traces, and metrics across the entire application stack (frontend, backend, Python workers) into a unified system.

## Architecture Flow

```
+─────────────────────────────────────────────────────────────────+
| FRONTEND (React) |
| +──────────────────────────────────────────────────────────+ |
| | FrontendLogger (logger.js) | |
| | - Creates trace context (traceId, spanId, requestId) | |
| | - Sends logs to /api/internal/front-logs | |
| | - Includes: level, component, message, trace, user | |
| +──────────────────────────────────────────────────────────+ |
| | |
| | POST /api/internal/front-logs |
| v |
+─────────────────────────────────────────────────────────────────+
 |
 |
+─────────────────────────────────────────────────────────────────+
| BACKEND (Node.js/Express) |
| +──────────────────────────────────────────────────────────+ |
| | Structured Logger (structuredLogging.js) | |
| | - Pino JSON logger | |
| | - Auto-injects trace context into every log | |
| | - Writes to stdout (Docker captures) | |
| +──────────────────────────────────────────────────────────+ |
| +──────────────────────────────────────────────────────────+ |
| | OpenTelemetry (telemetryInit.js) | |
| | - Traces -> OTLP Exporter -> Tempo/Grafana Cloud | |
| | - Metrics -> Prometheus + OTLP -> Grafana | |
| | - 10% sampling (configurable) | |
| +──────────────────────────────────────────────────────────+ |
| +──────────────────────────────────────────────────────────+ |
| | Database Instrumentation (databaseInstrumentation.js) | |
| | - Wraps Supabase client | |
| | - Logs: operation, table, duration, filters | |
| | - Auto-injects trace context | |
| +──────────────────────────────────────────────────────────+ |
| | |
| | stdout/stderr |
| v |
+─────────────────────────────────────────────────────────────────+
 |
 | Docker Logging Driver
 v
+─────────────────────────────────────────────────────────────────+
| PROMTAIL (Log Collector) |
| - Collects logs from Docker containers |
| - Parses JSON logs |
| - Extracts trace IDs for correlation |
| - Ships to Loki |
+─────────────────────────────────────────────────────────────────+
 |
 |
+─────────────────────────────────────────────────────────────────+
| LOKI (Log Aggregation) |
| - Stores all logs (frontend + backend + workers) |
| - Indexed by: timestamp, level, service, traceId |
| - Queryable via LogQL |
+─────────────────────────────────────────────────────────────────+
 |
 |
+─────────────────────────────────────────────────────────────────+
| TEMPO (Trace Storage) |
| - Stores distributed traces |
| - Correlates spans across services |
| - Queryable by traceId |
+─────────────────────────────────────────────────────────────────+
 |
 |
+─────────────────────────────────────────────────────────────────+
| GRAFANA (Visualization) |
| - Unified view of logs, traces, metrics |
| - Trace-to-logs correlation (click trace -> see logs) |
| - Log-to-traces correlation (click log -> see trace) |
| - Dashboards for SLOs, performance, errors |
+─────────────────────────────────────────────────────────────────+
```

## Trace Context Propagation

### W3C Trace Context Standard

Every request includes a `traceparent` header following the W3C standard:
```
traceparent: 00-{traceId}-{spanId}-{flags}
```

Example from your logs:
```
"traceparent": "00-3352610ed5a5f506ae701901c2818fed-001b0d262ac449cb-01"
```

### Trace Context Fields

Every log entry includes:
```json
{
 "trace": {
 "traceId": "3352610ed5a5f506ae701901c2818fed",
 "spanId": "001b0d262ac449cb",
 "parentSpanId": null,
 "requestId": "req_3352610ed5a5",
 "traceparent": "00-3352610ed5a5f506ae701901c2818fed-001b0d262ac449cb-01"
 }
}
```

### How It Works

1. **Frontend Request:**
 - Frontend generates `traceId` and `spanId`
 - Sends `traceparent` header with API request
 - Logs include trace context

2. **Backend Receives:**
 - Extracts `traceparent` from headers
 - Creates child span (new `spanId`, same `traceId`)
 - All backend logs include this trace context

3. **Database Operations:**
 - Database instrumentation wraps Supabase
 - Logs include trace context automatically
 - Can correlate DB queries with HTTP requests

4. **Kafka Messages:**
 - Trace context propagated in Kafka headers
 - Python workers extract and continue trace
 - End-to-end trace across services

## Log Structure

### Backend Logs (Pino JSON)

```json
{
 "level": "info",
 "time": 1766826702297,
 "service": "rpa-system-backend",
 "version": "0.0.0",
 "environment": "development",
 "logger": "database.supabase",
 "database": {
 "operation": "rpc",
 "hasFilters": false
 },
 "performance": {
 "duration": 952
 },
 "trace": {
 "traceId": "3352610ed5a5f506ae701901c2818fed",
 "spanId": "001b0d262ac449cb",
 "parentSpanId": null,
 "requestId": "req_3352610ed5a5",
 "traceparent": "00-3352610ed5a5f506ae701901c2818fed-001b0d262ac449cb-01",
 "userId": null,
 "userTier": "unknown",
 "method": "GET",
 "path": "/api/user/session",
 "userAgent": "Mozilla/5.0...",
 "ip": "127.0.0.1",
 "timestamp": "2025-12-27T09:11:40.339Z"
 },
 "business": {},
 "timestamp": "2025-12-27T09:11:42.297Z",
 "msg": "RPC function call completed: get_user_storage_total"
}
```

### Frontend Logs (Sent to Backend)

```json
{
 "level": "error",
 "component": "TaskForm",
 "message": "Task submission failed",
 "data": {
 "error": "Network error",
 "task_id": "abc123"
 },
 "trace": {
 "traceId": "3352610ed5a5f506ae701901c2818fed",
 "spanId": "001b0d262ac449cb",
 "requestId": "req_3352610ed5a5"
 },
 "user": {
 "id": "1196aa93-a166-43f7-8d21-16676a82436e"
 },
 "timestamp": "2025-12-27T09:11:42.297Z"
}
```

## Key Features

### 1. **Automatic Trace Context Injection**
- Every log automatically includes trace context
- No manual trace ID passing needed
- Works across frontend -> backend -> database -> Kafka -> workers

### 2. **End-to-End Correlation**
- Click a trace in Grafana -> see all related logs
- Click a log in Loki -> see the full trace
- Follow a request from frontend to database to worker

### 3. **Structured Logging**
- All logs are JSON (parseable, searchable)
- Consistent structure across services
- Business context included (user, workflow, task)

### 4. **Performance Tracking**
- Database query duration
- HTTP request duration
- RPC function call duration
- Slow query detection (thresholds configurable)

### 5. **Error Tracking**
- Errors include full trace context
- Stack traces preserved
- User context included (userId, userTier)

## Observability Stack

### Components

1. **OpenTelemetry (OTel)**
 - Distributed tracing
 - Metrics collection
 - Automatic instrumentation
 - 10% sampling (configurable)

2. **Pino (Structured Logging)**
 - Fast JSON logger
 - Automatic trace injection
 - Log sampling (configurable per level)

3. **Promtail**
 - Log collector
 - Extracts trace IDs
 - Ships to Loki

4. **Loki**
 - Log aggregation
 - Indexed by traceId, level, service
 - LogQL queries

5. **Tempo**
 - Trace storage
 - Distributed trace correlation

6. **Grafana**
 - Unified visualization
 - Trace-to-logs correlation
 - Dashboards and alerts

## Configuration

### Environment Variables

```bash
# Observability
OTEL_TRACE_SAMPLING_RATIO=0.1 # 10% sampling
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
DISABLE_TELEMETRY=false

# Logging
LOG_LEVEL=info
TRACE_LOG_SAMPLE_RATE=1000 # 0.1% of trace logs
DEBUG_LOG_SAMPLE_RATE=100 # 1% of debug logs
INFO_LOG_SAMPLE_RATE=1 # 100% (always log)
WARN_LOG_SAMPLE_RATE=1 # 100% (always log)

# Frontend Observability
REACT_APP_OBSERVABILITY_ENABLED=true
REACT_APP_LOG_SAMPLE_RATE=100 # 1% in prod, 100% in dev
REACT_APP_FRONT_LOGS_ENDPOINT=/api/internal/front-logs
```

## Querying Logs

### LogQL Examples

```logql
# All logs for a specific trace
{service="rpa-system-backend"} | json | traceId="3352610ed5a5f506ae701901c2818fed"

# All errors in the last hour
{service="rpa-system-backend"} | json | level="error"

# Slow database queries (>1000ms)
{service="rpa-system-backend"} | json | database.operation="SELECT" | performance.duration > 1000

# All logs for a specific user
{service="rpa-system-backend"} | json | trace.userId="1196aa93-a166-43f7-8d21-16676a82436e"

# Frontend errors
{service="rpa-system-backend"} | json | component="TaskForm" | level="error"
```

### Questions to ask myself
A solid lifelong checklist for backend issues:

Is it failing?

What’s the error rate for this endpoint over time?

What error types/messages are most common?

Is it slow?

What’s the latency distribution (p50, p95, p99)?

Did latency change after a deploy or config change?

Who is affected?

Which users/tenants are impacted?

Is it one tenant, one region, or everyone?

Where is the time/error coming from?

Which internal operation (DB query, external API, worker, cache) is failing or slow?

For a bad request, what does the trace show step‑by‑step?

How often and when?

How many requests per second/minute?

Do errors/latency spike at specific times or traffic patterns?

You don’t have to memorize them verbatim; the idea is:

“Is it broken?” → error rate + top errors

“Is it slow?” → latency distribution

“Who/where?” → affected users + spans (DB, worker, external)

“How often/when?” → traffic patterns

### Observability SOPs
When an endpoint feels wrong, I will always:

Reproduce it in the UI.

In Grafana, filter logs to that service + endpoint.

For a sample request:

look at duration

look at result size

look at any error fields

If timing is bad or errors exist, open the trace and see which span is responsible.

Decide: frontend behavior vs backend code vs DB vs external dependency.

Make the smallest change that reduces work per request or fixes the error.

Re‑run the same Grafana query to confirm the metric (duration / error rate) improved.

## Benefits

1. **Full Visibility**: See everything that happens in a request
2. **Fast Debugging**: Click trace -> see all logs -> find root cause
3. **Performance Monitoring**: Track slow queries, timeouts, bottlenecks
4. **Error Tracking**: Correlate errors with traces and user context
5. **Business Metrics**: Track usage, workflows, tasks per user
6. **Cost Optimized**: Sampling reduces volume while maintaining visibility

## Example: Following a Request

1. **User clicks "Run Workflow"** (Frontend)
 - Log: `TaskForm: Submitting workflow`
 - Trace ID: `3352610ed5a5f506ae701901c2818fed`

2. **Backend receives request** (Backend)
 - Log: `HTTP request started: POST /api/workflows/run`
 - Same trace ID, new span ID

3. **Database query** (Backend)
 - Log: `Database SELECT query: automation_runs`
 - Same trace ID, child span ID

4. **Kafka message** (Backend -> Worker)
 - Trace context in Kafka headers
 - Worker continues same trace

5. **Worker processes** (Python Worker)
 - Log: `Processing automation task`
 - Same trace ID, new span ID

6. **All logs correlated** in Grafana
 - Click trace -> see all 5 logs
 - See full request flow end-to-end

## Current Status

 **Fully Integrated:**
- Frontend logs -> Backend -> Loki
- Backend logs -> Loki
- Database instrumentation -> Loki
- OpenTelemetry traces -> Tempo
- Metrics -> Prometheus
- All logs include trace context

 **Dynamic Configuration:**
- Sampling rates configurable
- Observability can be enabled/disabled
- Log levels configurable per environment

 **Production Ready:**
- Cost-optimized (sampling)
- Performance-optimized (async, throttled)
- Security-aware (no sensitive data in logs)

