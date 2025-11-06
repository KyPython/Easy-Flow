# 📊 **SERVICE LEVEL OBJECTIVES (SLOs)**

**EasyFlow RPA Platform - Production SLOs**

---

## 🎯 **THE THREE CRITICAL SLOs**

Based on the observability audit, these are the three most critical metrics for reliable operation:

---

### **SLO #1: Process Execution Success Rate**

**What it measures:** The percentage of automation processes that complete successfully

**Why it matters:** This is the primary value proposition - automations must work reliably

**Definition:**
```
Success Rate = (Successful Automations / Total Automations) * 100
```

**Target:** > 99.5% (28-day rolling window)

**Error Budget:** 0.5% = ~216 failed automations per month (assuming 1,440 runs/day)

**Alert Thresholds:**
- **Warning:** < 99% for 15 minutes
- **Critical:** < 98% for 5 minutes

**Grafana Query:**
```promql
# Success rate (last 28 days)
(
  sum(rate(automation_tasks_processed_total{status="success"}[28d]))
  /
  sum(rate(automation_tasks_processed_total[28d]))
) * 100

# Error budget burn rate (last 1 hour)
(1 - 
  sum(rate(automation_tasks_processed_total{status="success"}[1h]))
  /
  sum(rate(automation_tasks_processed_total[1h]))
) / 0.005  # 0.5% error budget
```

**Response Actions:**
1. **< 99%:** Review failed automation logs, identify common failures
2. **< 98%:** Page on-call engineer, investigate immediately
3. **< 95%:** Trigger incident response, notify stakeholders

---

### **SLO #2: Task Latency (P95)**

**What it measures:** How long it takes for 95% of automation tasks to complete

**Why it matters:** Users expect fast automation execution for good UX

**Definition:**
```
P95 Latency = 95th percentile of task_duration_seconds
```

**Target:** < 30 seconds (1-hour rolling window)

**Error Budget:** 5 seconds = tasks can be up to 35s before SLO violation

**Alert Thresholds:**
- **Warning:** > 35 seconds for 10 minutes
- **Critical:** > 60 seconds for 5 minutes

**Grafana Query:**
```promql
# P95 latency (last 1 hour)
histogram_quantile(0.95,
  sum(rate(automation_task_duration_seconds_bucket[1h])) by (le, task_type)
)

# By task type (for diagnosis)
histogram_quantile(0.95,
  sum(rate(automation_task_duration_seconds_bucket[1h])) by (le, task_type)
) > 30

# P50 and P99 for context
histogram_quantile(0.50, sum(rate(automation_task_duration_seconds_bucket[1h])) by (le))
histogram_quantile(0.99, sum(rate(automation_task_duration_seconds_bucket[1h])) by (le))
```

**Response Actions:**
1. **> 35s:** Check for slow database queries, external API latency
2. **> 60s:** Investigate thread pool saturation, resource constraints
3. **> 120s:** Scale worker services, optimize critical paths

---

### **SLO #3: API Availability**

**What it measures:** The percentage of API requests that complete successfully (non-error responses)

**Why it matters:** The platform must be accessible for users to create and run automations

**Definition:**
```
Availability = (Successful HTTP Requests / Total HTTP Requests) * 100
Successful = HTTP 2xx + 3xx responses
Failed = HTTP 5xx responses (4xx are client errors, not counted)
```

**Target:** > 99.9% (28-day rolling window)

**Error Budget:** 0.1% = ~43 minutes of downtime per month

**Alert Thresholds:**
- **Warning:** < 99.5% for 5 minutes
- **Critical:** < 99% for 2 minutes

**Grafana Query:**
```promql
# Availability (last 28 days)
(
  sum(rate(http_server_requests_total{status_code=~"2..|3.."}[28d]))
  /
  sum(rate(http_server_requests_total[28d]))
) * 100

# Error rate by endpoint (for diagnosis)
sum(rate(http_server_requests_total{status_code=~"5.."}[5m])) by (http_route, http_method)
/
sum(rate(http_server_requests_total[5m])) by (http_route, http_method)
* 100

# Error budget burn rate
(1 - 
  sum(rate(http_server_requests_total{status_code=~"2..|3.."}[1h]))
  /
  sum(rate(http_server_requests_total[1h]))
) / 0.001  # 0.1% error budget
```

**Response Actions:**
1. **< 99.5%:** Check service health, review error logs
2. **< 99%:** Page on-call engineer, check infrastructure
3. **< 98%:** Trigger incident response, potential rollback

---

## 📈 **SECONDARY METRICS (INFORMATIONAL)**

These metrics provide context but don't have strict SLO targets:

### **Database Query Performance**
- **P95 Query Latency:** < 100ms (informational)
- **Slow Queries:** > 500ms (alert for optimization)

### **External API Latency**
- **OpenAI API P95:** < 5 seconds (informational)
- **Webhook Response Time:** < 2 seconds (informational)

### **Resource Utilization**
- **Worker Thread Pool Usage:** < 80% (warning threshold)
- **Kafka Consumer Lag:** < 1000 messages (alert threshold)
- **Memory Usage:** < 85% (warning threshold)

---

## 🔔 **ALERTING STRATEGY**

### **Multi-Window, Multi-Burn-Rate Alerts**

**Fast Burn (2% of error budget in 1 hour):**
- Page immediately
- Critical impact

**Slow Burn (10% of error budget in 6 hours):**
- Notify on-call
- Potential degradation

**Example for SLO #1 (Process Success Rate):**
```promql
# Fast burn: 2% of 28-day error budget in 1 hour
# Error budget = 0.5% = 0.005
# Fast burn threshold = 0.005 * 0.02 = 0.0001 (0.01%)
(1 - 
  sum(rate(automation_tasks_processed_total{status="success"}[1h]))
  /
  sum(rate(automation_tasks_processed_total[1h]))
) > 0.0001

# Slow burn: 10% of error budget in 6 hours
(1 - 
  sum(rate(automation_tasks_processed_total{status="success"}[6h]))
  /
  sum(rate(automation_tasks_processed_total[6h]))
) > 0.0005
```

---

## 📊 **SLO DASHBOARD STRUCTURE**

### **Panel 1: SLO Summary (Top)**
- **Display:** Big Number
- **Metrics:** All 3 SLOs with status (green/yellow/red)
- **Time Range:** Last 28 days

### **Panel 2: Error Budget Consumption**
- **Display:** Gauge
- **Shows:** % of error budget used
- **Time Range:** Current month

### **Panel 3: SLO Trend**
- **Display:** Time Series
- **Shows:** SLO compliance over time with target line
- **Time Range:** Last 7 days

### **Panel 4: Error Budget Burn Rate**
- **Display:** Time Series
- **Shows:** Current burn rate vs. acceptable burn rate
- **Time Range:** Last 24 hours

---

## 🎯 **SLO REVIEW PROCESS**

### **Weekly SLO Review**
**When:** Every Monday, 10 AM
**Who:** Engineering team + Product owner
**Agenda:**
1. Review last week's SLO compliance
2. Analyze any SLO violations
3. Identify trends and patterns
4. Action items for improvement

### **Monthly SLO Adjustment**
**When:** First Monday of the month
**Who:** Engineering leadership
**Agenda:**
1. Review 28-day SLO performance
2. Assess if targets are appropriate
3. Adjust error budgets if needed
4. Plan investments in reliability

---

## 📚 **SLO INCIDENT RESPONSE RUNBOOK**

### **When SLO Violation Alert Fires:**

#### **Step 1: Acknowledge (Within 5 minutes)**
- Acknowledge alert in PagerDuty/Grafana
- Post in #incidents Slack channel

#### **Step 2: Assess (Within 10 minutes)**
- Open Grafana SLO dashboard
- Identify which SLO is violated
- Check error budget burn rate
- Determine severity:
  - **SEV1:** Multiple SLOs violated OR error budget > 50% consumed
  - **SEV2:** Single SLO violated
  - **SEV3:** Warning threshold crossed

#### **Step 3: Investigate (Immediately)**

**For SLO #1 (Process Success Rate):**
1. Open Grafana Explore → Search for failed automation traces
2. Filter by `status="failed"` in last 1 hour
3. Check error types: `automation_errors_total` by `error_type`
4. Review structured logs for stack traces
5. Common causes:
   - Browser automation timeouts
   - External site changes (selectors broken)
   - Database connection issues
   - Kafka message processing errors

**For SLO #2 (Task Latency):**
1. Open Grafana → Database Query Performance panel
2. Check for slow queries: `db.supabase.duration_ms > 500`
3. Check OpenAI API latency: `openai.duration_ms`
4. Review thread pool utilization
5. Common causes:
   - Database query optimization needed
   - External API slowness (OpenAI)
   - Resource constraints (CPU/memory)
   - Large data payloads

**For SLO #3 (API Availability):**
1. Open Grafana → Error Rate by Endpoint panel
2. Filter for HTTP 5xx responses
3. Check service health endpoint: `GET /health`
4. Review infrastructure metrics (CPU, memory, disk)
5. Common causes:
   - Database connection pool exhausted
   - Service crash/restart
   - Infrastructure issues (Render platform)
   - Third-party service outage (Supabase, Kafka)

#### **Step 4: Mitigate (Target: < 30 minutes)**

**Immediate Actions:**
- Rollback recent deployment (if deployed within last 2 hours)
- Scale worker services (if resource constrained)
- Restart failed services
- Enable circuit breakers for failing dependencies

**Communication:**
- Post status update in #incidents every 15 minutes
- Update status page if customer-facing impact

#### **Step 5: Resolve & Document**
- Verify SLO returns to compliance
- Create post-incident review document
- Schedule post-mortem meeting (within 48 hours)
- Add prevention measures to backlog

---

## 🔧 **SLO TUNING GUIDELINES**

### **When to Tighten SLOs (Make Stricter):**
- Consistently exceeding targets for 3+ months
- Preparing for enterprise customers
- Compliance requirements (SOC 2, ISO 27001)

### **When to Relax SLOs (Make Easier):**
- Burning error budget too fast (> 50% by mid-month)
- Targets unrealistic given architecture
- Team spending too much time on incidents

### **How to Change:**
1. Propose change in monthly SLO review
2. Run simulation: Would we have met new SLO last quarter?
3. Update target in dashboard
4. Update alert thresholds
5. Document change in SLO history

---

## 📊 **EXAMPLE GRAFANA DASHBOARD JSON**

```json
{
  "dashboard": {
    "title": "EasyFlow Production SLOs",
    "panels": [
      {
        "id": 1,
        "title": "Process Success Rate (SLO #1)",
        "targets": [
          {
            "expr": "(sum(rate(automation_tasks_processed_total{status=\"success\"}[28d])) / sum(rate(automation_tasks_processed_total[28d]))) * 100",
            "legendFormat": "Success Rate"
          }
        ],
        "thresholds": [
          { "value": 99.5, "color": "green" },
          { "value": 99, "color": "yellow" },
          { "value": 98, "color": "red" }
        ]
      },
      {
        "id": 2,
        "title": "Task Latency P95 (SLO #2)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(automation_task_duration_seconds_bucket[1h])) by (le))",
            "legendFormat": "P95 Latency"
          }
        ],
        "thresholds": [
          { "value": 30, "color": "green" },
          { "value": 35, "color": "yellow" },
          { "value": 60, "color": "red" }
        ]
      },
      {
        "id": 3,
        "title": "API Availability (SLO #3)",
        "targets": [
          {
            "expr": "(sum(rate(http_server_requests_total{status_code=~\"2..|3..\"}[28d])) / sum(rate(http_server_requests_total[28d]))) * 100",
            "legendFormat": "Availability"
          }
        ],
        "thresholds": [
          { "value": 99.9, "color": "green" },
          { "value": 99.5, "color": "yellow" },
          { "value": 99, "color": "red" }
        ]
      }
    ]
  }
}
```

---

## 🎉 **EXPECTED OUTCOMES**

**After 30 days of SLO monitoring:**

✅ **Proactive issue detection:** Catch problems before users report them
✅ **Data-driven decisions:** Prioritize work based on error budget
✅ **Faster incident resolution:** Clear metrics guide troubleshooting
✅ **Customer confidence:** Transparent reliability metrics
✅ **Engineering focus:** Invest in areas that matter most

---

## 📅 **SLO IMPLEMENTATION TIMELINE**

### **Week 1: Baseline (Current Week)**
- [x] Deploy instrumentation
- [ ] Collect 7 days of baseline data
- [ ] Identify current performance levels

### **Week 2: Target Setting**
- [ ] Analyze baseline data
- [ ] Set initial SLO targets
- [ ] Create SLO dashboard
- [ ] Configure basic alerts

### **Week 3: Refinement**
- [ ] Monitor alert noise
- [ ] Adjust thresholds
- [ ] Add secondary metrics
- [ ] Document runbooks

### **Week 4: Full Operation**
- [ ] Conduct first SLO review
- [ ] Test incident response
- [ ] Train team on SLOs
- [ ] Publish to stakeholders

---

**Status:** Ready for baseline data collection after Grafana connection verified! 🚀
