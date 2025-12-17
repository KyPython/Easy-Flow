# Log Integration Status - EasyFlow Observability System

**Last Updated:** 2025-12-17  
**Status:** ✅ All logs integrated into observability system

## Overview

All application logs are automatically collected by Promtail and shipped to Loki for centralized observability. Logs are correlated with traces via `trace_id` labels, enabling end-to-end request tracking in Grafana.

---

## Integrated Log Sources

### ✅ Backend Logs (Node.js)

| Source | File Path | Job Label | Collection Method | Status |
|--------|-----------|-----------|-------------------|--------|
| **Backend Application** | `logs/backend.log` | `easyflow-backend` | PM2 → File → Promtail | ✅ Integrated |
| **Backend Errors** | `logs/backend-error.log` | `easyflow-backend` | PM2 → File → Promtail | ✅ Integrated |

**Log Format:** Structured JSON (Pino logger)  
**Trace Integration:** Automatic via `trace.traceId` field  
**Sampling:** `info` logs sampled at 2% (1 in 50), `warn` at 10% (1 in 10)

**Key Features:**
- All logs include `trace_id`, `span_id`, `user_id`, `method`, `path`
- Database queries automatically instrumented with trace context
- HTTP requests logged with full trace correlation
- Workflow execution logs include `execution_id` and `workflow_id`

---

### ✅ Frontend Logs (React)

| Source | File Path | Job Label | Collection Method | Status |
|--------|-----------|-----------|-------------------|--------|
| **Frontend Application** | `logs/frontend.log` | `easyflow-frontend` | PM2 → File → Promtail | ✅ Integrated |
| **Frontend Errors** | `logs/frontend-error.log` | `easyflow-frontend` | PM2 → File → Promtail | ✅ Integrated |

**Log Format:** Mixed (JSON structured logs + console.log output)  
**Trace Integration:** Via `trace_id` field in structured logs  
**Sampling:** DEBUG/INFO logs sampled at 1% (1 in 100) via logger utility

**Key Features:**
- Structured logger utility (`src/utils/logger.js`) sends logs to `/api/front-logs` endpoint
- Backend endpoint (`/api/front-logs`) logs frontend logs through structured logging pipeline
- Direct `console.log` statements captured by PM2 and sent to Loki (may not be structured JSON)
- All logs include trace context for correlation with backend requests

---

### ✅ Automation Worker Logs (Python)

| Source | File Path | Job Label | Collection Method | Status |
|--------|-----------|-----------|-------------------|--------|
| **Automation Service** | `logs/automation-worker.log` | `easyflow-automation` | PM2 → File → Promtail | ✅ Integrated |

**Log Format:** Python logging (text format with timestamps)  
**Trace Integration:** Via OpenTelemetry trace context in log context  
**Environment:** `PYTHONUNBUFFERED=1` ensures immediate log flushing

**Key Features:**
- Python `logging` module writes to stdout/stderr
- PM2 captures stdout/stderr and writes to log file
- OpenTelemetry trace context included in log context (`otel_trace_id`, `otel_span_id`)
- Structured JSON logs for Kafka message processing
- Task processing logs include `user_id`, `workflow_id`, `task_id`

---

### ✅ Docker Container Logs

| Source | Collection Method | Status |
|--------|-------------------|--------|
| **All Docker Containers** | Docker API → Promtail | ✅ Integrated |

**Key Features:**
- Promtail uses Docker API to stream logs directly (no file buffering delays)
- Automatic container discovery via `docker_sd_configs`
- Container names mapped to job labels (`easyflow-backend`, `easyflow-frontend`, `easyflow-automation`)
- Docker JSON log format parsed to extract application logs
- Timestamps from Docker (most accurate) or application logs

---

## Log Collection Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Services                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Backend (Node.js)          Frontend (React)               │
│  ├─ Pino Logger             ├─ Logger Utility              │
│  ├─ Structured JSON         ├─ console.log                │
│  └─ stdout/stderr           └─ stdout/stderr                │
│                                                             │
│  Automation Worker (Python)                                │
│  ├─ Python logging                                          │
│  └─ stdout/stderr                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      PM2 Process Manager                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Captures stdout/stderr → Writes to log files               │
│                                                             │
│  logs/backend.log              logs/frontend.log            │
│  logs/backend-error.log        logs/frontend-error.log      │
│  logs/automation-worker.log                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Promtail Log Shipper                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  File-based Collection:                                     │
│  ├─ Tails PM2 log files                                     │
│  ├─ Strips PM2 timestamp prefix                            │
│  ├─ Parses JSON logs                                        │
│  ├─ Extracts trace_id, level, logger labels                 │
│  └─ Handles non-JSON logs gracefully                        │
│                                                             │
│  Docker API Collection:                                     │
│  ├─ Streams logs directly from Docker API                   │
│  ├─ Parses Docker JSON wrapper                             │
│  ├─ Extracts application log JSON                           │
│  └─ Uses Docker timestamps (most accurate)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Loki Log Aggregator                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stores logs with labels:                                   │
│  ├─ job (easyflow-backend, easyflow-frontend, etc.)        │
│  ├─ level (info, warn, error, debug)                        │
│  ├─ logger (component name)                                │
│  └─ trace_id (for correlation with Tempo traces)           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Grafana Dashboards                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Query logs by:                                             │
│  ├─ Job name: {job="easyflow-backend"}                      │
│  ├─ Trace ID: {trace_id="abc123..."}                       │
│  ├─ Log level: {level="error"}                              │
│  └─ Component: {logger="workflow.executor"}                │
│                                                             │
│  Correlate with traces via trace_id label                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Log Processing Pipeline

### PM2 Log Files (File-based Collection)

1. **PM2 Timestamp Stripping**
   - PM2 adds timestamp prefix: `2025-12-17 13:20:30: {"level":"info",...}`
   - Promtail regex stage strips prefix before JSON parsing
   - Handles both prefixed and non-prefixed logs

2. **JSON Parsing**
   - Parses structured JSON logs (Pino format)
   - Extracts: `level`, `msg`, `time`, `timestamp`, `service`, `logger`, `trace.traceId`, etc.
   - Non-JSON logs passed through as-is (handled gracefully)

3. **Trace ID Extraction**
   - Primary: Extracts from `trace.traceId` field in JSON
   - Fallback: Regex pattern matching for 32-char hex strings
   - Creates `trace_id` label for Loki indexing

4. **Label Extraction**
   - Extracts `level`, `logger` as Loki labels
   - Enables fast filtering: `{level="error"}`, `{logger="workflow.executor"}`

5. **Timestamp Parsing**
   - Priority 1: `timestamp` field (RFC3339 ISO format)
   - Priority 2: `time` field (UnixMs milliseconds)
   - Falls back to Promtail's default timestamp if both fail

6. **Output Formatting**
   - Uses `msg` field if available (from JSON parsing)
   - Falls back to original `message` if JSON parsing failed
   - Preserves original log structure

### Docker Container Logs (API-based Collection)

1. **Docker Log Format Parsing**
   - Docker wraps logs: `{"log":"<app log>","stream":"stdout","time":"<timestamp>"}`
   - Extracts `docker_log`, `docker_stream`, `docker_time` fields

2. **Application Log Parsing**
   - Parses `docker_log` field as JSON to extract application fields
   - Preserves Docker timestamp for accurate log ordering

3. **Trace ID Extraction**
   - Same as file-based collection (JSON field + regex fallback)

4. **Timestamp Handling**
   - Priority 1: Docker timestamp (`docker_time`) - Most accurate
   - Priority 2: Application timestamp (`app_timestamp`)
   - Priority 3: Application time (`app_time`)

5. **Output Formatting**
   - Uses original `docker_log` content (preserves structure)
   - Appends `traceId` for Grafana derived fields

---

## Verification Commands

### Check Promtail is Collecting Logs

```bash
# List all available jobs in Loki
curl http://localhost:3100/loki/api/v1/label/job/values

# Expected output should include:
# - easyflow-backend
# - easyflow-frontend
# - easyflow-automation
```

### Query Recent Backend Logs

```bash
# Query last 10 backend logs
curl "http://localhost:3100/loki/api/v1/query_range?query={job=\"easyflow-backend\"}&limit=10&start=$(date -u -v-1H +%s)000000000&end=$(date -u +%s)000000000"
```

### Query Logs by Trace ID

```bash
# Replace TRACE_ID with actual trace ID from logs
curl "http://localhost:3100/loki/api/v1/query_range?query={trace_id=\"TRACE_ID\"}&limit=100"
```

### Check Promtail Health

```bash
# Promtail health check
curl http://localhost:9080/ready

# Promtail metrics
curl http://localhost:9080/metrics
```

---

## Grafana Queries

### All Backend Logs
```
{job="easyflow-backend"}
```

### Backend Errors Only
```
{job="easyflow-backend"} |= "error" OR level="error"
```

### Workflow Execution Logs
```
{job="easyflow-backend"} | json | execution_id != ""
```

### Logs by Trace ID
```
{trace_id="abc123..."}
```

### Frontend Errors
```
{job="easyflow-frontend"} |= "error" OR level="error"
```

### Automation Worker Logs
```
{job="easyflow-automation"}
```

---

## Log Sampling Configuration

### Backend Logging (`structuredLogging.js`)

```javascript
SAMPLING_CONFIG = {
  info: 50,   // Sample 1 in 50 (2%)
  warn: 10,   // Sample 1 in 10 (10%)
  error: 1,  // Always log (100%)
  fatal: 1   // Always log (100%)
}
```

### Frontend Logging (`logger.js`)

```javascript
LOG_SAMPLE_RATE = 100;  // Sample 1 in 100 (1%) for DEBUG/INFO
// WARN/ERROR/FATAL always logged (100%)
```

---

## Trace Correlation

All logs automatically include trace context:

- **Backend:** `trace.traceId`, `trace.spanId`, `trace.userId`, `trace.method`, `trace.path`
- **Frontend:** `trace.traceId`, `trace.requestId` (via logger utility)
- **Automation Worker:** `otel_trace_id`, `otel_span_id` (via OpenTelemetry)

**Correlate logs with traces in Grafana:**
1. Find a log entry with a `trace_id`
2. Copy the `trace_id` value
3. Query Tempo: `{trace_id="<trace_id>"}`
4. View the complete request flow across all services

---

## Troubleshooting

### Logs Not Appearing in Loki

1. **Check Promtail is running:**
   ```bash
   docker ps | grep promtail
   curl http://localhost:9080/ready
   ```

2. **Check log files exist:**
   ```bash
   ls -lh /Users/ky/Easy-Flow/logs/
   ```

3. **Check Promtail can access log files:**
   ```bash
   docker exec easyflow-promtail ls -lh /app/logs/
   ```

4. **Check Promtail logs:**
   ```bash
   docker logs easyflow-promtail --tail 100
   ```

5. **Verify PM2 is writing logs:**
   ```bash
   pm2 logs easyflow-backend --lines 10
   ```

### Empty Logs (`<no value>`)

- **Cause:** Empty log lines or malformed JSON
- **Fix:** Promtail `drop` stage filters empty lines
- **Verify:** Check Promtail config has `drop` stage for empty messages

### Missing Trace IDs

- **Cause:** Logs generated outside trace context
- **Fix:** Ensure all log calls use structured logger with trace context
- **Verify:** Check logs include `trace.traceId` field

### Timestamp Issues

- **Cause:** PM2 timestamp prefix interfering with JSON parsing
- **Fix:** Promtail regex stage strips PM2 prefix before JSON parsing
- **Verify:** Check Promtail config has regex stage for PM2 logs

---

## Summary

✅ **All logs are integrated into the observability system:**

- ✅ Backend logs (structured JSON via Pino)
- ✅ Frontend logs (structured + console.log via PM2)
- ✅ Automation worker logs (Python logging via PM2)
- ✅ Docker container logs (via Docker API)
- ✅ Trace correlation (via trace_id labels)
- ✅ Error logs (separate streams for errors)
- ✅ Log sampling (reduces volume while maintaining observability)

**All logs are queryable in Grafana with full trace correlation.**

