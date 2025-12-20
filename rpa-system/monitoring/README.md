# EasyFlow Monitoring Stack

Complete observability infrastructure for EasyFlow including metrics, logs, traces, and alerts.

## Quick Start

```bash
# Start monitoring stack (from project root or monitoring directory)
./rpa-system/monitoring/start-observability.sh

# Or manually:
cd rpa-system
docker compose -f docker-compose.monitoring.yml up -d

# Stop monitoring stack
./rpa-system/monitoring/stop-observability.sh

# Or manually:
cd rpa-system
docker compose -f docker-compose.monitoring.yml down
```

**Access URLs:**
- Grafana: http://localhost:3001 (admin/admin123)
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Tempo: http://localhost:3200
- Loki: http://localhost:3100
- OTEL Collector: http://localhost:4318

## Setup Alerts (Email + SMS)

**Configured for:** kyjahntsmith@gmail.com, Phone: 203-449-4970

1. **Get Gmail App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Generate app password for "Mail"
   - Copy the 16-character password

2. **Update alertmanager.yml:**
   - Edit `smtp_auth_password` with your Gmail app password
   - SMS is already configured via email-to-SMS gateways (Verizon, T-Mobile, AT&T, Sprint)

3. **Restart Alertmanager:**
```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

## Components

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Dashboards and visualization
- **Loki** - Log aggregation
- **Tempo** - Distributed tracing
- **Promtail** - Log shipper
- **Alertmanager** - Alert routing and notifications
- **OTEL Collector** - Telemetry processing

## Business Metrics

Business KPIs are automatically tracked and exposed at:
- API: `http://localhost:3030/api/business-metrics/overview`
- Prometheus: `http://localhost:3030/metrics/business`
- Grafana Dashboard: Dashboards → EasyFlow → Business Metrics

## Code Quality Metrics

Code quality metrics are automatically tracked and exposed at:
- Prometheus: `http://localhost:3030/metrics/code-quality`
- Grafana Dashboard: Dashboards → EasyFlow → Code Quality Dashboard
- HTML Report: `npm run quality:report` (generates `reports/quality/latest.html`)

**Metrics tracked:**
- Total files scanned
- Total issues (by severity: high, medium, low)
- Last scan timestamp
- Trends over time

## Alert Rules

10 business metric alerts configured:
- MRR drops
- Zero signups
- Low activation rates
- Conversion issues
- User engagement drops

View active alerts: http://localhost:9090/alerts

## Files

**Configuration Files (All Used):**
- `prometheus.yml` - Prometheus scrape config + alert rules
- `alertmanager.yml` - Alert routing and notifications
- `promtail-config.yml` - Log collection config
- `loki-config.yml` - Log storage config
- `tempo-config.yml` - Trace storage config
- `otel-collector-minimal.yml` - Telemetry processing
- `business-metrics-alerts.yml` - Business KPI alert rules
- `docker-compose.monitoring.yml` - Stack orchestration

**Scripts:**
- `setup-alerts.sh` - Generate alertmanager config from env vars
- `start-observability.sh` - Start the monitoring stack
- `stop-observability.sh` - Stop the monitoring stack

**Templates:**
- `alertmanager.yml.template` - Template for alert setup script
