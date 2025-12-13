# EasyFlow Observability System - Usage Guide

## Quick Start

### Starting the System
```bash
./start-dev.sh
```

This single command starts:
- ✅ **Kafka & Zookeeper** (message broker)
- ✅ **Backend API** (Node.js on port 3030)
- ✅ **Frontend** (React on port 3000)
- ✅ **Automation Worker** (Python on port 7070)
- ✅ **Prometheus** (metrics on port 9090)
- ✅ **Grafana** (dashboards on port 3001)
- ✅ **Loki** (log aggregation on port 3100)
- ✅ **Promtail** (log collector)
- ✅ **Tempo** (trace storage on port 3200)
- ✅ **OTEL Collector** (telemetry ingestion)

### Stopping the System
```bash
./stop-dev.sh
```

Stops all services, containers, and verifies ports are free.

---

## Accessing the Observability Stack

### Grafana Dashboard
**URL:** http://localhost:3001  
**Credentials:** admin / admin

**Pre-configured Dashboards:**
1. **Workflow Execution Observability** - Real-time workflow tracing
2. **Backend Metrics** - Node.js application metrics
3. **System Overview** - Infrastructure health

### Prometheus
**URL:** http://localhost:9090

**Key Metrics to Query:**
- `up` - Service availability
- `http_request_duration_seconds` - Request latency
- `workflow_execution_total` - Workflow execution count
- `workflow_execution_duration_seconds` - Workflow duration
- `nodejs_heap_size_used_bytes` - Memory usage

### Loki Logs
**URL:** http://localhost:3100

**Query Examples in Grafana:**
```logql
# All backend logs
{job="easyflow-backend"}

# Backend errors only
{job="easyflow-backend", level="error"}

# Logs for specific workflow
{job="easyflow-backend"} |= "workflow_id" |= "your-workflow-id"

# Automation worker errors
{job="easyflow-automation"} |= "ERROR"
```

### Backend Metrics Endpoint
**URL:** http://localhost:9091/metrics

View raw Prometheus metrics from the backend.

---

## Process Management with PM2

### View All Services
```bash
pm2 list
```

### View Logs
```bash
# All services
pm2 logs

# Backend only
pm2 logs easyflow-backend

# Automation worker only
pm2 logs easyflow-automation

# Frontend only
pm2 logs easyflow-frontend
```

### Restart a Service
```bash
pm2 restart easyflow-backend
pm2 restart easyflow-automation
pm2 restart easyflow-frontend
```

### View Service Details
```bash
pm2 show easyflow-backend
```

### Monitor in Real-Time
```bash
pm2 monit
```

---

## Log Files

PM2 writes logs to these files:

- **Backend:** `logs/backend.log` and `logs/backend-error.log`
- **Frontend:** `logs/frontend.log` and `logs/frontend-error.log`
- **Automation:** `logs/automation-worker.log`

### Tail Logs Directly
```bash
tail -f logs/backend.log
tail -f logs/automation-worker.log
tail -f logs/frontend.log
```

---

## Troubleshooting Workflows

### 1. Check Workflow Traces in Grafana

1. Open http://localhost:3001
2. Go to **Dashboards** → **Workflow Execution Observability**
3. Look for your workflow execution
4. Click on a trace to see:
   - Total execution time
   - Each step's duration
   - Errors and their context
   - Full span tree

### 2. Query Logs for Errors

In Grafana, go to **Explore** and run:
```logql
{job="easyflow-backend", level="error"} 
| json 
| line_format "{{.timestamp}} [{{.logger}}] {{.msg}} - {{.error}}"
```

### 3. Check Kafka Connection

If workflows aren't executing:
```bash
# Check if Kafka is running
docker ps | grep kafka

# Check automation worker logs
pm2 logs easyflow-automation --lines 50

# Look for Kafka connection errors
docker logs easy-flow-kafka-1 --tail 50
```

### 4. Verify Backend Health
```bash
curl http://localhost:3030/health | jq
```

Expected output:
```json
{
  "status": "ok",
  "timestamp": "...",
  "services": {
    "database": "connected",
    "kafka": "connected"
  }
}
```

---

## Understanding the Data Flow

### Logs Flow
```
Application Code (console.log, logger.info)
         ↓
    PM2 Log Files (logs/*.log)
         ↓
   Promtail (scrapes files)
         ↓
    Loki (stores logs)
         ↓
  Grafana (visualizes)
```

### Metrics Flow
```
Application Code (prom-client metrics)
         ↓
Backend /metrics endpoint (:9091/metrics)
         ↓
Prometheus (scrapes every 15s)
         ↓
Grafana (queries Prometheus)
```

### Traces Flow
```
Application Code (@opentelemetry/api spans)
         ↓
OTEL SDK (batches traces)
         ↓
OTEL Collector (:4318 HTTP / :4317 gRPC)
         ↓
Tempo (stores traces)
         ↓
Grafana (queries traces)
```

---

## Adding Custom Observability

### Add a New Metric
```javascript
const { register, Counter } = require('prom-client');

const myCounter = new Counter({
  name: 'my_custom_event_total',
  help: 'Total number of custom events',
  labelNames: ['event_type']
});

// Increment
myCounter.inc({ event_type: 'user_action' });
```

### Add Custom Logging
```javascript
const logger = require('./logger');

logger.info('Custom event occurred', {
  userId: '123',
  action: 'workflow_created',
  workflowId: 'abc-def'
});
```

### Add Custom Tracing
```javascript
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('my-service');

const span = tracer.startSpan('my-operation');
span.setAttribute('user.id', userId);
// ... do work ...
span.end();
```

---

## Performance Monitoring

### Key Metrics to Watch

1. **Request Latency (P95):** Should be < 500ms
   ```promql
   histogram_quantile(0.95, http_request_duration_seconds_bucket)
   ```

2. **Error Rate:** Should be < 1%
   ```promql
   rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
   ```

3. **Workflow Success Rate:**
   ```promql
   workflow_execution_total{status="success"} / workflow_execution_total
   ```

4. **Memory Usage:** Should stay stable
   ```promql
   nodejs_heap_size_used_bytes / 1024 / 1024
   ```

---

## Alerting (Optional Setup)

Alertmanager is included but not configured by default.

To enable alerts:
1. Edit `rpa-system/monitoring/prometheus.yml`
2. Add alert rules
3. Configure Alertmanager webhook/email
4. Restart observability stack

Example alert rule:
```yaml
groups:
- name: easyflow
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    annotations:
      summary: "High error rate detected"
```

---

## Common Issues

### "No data found in response" in Grafana
- **Cause:** Loki hasn't received logs yet
- **Solution:** Generate activity (make API requests), wait 15-30s for Promtail to send logs

### PM2 process keeps restarting
- **Check:** `pm2 logs <service-name>` to see error
- **Common cause:** Port already in use
- **Solution:** Run `./stop-dev.sh` then `./start-dev.sh`

### Prometheus shows "Target Down"
- **Check:** `docker ps` to verify containers are running
- **Solution:** Restart observability stack: `cd rpa-system/monitoring && docker-compose -f docker-compose.monitoring.yml restart`

### Traces not appearing
- **Check:** Backend logs for "OpenTelemetry initialized"
- **Verify:** OTEL Collector is running: `docker logs easyflow-otel-collector`
- **Solution:** Ensure `DISABLE_TELEMETRY` is NOT set in environment

---

## Production Considerations

When deploying to production, you should:

1. **Use persistent volumes** for Prometheus, Grafana, Loki data
2. **Configure authentication** for Grafana (change default password)
3. **Set up alerting** with Alertmanager + PagerDuty/Slack
4. **Enable trace sampling** (only sample 10% of traces in high-traffic)
5. **Use a proper process manager** (PM2 in cluster mode or K8s)
6. **Configure log retention** (Loki defaults to 7 days)
7. **Set up backups** for Grafana dashboards and Prometheus data

---

## Support

For issues or questions:
- Check OBSERVABILITY_GUIDE.md for setup details
- Review backend logs: `pm2 logs easyflow-backend`
- Check Grafana dashboards for real-time status
- Open an issue in the GitHub repository
