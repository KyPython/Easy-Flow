# Logging Integration with Observability System

## Overview

All logs in the EasyFlow backend are automatically integrated with the observability system (Loki, Tempo, Grafana) through structured logging with automatic trace context injection.

## Architecture

```
Backend Application (Node.js)
  ↓
Pino Structured Logger (writes to stdout/stderr)
  ↓
PM2 Process Manager (captures stdout/stderr)
  ↓
Log Files (logs/backend.log, logs/frontend.log, logs/automation-worker.log)
  ↓
Promtail (reads log files)
  ↓
Loki (log aggregation)
  ↓
Grafana (visualization and querying)
```

## How It Works

### 1. Structured Logging (Pino)

- **Location**: `rpa-system/backend/middleware/structuredLogging.js`
- **Output**: stdout/stderr (no file destination specified)
- **Format**: JSON with automatic trace context injection
- **Trace Context**: Automatically injected via `getCurrentTraceContext()`

### 2. PM2 Log Capture

- **Configuration**: `ecosystem.config.js` and `start-dev.sh`
- **Log Files**:
  - `logs/backend.log` - Backend application logs
  - `logs/frontend.log` - Frontend application logs
  - `logs/automation-worker.log` - Automation worker logs
- **PM2 captures stdout/stderr** and writes to these files

### 3. Promtail Collection

- **Configuration**: `rpa-system/monitoring/promtail-config.yml`
- **Scrape Config**: `easyflow-pm2-logs` job
- **Volume Mount**: `./logs:/app/logs:ro` in `docker-compose.monitoring.yml`
- **Parsing**: JSON parsing with trace ID extraction, label assignment, timestamp parsing

### 4. Loki Storage

- **Endpoint**: `http://localhost:3100`
- **Query Interface**: Grafana Explore → Loki
- **Trace Correlation**: Logs automatically include `trace_id` for correlation with Tempo traces

## Log Structure

Every log entry includes:

```json
{
  "level": "info",
  "msg": "Log message",
  "service": "rpa-system-backend",
  "logger": "app",
  "timestamp": "2025-12-17T03:00:00.000Z",
  "trace": {
    "traceId": "546fe061b451300d2d9bf7b1716801a5",
    "spanId": "a1b2c3d4e5f6g7h8",
    "userId": "user-123",
    "method": "GET",
    "path": "/api/user/session"
  },
  // ... additional context fields
}
```

## Using the Logger

### In Route Handlers

```javascript
const { logger } = require('./utils/logger');

// All logs automatically include trace context
logger.info('[GET /api/user/session] Route handler called', {
  userId: req.user?.id,
  method: req.method,
  path: req.path
});

logger.error('[GET /api/user/session] Error occurred', error, {
  userId: req.user?.id,
  additionalContext: 'value'
});
```

### In Services

```javascript
const { createLogger } = require('./middleware/structuredLogging');
const logger = createLogger('service.workflowExecutor');

logger.info('Starting workflow execution', {
  execution_id: execution.id,
  workflow_id: workflow.id,
  trace_id: span.spanContext().traceId
});
```

## Trace Context Integration

- **Automatic**: Every log entry automatically includes trace context via `getCurrentTraceContext()`
- **Correlation**: Logs can be correlated with Tempo traces using `trace_id`
- **Propagation**: Trace context is propagated across async operations via AsyncLocalStorage

## Querying Logs in Grafana

### Find logs by trace ID

```
{job="easyflow-backend"} | json | trace_id = "546fe061b451300d2d9bf7b1716801a5"
```

### Find logs by route

```
{job="easyflow-backend"} | json | msg =~ ".*/api/user/session.*"
```

### Find error logs

```
{job="easyflow-backend"} | json | level = "error"
```

### Find logs with trace context (exclude background tasks)

```
{job="easyflow-backend"} | json | trace_id != ""
```

## Verification

All logs are integrated if:

1. ✅ Pino logger writes to stdout/stderr (no file destination)
2. ✅ PM2 captures stdout/stderr to log files
3. ✅ Promtail reads from log files (`logs/*.log`)
4. ✅ Promtail parses JSON and extracts trace IDs
5. ✅ Logs appear in Loki with `job="easyflow-backend"`
6. ✅ Logs include `trace_id` field for correlation

## Recent Additions

The following logs were recently added and are fully integrated:

- `[GET /api/user/session] Route handler called` - Session endpoint entry logging
- `[GET /api/user/session] ⚠️ BLOCKED: Attempt to execute workflow` - Defensive guard logging
- `[POST /api/workflows/execute] Route handler called` - Workflow execution entry logging with call stack

All use the structured logger (`logger` from `utils/logger.js`) which automatically:
- Formats as JSON
- Injects trace context
- Writes to stdout/stderr
- Gets captured by PM2
- Collected by Promtail
- Stored in Loki
- Queryable in Grafana

## Troubleshooting

### Logs not appearing in Loki

1. Check PM2 is writing logs: `tail -f logs/backend.log`
2. Check Promtail is running: `docker ps | grep promtail`
3. Check Promtail logs: `docker logs easyflow-promtail --tail 50`
4. Verify volume mount: Check `docker-compose.monitoring.yml` has `./logs:/app/logs:ro`
5. Check Promtail config: Verify `easyflow-pm2-logs` scrape config exists

### Trace IDs missing

1. Verify trace context middleware is mounted: Check `app.js` uses `traceContextMiddleware`
2. Check trace context is available: Logs should include `trace.traceId` field
3. Verify OpenTelemetry is initialized: Check startup logs for "OpenTelemetry initialized"

