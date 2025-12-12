# EasyFlow Observability Stack

## Quick Start

### Start the Stack
```bash
cd rpa-system
./monitoring/start-observability.sh
```

### Access Services
- **Grafana**: http://localhost:3003 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Tempo**: http://localhost:3200
- **Alertmanager**: http://localhost:9093

## Architecture

```
Backend → OTLP Collector → Tempo (traces)
                    ↓
              Prometheus (metrics)
                    ↓
              Grafana (visualization)
```

## Viewing Workflow Traces

1. Open Grafana: http://localhost:3003
2. Go to **Explore** → Select **Tempo**
3. Query: `{service.name="rpa-system-backend" && name=~"workflow.execute.*"}`
4. Click on a trace to see full execution details

## Stopping

```bash
docker compose -f docker-compose.monitoring.yml down
```

## Documentation

- **Production**: Grafana Cloud is configured - add env vars to Render (see code comments in `telemetryInit.js`)
