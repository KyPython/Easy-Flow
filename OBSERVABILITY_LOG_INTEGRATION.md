# Observability Log Integration Status

This document describes how all logs are integrated into the observability system (Loki/Grafana).

## Integration Architecture

All logs flow through the following pipeline:
1. **Application logs** → stdout/stderr (JSON format)
2. **Docker logging driver** → Captures stdout/stderr
3. **Promtail** → Collects from Docker containers or log files
4. **Loki** → Stores logs with labels for filtering
5. **Grafana** → Query and visualize logs with trace correlation

## Log Sources and Integration Status

### ✅ Backend (Node.js)

**Location**: `rpa-system/backend/`

**Logger**: Pino (structured JSON logging)
- **File**: `rpa-system/backend/middleware/structuredLogging.js`
- **Output**: JSON to stdout/stderr
- **Trace Integration**: Automatic via `traceContextMiddleware`
- **Fields**: `level`, `msg`, `service`, `logger`, `trace.traceId`, `trace.spanId`, `timestamp`

**Integration Method**:
- Logs written to stdout/stderr (Pino default)
- Docker captures logs via logging driver
- Promtail collects from Docker containers (`docker_sd_configs`)
- Job label: `easyflow-backend`

**Status**: ✅ Fully integrated

### ✅ Frontend (React)

**Location**: `rpa-system/rpa-dashboard/src/`

**Logger**: Custom structured logger
- **File**: `rpa-system/rpa-dashboard/src/utils/logger.js`
- **Output**: Sends to `/api/internal/front-logs` endpoint
- **Trace Integration**: Includes trace context from OpenTelemetry
- **Fields**: `level`, `message`, `component`, `trace`, `timestamp`

**Integration Method**:
1. Frontend logger sends logs to backend endpoint
2. Backend `/api/internal/front-logs` route uses structured logger
3. Logs flow through backend logging pipeline
4. Job label: `easyflow-frontend` (via backend logger with `source: 'frontend'`)

**Note**: Some `console.*` calls still exist but are non-critical (debug/dev only)

**Status**: ✅ Integrated (via backend endpoint)

### ✅ Automation Worker (Python)

**Location**: `rpa-system/automation/automation-service/`

**Logger**: Python logging module
- **File**: `production_automation_service.py`
- **Output**: Text format to stdout/stderr
- **Trace Integration**: OpenTelemetry context added to log extra_context
- **Fields**: Standard Python logging format with extra_context for trace IDs

**Integration Method**:
- Logs written to stdout/stderr (Python logging default)
- Docker captures logs via logging driver
- Promtail collects from Docker containers
- Job label: `easyflow-automation`

**Note**: Currently uses text format. For better observability, consider JSON format.

**Status**: ✅ Integrated (text format, works but could be improved to JSON)

### ✅ PM2 Log Files

**Location**: `/app/logs/` (when running via PM2)

**Files**:
- `backend.log` - Backend stdout/stderr
- `backend-error.log` - Backend errors only
- `frontend.log` - Frontend logs
- `frontend-error.log` - Frontend errors only
- `automation-worker.log` - Automation worker logs

**Integration Method**:
- Promtail tails log files via `static_configs` with `__path__`
- Parses PM2 timestamp prefixes
- Extracts JSON from application logs
- Job labels: `easyflow-backend`, `easyflow-frontend`, `easyflow-automation`

**Status**: ✅ Integrated

## Log Flow Diagram

```
┌─────────────────┐
│   Backend App   │
│  (Pino JSON)    │
│  stdout/stderr  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Docker Logger  │
│   (captures)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│    Promtail     │─────▶│      Loki        │
│  (collects &    │      │   (stores logs)  │
│   labels)       │      └──────────────────┘
└─────────────────┘              │
         ▲                       ▼
         │              ┌──────────────────┐
         │              │     Grafana      │
┌────────┴────────┐     │  (visualize &    │
│  PM2 Log Files  │     │   correlate)     │
│  (file tailing) │     └──────────────────┘
└─────────────────┘
```

## Trace ID Integration

All structured logs include trace context:

**Backend**:
```json
{
  "level": "info",
  "msg": "Task completed",
  "trace": {
    "traceId": "75ae2874a1cf402204aa76b473332b6f",
    "spanId": "a1b2c3d4e5f6g7h8",
    "parentSpanId": "...",
    "requestId": "req_..."
  }
}
```

**Frontend**:
```json
{
  "level": "info",
  "message": "Component mounted",
  "trace": {
    "traceId": "75ae2874a1cf402204aa76b473332b6f"
  }
}
```

**Python Worker**:
- Uses `logging.LoggerAdapter` with extra_context
- Trace IDs added to log extra fields
- Promtail extracts via regex fallback if not in JSON

## Verification Queries

### Check logs are flowing to Loki:

```bash
# List all jobs
curl http://localhost:3100/loki/api/v1/label/job/values

# Query recent logs
curl 'http://localhost:3100/loki/api/v1/query_range?query={job=~".+"}&limit=10'
```

### In Grafana Explore (Loki):

```logql
# All backend logs
{job="easyflow-backend"}

# Backend errors only
{job="easyflow-backend", level="error"}

# Logs with trace IDs (excludes background tasks)
{job="easyflow-backend"} | json | trace_id != ""

# Search by trace ID
{job="easyflow-backend"} | json | trace_id = "75ae2874a1cf402204aa76b473332b6f"
```

## Promtail Configuration

**File**: `rpa-system/monitoring/promtail-config.yml`

**Key Features**:
1. Docker container discovery (automatic)
2. PM2 log file tailing (fallback)
3. JSON parsing with trace ID extraction
4. Timestamp handling (Docker → app timestamp → fallback)
5. Label extraction for filtering

## Recommendations

1. **✅ Backend**: Fully integrated - no changes needed
2. **✅ Frontend**: Integrated via backend endpoint - consider replacing remaining console.* calls
3. **⚠️ Python Worker**: Consider JSON logging format for better parsing (optional improvement)
4. **✅ PM2 Logs**: Fully integrated - works for local development

## All Logs Are Integrated ✅

All application logs flow through the observability pipeline to Loki and are queryable in Grafana with trace correlation support.

