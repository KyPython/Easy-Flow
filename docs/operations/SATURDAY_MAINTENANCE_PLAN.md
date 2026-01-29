# EasyFlow Saturday Maintenance Plan

## Overview

EasyFlow is designed to run 24/7 with minimal operator intervention. This document outlines the procedures, infrastructure, and support systems required to maintain the system with only **4 hours of maintenance time on Saturdays**.

## System Requirements

### 24/7 Operations Goals
- **Uptime Target**: 99.9% (maximum 8.76 hours downtime/year)
- **Self-Healing**: Automatic recovery from common failures
- **Customer Support**: Week-based support (Monday-Friday)
- **Maintenance Window**: Saturday, 4 hours maximum

### Current Infrastructure State
- **Backend**: Node.js/Express with Firebase
- **Frontend**: React SPA (rpa-system/rpa-dashboard)
- **Database**: Supabase (PostgreSQL)
- **Infrastructure**: Terraform (infrastructure/main.tf)
- **Email System**: Custom templates (rpa-system/backend/utils/emailTemplates.js)

---

## 1. Self-Healing Infrastructure

### 1.1 Health Checks & Auto-Restart

Create health check endpoints that monitoring services can poll:

```javascript
// Add to rpa-system/backend/app.js
app.get('/health', (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: databaseStatus,
    integrations: integrationsStatus
  };
  res.json(checks);
});

app.get('/health/live', (req, res) => res.send('OK'));
app.get('/health/ready', (req, res) => {
  if (databaseConnected && servicesReady) {
    res.send('OK');
  } else {
    res.status(503).send('Not Ready');
  }
});
```

### 1.2 Auto-Restart Configuration

**Process Manager (PM2) Configuration** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'easyflow-backend',
    script: 'server.js',
    instances: 2,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 3000,
    env: {
      NODE_ENV: 'production',
      PORT: 3030
    }
  }]
};
```

### 1.3 Database Connection Pooling

Configure robust connection pooling with automatic reconnection:

```javascript
// Add to rpa-system/backend/utils/supabaseClient.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 0
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Auto-reconnect logic
});
```

---

## 2. Monitoring & Alerting

### 2.1 Essential Metrics to Monitor

| Metric | Threshold | Alert Action |
|--------|-----------|--------------|
| API Response Time | > 5s (p95) | Warning |
| Error Rate | > 5% | Warning |
| Database Connections | > 80% | Warning |
| Memory Usage | > 80% | Warning |
| CPU Usage | > 80% | Warning |
| Service Down | N/A | Critical |

### 2.2 Prometheus Metrics (Add to backend)

```javascript
// rpa-system/backend/utils/prometheusMetrics.js
const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1, 5]
});
register.registerMetric(httpRequestDuration);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    httpRequestDuration.observe({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    }, (Date.now() - start) / 1000);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
```

### 2.3 Alerting Rules (Prometheus)

```yaml
# prometheus/alert-rules.yml
groups:
  - name: easyflow-alerts
    rules:
      - alert: EasyFlowDown
        expr: up{job="easyflow-backend"} == 0
        for: 1m
        annotations:
          summary: "EasyFlow backend is down"
          description: "Service has been down for more than 1 minute"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        annotations:
          summary: "High error rate detected"
```

---

## 3. Customer Support SOP

### 3.1 Week-Based Support Model

**Support Hours**: Monday-Friday, 9 AM - 5 PM (user's local time)
**Emergency Protocol**: Saturday maintenance window (4 hours)
**Response Time SLA**:
- Critical (system down): 4 hours (during business hours)
- High (features broken): 8 hours
- Normal (questions): 24 hours
- Low (feedback): 48 hours

### 3.2 Support Triage Process

```
┌─────────────────────────────────────────────────────────────┐
│                    Support Ticket Received                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Auto-Response Email Sent                        │
│  "Thanks for contacting EasyFlow Support. We'll respond     │
│   within 24 hours during business hours."                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Triage (Human)                            │
├─────────────────────────────────────────────────────────────┤
│  Category:                                                  │
│  ├── Technical Issue → Engineering (you)                    │
│  ├── Billing → Finance/Accounting                           │
│  ├── Feature Request → Product Backlog                      │
│  └── How-to → Documentation Link                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Resolution                                │
├─────────────────────────────────────────────────────────────┤
│  • Investigate (check logs, reproduce if needed)            │
│  • Fix or provide workaround                                │
│  • Document resolution                                      │
│  • Send response to customer                                │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Common Support Issues & Templates

| Issue | Template | Priority |
|-------|----------|----------|
| System Down | `support_outage.md` | Critical |
| Login Issues | `support_login.md` | High |
| Workflow Not Running | `support_workflow.md` | High |
| Billing Questions | `support_billing.md` | Normal |
| Feature Request | `support_feature.md` | Low |
| General Question | `support_general.md` | Normal |

### 3.4 Saturday Maintenance Checklist

**Pre-Maintenance (Friday, 5 PM)**:
- [ ] Check monitoring dashboard for any pending alerts
- [ ] Review error logs from past week
- [ ] Verify backup completed successfully
- [ ] Prepare any pending deployments

**During Maintenance (Saturday, 4 hours)**:
- [ ] Apply security patches
- [ ] Deploy pending updates
- [ ] Review and optimize slow queries
- [ ] Clean up temporary data
- [ ] Update SSL certificates if needed
- [ ] Test backup restore procedure
- [ ] Verify all services are healthy

**Post-Maintenance**:
- [ ] Confirm all services are running
- [ ] Check monitoring for any anomalies
- [ ] Document any issues found
- [ ] Schedule next maintenance tasks

---

## 4. Email Templates for Customer Support

### 4.1 Outage Notification Template

```javascript
// Add to rpa-system/backend/utils/emailTemplates.js
function getOutageNotificationEmail(data = {}) {
  const { estimatedDuration, affectedSystems, startTime } = data;
  const subject = '⚠️ EasyFlow Service Outage Notification';
  
  const html = `
    <h2>Service Outage Update</h2>
    <p>We experienced a service interruption starting at ${startTime}.</p>
    <p><strong>Affected Systems:</strong> ${affectedSystems.join(', ')}</p>
    <p><strong>Estimated Resolution:</strong> ${estimatedDuration}</p>
    <p>Our team is working to restore full service as quickly as possible.</p>
    <p>Thank you for your patience.</p>
  `;
  
  return { subject, html, text: `Outage notification: ${affectedSystems.join(', ')} - ETA: ${estimatedDuration}` };
}
```

### 4.2 Support Response Templates

```javascript
function getSupportResponseEmail(data = {}) {
  const { ticketNumber, category, name } = data;
  
  const templates = {
    'technical': {
      subject: `EasyFlow Support: Ticket #${ticketNumber} - Technical Issue`,
      response: `Hi ${name},\n\nThank you for reaching out about this technical issue. I'm investigating this now and will provide an update within 4 hours during business hours.\n\nIn the meantime, you may want to:\n1. Check our status page at https://status.tryeasyflow.com\n2. Review our documentation at https://docs.tryeasyflow.com\n\nBest regards,\nEasyFlow Support Team`
    },
    'billing': {
      subject: `EasyFlow Support: Ticket #${ticketNumber} - Billing Question`,
      response: `Hi ${name},\n\nThanks for your billing question. I'll look into this and respond within 8 business hours.\n\nFor urgent billing matters, please reply with your phone number and I can call you.\n\nBest regards,\nEasyFlow Support Team`
    },
    'feature': {
      subject: `EasyFlow Support: Ticket #${ticketNumber} - Feature Request`,
      response: `Hi ${name},\n\nThanks for the feature suggestion! I've added it to our product roadmap for consideration.\n\nWe prioritize features based on customer demand, so your input is valuable.\n\nBest regards,\nEasyFlow Support Team`
    }
  };
  
  return templates[category] || templates['technical'];
}
```

### 4.3 Maintenance Window Notification

```javascript
function getMaintenanceNotificationEmail(data = {}) {
  const { startTime, duration, affectedFeatures } = data;
  const subject = '🔧 Scheduled Maintenance Notice';
  
  const html = `
    <h2>Scheduled Maintenance</h2>
    <p>We'll be performing scheduled maintenance on EasyFlow.</p>
    <ul>
      <li><strong>Date:</strong> Saturday</li>
      <li><strong>Time:</strong> ${startTime} (your local time)</li>
      <li><strong>Duration:</strong> Approximately ${duration}</li>
    </ul>
    <p><strong>What this means for you:</strong></p>
    <ul>
      ${affectedFeatures.map(f => `<li>${f}</li>`).join('')}
    </ul>
    <p>All services will be fully operational after maintenance completes.</p>
  `;
  
  return { subject, html };
}
```

---

## 5. Infrastructure Finalization

### 5.1 Terraform Configuration

Update `infrastructure/main.tf` with production-ready configuration:

```terraform
# Add health check and restart policies
resource "docker_container" "easyflow_backend" {
  image = "easyflow/backend:latest"
  name  = "easyflow-backend"
  
  healthcheck {
    test     = ["CMD", "wget", "-q", "--spider", "http://localhost:3030/health"]
    interval = "30s"
    timeout  = "10s"
    retries  = 3
    start_period = "40s"
  }
  
  restart_policy = "unless-stopped"
  max_retry_count = 10
  
  upload {
    source = "./backend"
    destination = "/app"
  }
  
  command = ["sh", "-c", "node server.js"]
}
```

### 5.2 Docker Compose for Self-Healing

Update `docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    build: ./rpa-system/backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3030/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    environment:
      - NODE_ENV=production
      - PORT=3030
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 5.3 Backup & Disaster Recovery

```bash
#!/bin/bash
# scripts/backup.sh - Automated backup script

# Database backup
pg_dump $DATABASE_URL > "backups/db_$(date +%Y%m%d_%H%M%S).sql"

# Upload to cloud storage
aws s3 cp "backups/" "s3://easyflow-backups/" --recursive

# Keep only last 30 days of backups
aws s3 ls s3://easyflow-backups/ | while read -r line; do
  dateStr=$(echo "$line" | awk '{print $1" "$2}')
  fileName=$(echo "$line" | awk '{print $4}')
  fileDate=$(date -d "$dateStr" +%s)
  cutoffDate=$(date -d "-30 days" +%s)
  if [ $fileDate -lt $cutoffDate ]; then
    aws s3 rm "s3://easyflow-backups/$fileName"
  fi
done
```

---

## 6. Saturday Maintenance Schedule

### Weekly Tasks (Every Saturday, ~4 hours)

| Time | Task | Duration |
|------|------|----------|
| 0:00 | Review monitoring alerts | 15 min |
| 0:15 | Check backup status | 15 min |
| 0:30 | Apply security updates | 60 min |
| 1:30 | Deploy pending changes | 60 min |
| 2:30 | Performance optimization | 30 min |
| 3:00 | Documentation review | 30 min |
| 3:30 | Health check & testing | 30 min |

### Monthly Tasks (First Saturday, +2 hours)

| Task | Duration |
|------|----------|
| SSL certificate audit | 15 min |
| Cost analysis review | 30 min |
| Security audit | 45 min |
| Disaster recovery test | 30 min |

---

## 7. Documentation Checklist

- [ ] **Runbook**: How to restart services, check logs, handle common issues
- [ ] **Architecture Diagram**: System components and data flow
- [ ] **Contact List**: Emergency contacts (yourself, hosting provider, etc.)
- [ ] **API Documentation**: All internal and external APIs
- [ ] **Database Schema**: Key tables and relationships
- [ ] **Environment Variables**: All required env vars with descriptions
- [ ] **Deployment Procedures**: Step-by-step deployment guide

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | Monthly |
| MTTR (Mean Time to Recovery) | < 30 min | Per incident |
| Support Response Time | < 4 hours | SLA |
| Saturday Maintenance Duration | < 4 hours | Weekly |

---

## Summary

This plan enables EasyFlow to run 24/7 with:
- **Self-healing**: Auto-restart, health checks, monitoring
- **Week-based support**: Templates and SOPs for Monday-Friday support
- **Minimal maintenance**: 4-hour Saturday window for updates
- **Documentation**: Complete runbook for operators

**Implementation Status** (Updated 2026-01-28):
- [x] Health check endpoints (`/health`, `/health/live`, `/health/ready`)
- [x] Prometheus metrics (business KPIs exporter)
- [x] Support email templates (outage, maintenance, support response)
- [x] PM2 production configuration (auto-restart, memory limits, cluster mode)
- [x] Docker Compose health checks and restart policies
- [x] Backup script (`scripts/backup.sh`)
- [ ] Terraform configuration updates (pending)
- [ ] Disaster recovery test procedure (pending)

**Related Files**:
- `rpa-system/backend/app.js` - Health endpoints
- `rpa-system/backend/utils/emailTemplates.js` - Email templates
- `rpa-system/backend/utils/prometheusMetrics.js` - Prometheus metrics
- `ecosystem.config.js` - PM2 configuration
- `docker-compose.yml` - Container orchestration
- `scripts/backup.sh` - Automated backup script

**Notion Documentation**:
- See "⚡ DAILY OPERATIONS" > "🔧 EasyFlow Saturday Maintenance Plan" in Notion for SOPs and checklists
