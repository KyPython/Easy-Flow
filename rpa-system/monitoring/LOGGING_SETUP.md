# Docker Logging Setup for EasyFlow

## Overview

EasyFlow uses Docker's logging driver to capture application logs from stdout/stderr, which are then collected by Promtail and shipped to Loki for observability and trace discovery.

## Application Logging Configuration

### ✅ Backend (Node.js)
- **Logger**: Pino (structured JSON logging)
- **Output**: stdout/stderr (default behavior - no file destination specified)
- **Location**: `rpa-system/backend/middleware/structuredLogging.js`
- **Docker**: Runs via `node server.js` (see `rpa-system/backend/Dockerfile`)

**Key Points:**
- Pino writes to `process.stdout` by default when no destination is specified
- All logs include trace context (`trace.traceId`) for correlation
- JSON format ensures reliable parsing by Promtail

### ✅ Automation Service (Python)
- **Logger**: Python `logging` module
- **Output**: stderr/stdout (default behavior - no handlers specified)
- **Location**: `rpa-system/automation/automation-service/production_automation_service.py`
- **Docker**: Runs via `python production_automation_service.py` (see `rpa-system/automation/automation-service/Dockerfile`)
- **Environment**: `PYTHONUNBUFFERED=1` ensures immediate log flushing

**Key Points:**
- Python `logging.basicConfig()` without handlers writes to stderr/stdout
- `PYTHONUNBUFFERED=1` prevents log buffering in Docker
- Trace IDs are included in log context via OpenTelemetry

## Docker Logging Driver

Docker automatically captures stdout/stderr from all containers and stores them in JSON log files:
- **Location**: `/var/lib/docker/containers/<container-id>/<container-id>-json.log`
- **Format**: `{"log":"<application log>","stream":"stdout","time":"<timestamp>"}`

## Promtail Configuration

Promtail is configured to:
1. **Discover containers** via Docker socket (`/var/run/docker.sock`)
2. **Read log files** from `/var/lib/docker/containers/`
3. **Extract trace IDs** from logs (JSON parsing + regex fallback)
4. **Index trace IDs** as Loki labels for fast filtering
5. **Enrich log content** with `traceId="<hex>"` for Grafana derived fields
6. **Ship to Loki** for storage and querying

**Configuration**: `rpa-system/monitoring/promtail-config.yml`

## Trace Discovery Flow

1. **Application** writes log with trace context to stdout
2. **Docker** captures log and stores in JSON log file
3. **Promtail** reads log file, extracts trace ID, enriches content
4. **Loki** stores log with trace ID indexed as label
5. **Grafana** queries Loki for logs containing trace ID
6. **Tempo** receives trace ID and displays full trace

## Verification

### Check if logs are reaching Loki:
```bash
# List available jobs
curl http://localhost:3100/loki/api/v1/label/job/values

# Query recent logs
curl "http://localhost:3100/loki/api/v1/query_range?query={job=\"easyflow-backend\"}&limit=10"

# Check for trace IDs
curl "http://localhost:3100/loki/api/v1/label/trace_id/values"
```

### Check Promtail is discovering containers:
```bash
# View Promtail logs
docker logs easyflow-promtail --tail 50

# Check Promtail targets
curl http://localhost:9080/targets
```

### Test trace discovery in Grafana:
1. Go to Explore → Tempo
2. Search for a trace ID (e.g., `75ae2874a1cf402204aa76b473332b6f`)
3. Grafana should find logs in Loki and display the trace

## Important Notes

- **No file logging needed**: Applications write directly to stdout/stderr
- **Docker handles capture**: No need to mount log directories
- **Automatic discovery**: Promtail finds new containers automatically
- **Trace IDs required**: Ensure applications include trace context in logs
- **JSON format preferred**: Structured logs are easier to parse and extract trace IDs

## Troubleshooting

### Logs not appearing in Loki:
1. Verify containers are running: `docker ps`
2. Check Promtail is running: `docker ps | grep promtail`
3. Verify Promtail can access Docker socket: `docker exec easyflow-promtail ls -la /var/run/docker.sock`
4. Check Promtail logs: `docker logs easyflow-promtail --tail 100`
5. Verify container logs exist: `docker logs <container-name>`

### Trace IDs not being extracted:
1. Verify logs contain trace context: `docker logs <container-name> | grep traceId`
2. Check Promtail pipeline stages in config
3. Verify JSON log format matches expected structure
4. Check Loki for trace_id label: `curl http://localhost:3100/loki/api/v1/label/trace_id/values`

### Trace discovery not working:
1. Verify Grafana datasource configuration (Loki + Tempo)
2. Check derived fields are configured in Loki datasource
3. Verify `tracesToLogs` is enabled in Tempo datasource
4. Check trace IDs match between logs and traces

## Restarting Services

After configuration changes:

```bash
# Restart Promtail
docker-compose -f rpa-system/docker-compose.monitoring.yml restart promtail

# Or recreate
docker-compose -f rpa-system/docker-compose.monitoring.yml up -d --force-recreate promtail

# Restart Grafana (if datasource config changed)
docker-compose -f rpa-system/docker-compose.monitoring.yml restart grafana
```

