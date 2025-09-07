# EasyFlow Monitoring Guide

This document describes the comprehensive monitoring setup for the EasyFlow RPA system.

## Overview

The monitoring stack includes:
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization dashboards
- **Alertmanager**: Alert routing and notification
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics  
- **Loki**: Log aggregation
- **Promtail**: Log collection

## Quick Start

### Start Monitoring Stack

```bash
cd monitoring
./start-monitoring.sh
```

### Access Monitoring Services

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Node Exporter**: http://localhost:9100
- **cAdvisor**: http://localhost:8080
- **Loki**: http://localhost:3100

## Dashboards

### 1. EasyFlow Application Overview
- **File**: `grafana/dashboards/easyflow-overview.json`
- **Metrics**: 
  - HTTP request rates and response times
  - Task completion/failure rates
  - Email delivery status
  - User authentication metrics
  - Firebase notification status

### 2. System Monitoring
- **File**: `grafana/dashboards/system-monitoring.json`
- **Metrics**:
  - CPU, Memory, Disk usage
  - Network I/O
  - Container resource usage
  - Docker container health

### 3. Load Testing Dashboard
- **File**: `grafana/dashboards/load-testing.json`
- **Metrics**:
  - K6 load testing results
  - Request latency distribution
  - Error rates during testing
  - Throughput analysis

## Alerting

### Alert Rules
Configured in `alert-rules.yml`:

#### Application Alerts
- High error rate (>10% for 5 minutes)
- High response time (>2 seconds 95th percentile)
- Service down
- Database connection failures

#### System Alerts  
- High CPU usage (>80% for 5 minutes)
- High memory usage (>85% for 5 minutes)
- Low disk space (<10%)
- Container restart loops

#### Business Alerts
- Task failure rate spikes
- No tasks processed (30+ minutes)
- Email delivery failures
- Authentication failure spikes

### Alert Notifications
Configured in `alertmanager.yml`:

- **Critical alerts**: Email + webhook to backend API
- **Warning alerts**: Email to ops team + webhook
- **Destinations**:
  - Email: admin@easyflow.com, ops@easyflow.com
  - Webhook: Backend API endpoints for integration with Firebase notifications

## Log Management

### Loki Configuration
- **Storage**: Local filesystem
- **Retention**: Configurable via schema_config
- **Access**: Query logs through Grafana

### Log Sources
- Container logs: All Docker containers
- System logs: /var/log/syslog  
- Application logs: EasyFlow backend logs
- Nginx logs: Access and error logs

### Log Parsing
Promtail automatically parses:
- JSON formatted container logs
- Nginx access logs (standard format)
- System logs

## Metrics Collection

### Backend Metrics Endpoint
Add to backend `index.js`:

```javascript
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await promClient.register.metrics();
    res.set('Content-Type', promClient.register.contentType);
    res.end(metrics);
  } catch (ex) {
    res.status(500).end(ex);
  }
});
```

### Custom Metrics
Example custom metrics for EasyFlow:

```javascript
const promClient = require('prom-client');

// Task metrics
const taskCounter = new promClient.Counter({
  name: 'tasks_total',
  help: 'Total number of tasks processed',
  labelNames: ['status', 'type']
});

// Email metrics  
const emailCounter = new promClient.Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['type', 'status']
});

// Response time histogram
const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});
```

## Health Checks

### Automated Health Monitoring
Run the comprehensive health check:

```bash
./health-check.sh --monitoring-only
```

### Manual Health Verification

```bash
# Check all services
docker-compose -f docker-compose.monitoring.yml ps

# View service logs
docker-compose -f docker-compose.monitoring.yml logs -f grafana
docker-compose -f docker-compose.monitoring.yml logs -f prometheus

# Test metric endpoints
curl http://localhost:9090/api/v1/targets  # Prometheus targets
curl http://localhost:3001/api/health      # Grafana health
```

## Configuration Files

### Core Files
- `prometheus.yml`: Prometheus configuration and scrape targets
- `alert-rules.yml`: Alert rule definitions
- `alertmanager.yml`: Alert routing and notification setup
- `docker-compose.monitoring.yml`: Container orchestration
- `loki-config.yml`: Log aggregation configuration
- `promtail-config.yml`: Log collection setup

### Dashboard Files
- `grafana/dashboards/*.json`: Pre-built Grafana dashboards
- `grafana/provisioning/`: Auto-provisioning configuration

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check container status
docker-compose -f docker-compose.monitoring.yml ps

# View logs for failed service
docker-compose -f docker-compose.monitoring.yml logs SERVICE_NAME
```

#### Missing Metrics
- Verify target endpoints are accessible
- Check Prometheus targets: http://localhost:9090/targets
- Ensure backend `/metrics` endpoint is implemented

#### Dashboard Import Issues
- Verify dashboard files exist in `grafana/dashboards/`
- Check Grafana provisioning configuration
- Manually import through Grafana UI if needed

#### Alert Issues
- Check alert rules syntax in Prometheus UI
- Verify Alertmanager webhook endpoints
- Test email configuration

### Performance Tuning

#### Resource Limits
Adjust in `docker-compose.monitoring.yml`:

```yaml
services:
  prometheus:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

#### Retention Settings
Prometheus data retention:

```yaml
command:
  - '--storage.tsdb.retention.time=200h'
  - '--storage.tsdb.retention.size=50GB'
```

## Maintenance

### Backup
Important files to backup:
- Grafana dashboards: `grafana/dashboards/`
- Prometheus data: Docker volume `prometheus-data`
- Configuration files: All `.yml` files

### Updates
```bash
# Pull latest images
docker-compose -f docker-compose.monitoring.yml pull

# Restart with new images
docker-compose -f docker-compose.monitoring.yml up -d --force-recreate
```

### Cleanup
```bash
# Stop and remove containers
docker-compose -f docker-compose.monitoring.yml down

# Remove volumes (WARNING: destroys data)
docker-compose -f docker-compose.monitoring.yml down -v
```

## Integration with EasyFlow

### Backend Integration
The monitoring system integrates with the EasyFlow backend through:

1. **Metrics endpoint**: `/metrics` for Prometheus scraping
2. **Health endpoint**: `/health` for service status
3. **Alert webhooks**: Receive alerts from Alertmanager
4. **Firebase notifications**: Send monitoring alerts as push notifications

### Frontend Integration
The dashboard can display monitoring status:

```javascript
// Example: Fetch system status
const fetchSystemStatus = async () => {
  const response = await fetch('/api/system/status');
  return response.json();
};
```

### Automated Alerts
Critical alerts automatically trigger:
- Firebase push notifications to admin users
- Email notifications to operations team
- Webhook calls to backend for custom actions

This monitoring setup provides comprehensive visibility into the EasyFlow system's health, performance, and business metrics.