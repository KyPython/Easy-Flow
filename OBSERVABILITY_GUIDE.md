# EasyFlow Observability Stack - Complete Guide

## 🎯 What Is This System For?

Your observability stack gives you **three superpowers** to understand your application:

1. **📊 Metrics** - "What numbers are changing?" (Performance, counts, rates)
2. **🔍 Traces** - "What path did this request take?" (Flow through services)
3. **📝 Logs** - "What happened and why?" (Detailed context)

---

## 🚀 Quick Start: Finding Your Workflow Issue

### **Your Problem:**
Workflows show "NO_STEPS_EXECUTED" error. Here's how to diagnose it:

### **Step 1: Check if Backend is Healthy**
Open: **http://localhost:9091/metrics**

**What to look for:**
```
# HELP up The service is up
up 1
```

If you see this, metrics are working! If the page loads but is empty, telemetry didn't initialize.

---

### **Step 2: Query Metrics in Prometheus**
Open: **http://localhost:9090**

**Useful Queries:**

| Query | What It Shows | What You Want to See |
|-------|---------------|----------------------|
| `up` | Which services are alive | All services = 1 |
| `http_requests_total` | Total HTTP requests | Number increasing when you use app |
| `http_request_duration_seconds` | Request latency | P95 < 1 second |
| `process_cpu_seconds_total` | CPU usage | Steady, not spiking to 100% |
| `nodejs_heap_size_used_bytes` | Memory usage | Not constantly growing |

**Try this right now:**
1. Click "Graph" tab
2. Enter: `http_requests_total{path="/execute"}`
3. Click "Execute"
4. **What you should see:** A counter that goes up each time you run a workflow

**If it's 0 or doesn't exist:** Your backend isn't exporting metrics properly.

---

### **Step 3: View Logs in Grafana**
Open: **http://localhost:3001** (login: admin/admin)

#### **A. Set Up Log Exploration:**
1. Click hamburger menu (☰) → "Explore"
2. At top, select data source: **"Loki"**
3. Click "Label filters" → Add filter:
   - **Label:** `service`
   - **Value:** `rpa-system-backend`

#### **B. Search for Your Workflow:**
In the query builder, add:
```
{service="rpa-system-backend"} |= "318b436c-51dd-40da-ab23-e7af7ab75438"
```
(Replace with your actual execution_id from the error)

**What you should see:**
- Logs showing the entire workflow execution flow
- Trace IDs to correlate with traces
- Error messages with full context

**If logs are empty:** Backend logs aren't being scraped by Promtail.

---

### **Step 4: Trace the Request Flow**
#### **A. Find Trace ID from Logs:**
From your error:
```
"traceId": "bb1a1d6a689ba82b693ec04794a0c102"
```

#### **B. View Trace in Grafana:**
1. In Grafana, click "Explore"
2. Select data source: **"Tempo"**
3. In "Query" field, enter: `bb1a1d6a689ba82b693ec04794a0c102`
4. Click "Run query"

**What you should see:**
```
┌─ POST /execute (1.5s)
│  ├─ Database: Get workflow (0.1s)
│  ├─ Kafka: Publish task (0.05s)
│  └─ workflow.execute.New Workflow (1.3s) <- This is missing!
│     ├─ Step 1 execution (0.5s)
│     └─ Step 2 execution (0.8s)
```

**In your case:** The `workflow.execute` span is probably missing, proving `executeWorkflow` is never called.

---

## 📊 Setting Up Your Dashboard

### **Create "Workflow Health" Dashboard:**

1. **Grafana** → "+" → "Create Dashboard"
2. Add these panels:

#### **Panel 1: Workflow Execution Rate**
```promql
rate(http_requests_total{path="/execute"}[5m])
```
**What it shows:** Workflows per second

---

#### **Panel 2: Workflow Success/Failure Split**
```promql
sum by (status) (
  rate(workflow_executions_total[5m])
)
```
**What it shows:** Success vs failure rate

---

#### **Panel 3: Workflow Duration (P95)**
```promql
histogram_quantile(0.95, 
  rate(workflow_execution_duration_seconds_bucket[5m])
)
```
**What it shows:** 95th percentile execution time

---

#### **Panel 4: Active Executions**
```promql
workflow_executions_active
```
**What it shows:** How many workflows are running right now

---

## 🔍 How to Diagnose Your Current Issue

### **Workflow Execution Checklist:**

| Check | How to Verify | Status |
|-------|---------------|--------|
| **1. Backend is running** | `curl http://localhost:3030/health` | ✅ Working |
| **2. Telemetry initialized** | Check for logs: `✅ OpenTelemetry initialized` | ❌ Missing (Node.js) |
| **3. Prometheus scraping** | `up{job="backend"}` in Prometheus = 1 | ❓ Unknown |
| **4. Kafka connected** | Backend log: `✅ Kafka producer connected` | ✅ Working |
| **5. Workflow has steps** | Query DB: `SELECT * FROM workflow_steps WHERE workflow_id='...'` | ❓ Unknown |
| **6. executeWorkflow called** | Search logs for: `executeWorkflow: About to create span` | ❌ Not found |

---

## 🐛 Debugging Workflow Execution

### **The Three-Layer Approach:**

#### **Layer 1: Metrics (High-Level Health)**
**Question:** "Is the system accepting requests?"
```promql
# Are requests coming in?
rate(http_requests_total{path="/execute"}[1m])

# Are they succeeding?
rate(http_requests_total{path="/execute",status="200"}[1m])
```

---

#### **Layer 2: Logs (What's Happening)**
**Question:** "What is the code doing?"
```
# In Grafana Explore → Loki
{service="rpa-system-backend"} 
  |= "POST /execute" 
  | json 
  | execution_id=~".+"
```

**Look for:**
- ✅ "Received workflow execution request"
- ✅ "Workflow found in database"
- ✅ "Kafka message published"
- ❌ **MISSING:** "executeWorkflow: About to create span"

---

#### **Layer 3: Traces (Request Flow)**
**Question:** "Where is the request spending time?"
1. Get trace_id from log
2. Query Tempo
3. Look at the span tree

**What you'll see in a working execution:**
```
POST /execute (2s)
├─ supabase.query (100ms) ← Get workflow
├─ kafka.publish (50ms)   ← Queue task
└─ workflow.execute (1.8s)
   ├─ step.1.http (500ms)
   └─ step.2.transform (1.3s)
```

**What you're seeing now:**
```
POST /execute (1.5s)
└─ [ends here - no child spans]
```

---

## 📈 Advanced Queries

### **Find Slow Workflows:**
```promql
# Workflows taking > 5 seconds
count(
  workflow_execution_duration_seconds > 5
)
```

### **Error Rate Over Time:**
```promql
sum(rate(workflow_executions_total{status="failed"}[5m]))
/
sum(rate(workflow_executions_total[5m]))
* 100
```

### **Most Common Errors:**
```
# In Grafana → Loki
{service="rpa-system-backend"} 
  |= "ERROR" 
  | json 
  | error_category != ""
```

---

## 🎯 Immediate Actions for Your Issue

### **1. Verify Telemetry Initialization:**
```bash
# Check if port 9091 is free
lsof -ti:9091

# If occupied, kill it
lsof -ti:9091 | xargs kill -9

# Restart backend
./stop-dev.sh && ./start-dev.sh
```

### **2. Check Backend Metrics Endpoint:**
```bash
curl http://localhost:9091/metrics | head -20
```

**Expected output:**
```
# HELP nodejs_version_info Node.js version info.
# TYPE nodejs_version_info gauge
nodejs_version_info{version="v20.19.5"} 1
```

### **3. Verify Workflow Data:**
```bash
# Check if workflow has steps in Supabase
# Go to Supabase Dashboard → SQL Editor
SELECT 
  w.id, 
  w.name, 
  COUNT(ws.id) as step_count,
  json_array_length(w.canvas_config::json->'nodes') as canvas_nodes
FROM workflows w
LEFT JOIN workflow_steps ws ON ws.workflow_id = w.id
WHERE w.id = '57b50ac6-81bf-415a-9816-34d170348e37'
GROUP BY w.id, w.name, w.canvas_config;
```

**Expected:** `step_count` or `canvas_nodes` > 0

---

## 🚨 Common Issues & Solutions

| Problem | Cause | Fix |
|---------|-------|-----|
| No metrics in Prometheus | Port 9091 blocked | Kill process on 9091, restart backend |
| No logs in Loki | Promtail not scraping | Check `docker logs easyflow-promtail` |
| No traces in Tempo | OTEL not initialized | Check backend startup logs for errors |
| "No data" in Grafana | Wrong time range | Set to "Last 15 minutes" |
| Workflow fails instantly | `executeWorkflow` not called | Check if OpenTelemetry span creation fails |

---

## 📚 Learning Path

### **Level 1: Health Checks**
- ✅ Is backend up? (`curl /health`)
- ✅ Are metrics exposed? (`curl :9091/metrics`)
- ✅ Can Prometheus scrape? (`up` query)

### **Level 2: Basic Monitoring**
- Track request rate (`http_requests_total`)
- Monitor error rate (`http_requests_total{status=~"5.."`)
- Watch latency (`http_request_duration_seconds`)

### **Level 3: Deep Debugging**
- Correlate logs with traces (trace_id)
- Find root cause spans (slow queries, errors)
- Analyze resource usage (CPU, memory, Kafka lag)

---

## 🎓 Resources

- **Prometheus Queries:** https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Grafana Tutorials:** https://grafana.com/tutorials/
- **OpenTelemetry Tracing:** https://opentelemetry.io/docs/concepts/signals/traces/

---

## 💡 Your Current Status

**What's Working:**
- ✅ Observability stack running (Grafana, Prometheus, Tempo, OTEL)
- ✅ Python automation worker telemetry
- ✅ Backend responding to requests

**What's Broken:**
- ❌ Node.js backend telemetry not initializing (port 9091 conflict)
- ❌ Backend logs not appearing (Pino output issue)
- ❌ `executeWorkflow` not being called (span never created)

**Next Steps:**
1. Free port 9091 → Restart backend → Verify metrics appear
2. Run workflow → Get trace_id → Query Tempo
3. Compare working trace (with spans) vs broken trace (without)
4. Find where code path diverges before `executeWorkflow`
