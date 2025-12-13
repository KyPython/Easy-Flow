# EasyFlow Observability System - Complete Guide

**📌 Single Source of Truth for Monitoring & Debugging**

---

## 🎯 What Is This System For?

Your observability stack gives you **three superpowers** to understand your application in real-time:

1. **📊 Metrics** - Numbers that change (performance, counts, rates)
2. **🔍 Traces** - Request paths through services (distributed tracing)
3. **📝 Logs** - Detailed event context (what happened and why)

**Think of it like this:**
- **Metrics** tell you there's a problem
- **Logs** tell you what the problem is
- **Traces** tell you where the problem is happening

---

## 🚀 Quick Start

### Starting the System
```bash
./start-dev.sh
```

This **ONE COMMAND** starts everything:
- ✅ Kafka & Zookeeper (message broker)
- ✅ Backend API (Node.js on port 3030)
- ✅ Frontend (React on port 3000)
- ✅ Automation Worker (Python on port 7070)
- ✅ **Prometheus** (metrics - port 9090)
- ✅ **Grafana** (dashboards - port 3001)
- ✅ **Loki** (log aggregation - port 3100)
- ✅ **Promtail** (log collector)
- ✅ **Tempo** (distributed tracing - port 3200)
- ✅ **OTEL Collector** (telemetry ingestion - ports 4317/4318)
- ✅ **Alertmanager** (alerts - port 9093)

### Stopping the System
```bash
./stop-dev.sh
```

Stops **everything** including observability stack, verifies ports are free.

---

## 🔍 Troubleshooting Workflows (Your Current Issue)

### Problem: "Workflow completed but no steps executed"

**What's happening:**
1. Frontend sends workflow execution request
2. Backend receives it and publishes task to Kafka
3. Automation worker should consume the task
4. **But**: Worker isn't getting the tasks from Kafka

### Step-by-Step Debugging

#### 1. Check Backend Metrics
Open: http://localhost:9091/metrics

**Look for:**
```
# Backend is exporting metrics
up 1

# Workflows are being attempted
workflow_execution_total 75

# But steps aren't executing
workflow_step_execution_total 0  # <-- This should be > 0!
```

#### 2. Check Prometheus Targets
Open: http://localhost:9090/targets

**Verify all targets are "UP":**
- ✅ easyflow-backend (localhost:9091)
- ✅ otel-collector (localhost:8889)
- ✅ node-exporter
- ✅ cadvisor

If backend shows "DOWN", metrics aren't being exported properly.

#### 3. Query Workflow Traces in Grafana
Open: http://localhost:3001

**Navigate to:** Dashboards → Workflow Execution Observability

**What you should see:**
- Execution traces with parent-child spans
- Each trace should show: `backend.execute` → `kafka.produce` → `worker.consume` → `workflow.step.execute`

**If traces are missing spans:**
- Missing `kafka.produce` = Backend isn't publishing to Kafka
- Missing `worker.consume` = Worker isn't connected to Kafka
- Missing `workflow.step.execute` = Worker connected but not processing

#### 4. Check Logs in Loki
In Grafana, go to: **Explore** → Select "Loki" datasource

**Query examples:**
```logql
# All backend errors
{job="easyflow-backend"} |= "ERROR"

# Workflow execution errors
{job="easyflow-backend"} |= "Workflow marked as completed but no steps executed"

# Kafka connection errors
{job="easyflow-automation"} |= "kafka" |= "error"

# Trace a specific execution
{job="easyflow-backend"} |= "execution_id" |= "318b436c-51dd-40da-ab23-e7af7ab75438"
```

**What to look for in your case:**
```json
{
  "msg": "❌ Workflow marked as completed but no steps executed",
  "trace": {
    "traceId": "bb1a1d6a689ba82b693ec04794a0c102",
    "userId": "1196aa93-a166-43f7-8d21-16676a82436e"
  },
  "error": {
    "workflow_id": "57b50ac6-81bf-415a-9816-34d170348e37",
    "steps_total": 2,
    "steps_executed": 0
  }
}
```

Then search automation worker logs for that `traceId`:
```logql
{job="easyflow-automation"} |= "bb1a1d6a689ba82b693ec04794a0c102"
```

If **no results**, the trace context isn't propagating to the worker → Kafka headers issue.

---

## 📊 Key Dashboards

### 1. Workflow Execution Observability
**URL:** http://localhost:3001/d/workflow-execution

**Panels:**
- **Execution Rate** - Workflows per minute
- **P95 Duration** - 95th percentile execution time
- **Execution Duration Over Time** - Scatter plot of all executions
- **Trace View** - Parent-child span relationships

**Use this when:** You want to see why workflows are failing or slow.

### 2. Backend Metrics Dashboard
**URL:** http://localhost:3001/d/backend-metrics

**Panels:**
- **HTTP Request Rate** - Requests per second
- **Error Rate** - % of failed requests
- **Latency Heatmap** - Distribution of response times
- **Memory Usage** - Node.js heap size
- **CPU Usage** - Process CPU percentage

**Use this when:** Backend seems slow or unresponsive.

### 3. System Overview
**URL:** http://localhost:3001/d/system-overview

**Panels:**
- **Container CPU** - Docker container resource usage
- **Container Memory** - RAM usage per container
- **Network I/O** - Traffic in/out
- **Disk I/O** - Read/write operations

**Use this when:** Checking if infrastructure is the bottleneck.

---

## 🔧 Common Queries

### Prometheus (http://localhost:9090)

```promql
# Service availability (should all be 1)
up

# Workflow success rate
rate(workflow_execution_total{status="success"}[5m]) / 
rate(workflow_execution_total[5m])

# P95 workflow duration
histogram_quantile(0.95, 
  rate(workflow_execution_duration_seconds_bucket[5m]))

# HTTP request latency by endpoint
http_request_duration_seconds{path="/execute"}

# Kafka consumer lag
kafka_consumer_group_lag

# Memory leak detection (should be stable, not growing)
nodejs_heap_size_used_bytes
```

### Loki (Grafana Explore)

```logql
# All errors across all services
{job=~".+"} |= "ERROR"

# Workflow execution flow for a specific user
{job=~"easyflow-.*"} 
  |= "userId" 
  |= "1196aa93-a166-43f7-8d21-16676a82436e"

# Kafka connection issues
{job="easyflow-automation"} 
  |= "kafka" 
  |~ "error|failed|timeout"

# Backend database query performance
{job="easyflow-backend"} 
  |= "query_duration_ms" 
  | json 
  | query_duration_ms > 1000

# Trace context propagation check
{job=~"easyflow-.*"} 
  | json 
  | traceId != ""
```

---

## 🏗️ Architecture

### Data Flow

```
┌─────────────┐
│  Frontend   │ (React)
│  Port 3000  │
└──────┬──────┘
       │ HTTP Requests
       ↓
┌──────────────┐      ┌──────────────┐
│   Backend    │─────→│    Kafka     │
│  Port 3030   │      │  Port 9092   │
│              │←─────│              │
│ /metrics     │      └──────┬───────┘
│  Port 9091   │             │
└──────┬───────┘             │ automation-tasks topic
       │                     ↓
       │              ┌──────────────┐
       │              │  Automation  │
       │              │   Worker     │
       │              │  Port 7070   │
       │              └──────────────┘
       │
       │ Telemetry Data (OpenTelemetry Protocol)
       ↓
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ OTEL         │─────→│  Prometheus  │      │    Tempo     │
│ Collector    │      │  Port 9090   │      │  Port 3200   │
│ 4317/4318    │      │              │      │   (traces)   │
└──────┬───────┘      └──────┬───────┘      └──────────────┘
       │                     │
       │ Logs                │ Metrics
       ↓                     ↓
┌──────────────┐      ┌──────────────┐
│    Loki      │←─────│  Promtail    │
│  Port 3100   │      │              │
└──────┬───────┘      └──────────────┘
       │                     ↑
       │                     │ Reads logs from
       │                     │ /Users/ky/Easy-Flow/logs/
       │
       └─────────────┬───────┘
                     │
                     ↓
              ┌──────────────┐
              │   Grafana    │
              │  Port 3001   │
              │  (Dashboards)│
              └──────────────┘
```

### What Each Component Does

| Component | Purpose | When You Need It |
|-----------|---------|------------------|
| **Prometheus** | Stores time-series metrics | Check performance trends |
| **Grafana** | Visualizes everything | See dashboards, query logs/traces |
| **Loki** | Stores logs | Debug errors, search events |
| **Promtail** | Collects logs from files | Automatic (always running) |
| **Tempo** | Stores distributed traces | See request flow through services |
| **OTEL Collector** | Receives telemetry data | Automatic (middleware between app & storage) |
| **Alertmanager** | Routes alerts | Get notified of issues (future use) |

---

## 📝 Logging Best Practices

### All logs MUST follow this structure:

```javascript
// ✅ GOOD - Structured logging with trace context
logger.error('Workflow execution failed', {
  error: {
    execution_id: executionId,
    workflow_id: workflowId,
    error_category: 'NO_STEPS_EXECUTED',
    steps_total: workflow.steps.length,
    steps_executed: 0
  },
  trace: {
    traceId: req.traceId,
    spanId: req.spanId,
    userId: req.user.id
  },
  business: {
    workflow_name: workflow.name,
    user_email: req.user.email
  }
});

// ❌ BAD - Console.log with no context
console.log('Workflow failed');

// ❌ BAD - Missing trace context
logger.error('Workflow failed', { workflowId });
```

### Why This Matters

**With proper logging:**
1. User sees: "Workflow execution failed. Please try again."
2. You search Loki for `execution_id` → find the error log
3. Copy the `traceId` → search Tempo for that trace
4. See the entire request flow and which step failed

**Without proper logging:**
1. User sees: "Workflow execution failed."
2. You search logs → 100 generic "Workflow failed" messages
3. No way to find the specific failure
4. Hours of debugging

---

## 🎓 Understanding the "No Steps Executed" Issue

### The Problem

Your logs show:
```json
{
  "msg": "❌ Workflow marked as completed but no steps executed",
  "error": {
    "steps_total": 2,
    "steps_executed": 0
  }
}
```

### The Flow (What SHOULD Happen)

1. **Frontend** sends POST `/execute` with `workflow_id`
2. **Backend** receives request, creates `execution_id` in database
3. **Backend** publishes Kafka message to `automation-tasks` topic:
   ```json
   {
     "execution_id": "318b436c-51dd-40da-ab23-e7af7ab75438",
     "workflow_id": "57b50ac6-81bf-415a-9816-34d170348e37",
     "user_id": "1196aa93-a166-43f7-8d21-16676a82436e",
     "steps": [...]
   }
   ```
4. **Automation Worker** (Python) consumes message from Kafka
5. **Worker** processes each step, updates execution status in database
6. **Backend** polls database, sees steps completed, returns success

### What's Happening (The Bug)

Based on your logs:
1. ✅ Frontend sends request
2. ✅ Backend receives request, creates execution record
3. ✅ Backend publishes to Kafka (you'd see Kafka errors otherwise)
4. ❌ **Worker isn't consuming the message**
5. ⏱️ Backend timeout (5 seconds), marks execution as failed
6. ❌ Frontend shows "Workflow execution failed"

### Why Worker Isn't Consuming

From your logs:
```
[automation:err] kafka.coordinator - INFO - Successfully joined group automation-workers
[automation:err] kafka.consumer.subscription_state - INFO - Updated partition assignment: []
```

**The partition assignment is empty!** This means:
- Worker connected to Kafka ✅
- Worker joined consumer group ✅
- **But**: No partitions were assigned to this consumer ❌

**Root cause:** Kafka topic `automation-tasks` either:
1. Doesn't exist yet
2. Exists but has no partitions
3. Has partitions but they're assigned to a different consumer group member

### How to Fix It

```bash
# 1. Check if topic exists
docker exec -it easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --list

# 2. Describe the topic
docker exec -it easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --describe --topic automation-tasks

# Expected output:
# Topic: automation-tasks    PartitionCount: 1    ReplicationFactor: 1

# 3. If topic doesn't exist, create it
docker exec -it easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --create --topic automation-tasks --partitions 1 --replication-factor 1

# 4. Check consumer group
docker exec -it easy-flow-kafka-1 kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group automation-workers

# Expected output shows partitions assigned to consumers
```

### Verifying the Fix

After creating the topic, check worker logs:
```bash
tail -f logs/automation-worker.log
```

You should see:
```
Updated partition assignment: [TopicPartition(topic='automation-tasks', partition=0)]
Setting newly assigned partitions {TopicPartition...} for group automation-workers
```

Then run a workflow and check Loki:
```logql
{job="easyflow-automation"} |= "Processing workflow execution"
```

---

## 🚨 Consumer-Friendly Error Messages

### Current vs. Improved

| Current (Developer Message) | Improved (Consumer Message) | When to Show Details |
|-----------------------------|------------------------------|----------------------|
| "Workflow completed but no steps executed. Check if Kafka and the automation worker are running." | "Workflow failed to start. Our system is having trouble processing automations right now. Please try again in a few minutes." | Never show to consumers |
| "apiTracker.addAttribute is not a function" | "Something went wrong loading your workflows. Please refresh the page." | Never show to consumers |
| "Query timeout" | "Taking longer than expected. Please refresh the page." | Never show to consumers |

### Implementation

In `/rpa-system/backend/src/middleware/errorHandler.js`:

```javascript
// Consumer-friendly error messages
const CONSUMER_FRIENDLY_ERRORS = {
  'NO_STEPS_EXECUTED': {
    message: 'Your workflow failed to start. Please try again.',
    userAction: 'If this persists, contact support.',
    statusCode: 500
  },
  'KAFKA_CONNECTION_ERROR': {
    message: 'Service temporarily unavailable. Please try again in a moment.',
    userAction: 'Check our status page for updates.',
    statusCode: 503
  },
  'DATABASE_TIMEOUT': {
    message: 'Request timed out. Please try again.',
    userAction: null,
    statusCode: 504
  }
};

// Return consumer message in API response
res.status(error.statusCode).json({
  error: CONSUMER_FRIENDLY_ERRORS[error.category].message,
  action: CONSUMER_FRIENDLY_ERRORS[error.category].userAction,
  executionId: error.execution_id // For support tickets
});

// But log full technical details
logger.error('Workflow execution failed', {
  error: {
    category: 'NO_STEPS_EXECUTED',
    execution_id: executionId,
    kafka_status: 'disconnected',
    worker_status: 'no_partitions_assigned',
    // ... all technical details
  }
});
```

---

## ✅ System Health Checklist

Use this to verify everything is working:

### 1. Infrastructure
- [ ] `docker ps` shows all containers running
- [ ] `http://localhost:9090/targets` - all targets UP
- [ ] `http://localhost:3001` - Grafana loads
- [ ] `http://localhost:9091/metrics` - Backend metrics available

### 2. Application
- [ ] `http://localhost:3000` - Frontend loads
- [ ] `http://localhost:3030/health` - Backend healthy
- [ ] `http://localhost:7070/health` - Worker healthy

### 3. Messaging
- [ ] Kafka topic exists: `docker exec easy-flow-kafka-1 kafka-topics --list`
- [ ] Worker has partition assigned: Check `logs/automation-worker.log`

### 4. Observability
- [ ] Metrics flowing: Query `up` in Prometheus
- [ ] Logs flowing: Query `{job=~".+"}` in Grafana Explore (Loki)
- [ ] Traces flowing: Check "Workflow Execution Observability" dashboard

### 5. End-to-End
- [ ] Create workflow in UI
- [ ] Execute workflow
- [ ] Check execution appears in dashboard
- [ ] Check trace shows all spans (backend → kafka → worker → steps)
- [ ] Check logs show execution lifecycle

---

## 🆘 Getting Help

### Debug Checklist

When asking for help, include:

1. **Observability links:**
   - Grafana dashboard screenshot
   - Prometheus query results
   - Loki log snippet

2. **Identifiers:**
   - `execution_id` (from failed workflow)
   - `traceId` (from logs)
   - `workflow_id`

3. **Logs:**
   ```bash
   # Last 50 lines of each service
   tail -50 logs/backend.log
   tail -50 logs/automation-worker.log
   tail -50 logs/frontend.log
   ```

4. **System state:**
   ```bash
   docker ps
   docker exec easy-flow-kafka-1 kafka-topics --list
   docker exec easy-flow-kafka-1 kafka-consumer-groups --list
   ```

---

## 📚 Additional Resources

- **OpenTelemetry Docs:** https://opentelemetry.io/docs/
- **Prometheus Query Language:** https://prometheus.io/docs/prometheus/latest/querying/basics/
- **LogQL (Loki Queries):** https://grafana.com/docs/loki/latest/logql/
- **TraceQL (Tempo Queries):** https://grafana.com/docs/tempo/latest/traceql/

---

**Last Updated:** 2025-12-13  
**Version:** 1.0.0
