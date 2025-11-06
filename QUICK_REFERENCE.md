# 🚀 EasyFlow Observability - Quick Reference Card

## 📌 Current Status
- ✅ **Backend Code:** Fully instrumented and deployed
- ✅ **Python Worker:** Fully instrumented and deployed
- ⏳ **Grafana Cloud:** Waiting for service name update and trace verification
- 📅 **Optional Enhancements:** Frontend SDK, Webhook spans, RPA step spans

---

## 🔧 IMMEDIATE ACTION REQUIRED

### **Step 1: Update Render Environment Variables** ⚠️ CRITICAL
**Why:** Service name mismatch preventing traces from appearing in Grafana.

**Action:**
1. Go to **Render Dashboard** → `rpa-system-backend` service → **Environment** tab
2. Add/Update:
   ```
   OTEL_SERVICE_NAME=easyflow-backend
   ```
3. Go to **Render Dashboard** → `automation-service` (Python worker) → **Environment** tab
4. Add/Update:
   ```
   OTEL_SERVICE_NAME=easyflow-worker
   OTEL_TRACE_SAMPLING_RATIO=1.0
   ```
5. Save → Wait 3 minutes for auto-redeploy

### **Step 2: Verify in Grafana Cloud** ⏳ WAIT 10 MINUTES
1. Go to **Grafana Cloud** → **Application Observability**
2. Click **"Test connection"** button
3. Look for service: **"easyflow-backend"**
4. If traces appear ✅ → Success! Move to Step 3
5. If no traces after 10 min ⚠️ → See Troubleshooting below

### **Step 3: Define SLOs** 📊 RECOMMENDED
Once traces appear, create 3 SLOs in Grafana:
1. **Process Success Rate** > 99.5%
2. **Task Latency P95** < 30 seconds
3. **API Availability** > 99.9%

*(Full queries in `OBSERVABILITY_AUDIT_COMPLETE.md` → Section: Recommended Strategic SLOs)*

---

## 🐛 Troubleshooting

### Problem: "No traces in Grafana after 10 minutes"
**Check:**
1. Render logs show: `✅ OTEL Exporters: ACTIVE`?
2. Environment variable `OTEL_SERVICE_NAME` = `easyflow-backend`?
3. `OTEL_EXPORTER_OTLP_HEADERS` starts with `Authorization=Basic`?
4. Generated traffic by triggering a workflow or API call?

**Solution:** If all above are YES, check Grafana Cloud API key validity.

### Problem: "Traces stop at Kafka boundary"
**Check:**
1. Python logs show: `📨 Extracted trace context from Kafka headers`?
2. Kafka message includes `traceparent` header?

**Solution:** Verify `OTEL_INITIALIZED = True` in Python startup logs.

### Problem: "Logs missing user_id"
**Check:**
1. Task payload includes `user_id` and `workflow_id` fields?
2. Python logs show `user_id=<value>` prefix?

**Solution:** Update Kafka producer to include user context in message payload.

---

## 📚 Key Documents

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **OBSERVABILITY_AUDIT_COMPLETE.md** | Comprehensive audit findings | ✅ Read first - understand gaps |
| **NEXT_STEPS_GRAFANA.md** | Grafana Cloud setup guide | ⏳ Read now - action items |
| **OBSERVABILITY_IMPLEMENTATION_SUMMARY.md** | Technical implementation details | 📖 Reference - deep dive |
| **QUICK_REFERENCE.md** | This file - quick lookup | 🚀 Keep open - cheat sheet |

---

## 🔗 Important Links

**Grafana Cloud:**
- **Dashboard:** https://grafana.com
- **Application Observability:** Connections → Your Apps → Application Observability
- **Explore (Traces):** Menu → Explore → Tempo
- **Explore (Logs):** Menu → Explore → Loki

**Render:**
- **Backend Service:** https://dashboard.render.com → rpa-system-backend
- **Worker Service:** https://dashboard.render.com → automation-service
- **Logs:** Click service → **Logs** tab

**Documentation:**
- **OpenTelemetry:** https://opentelemetry.io/docs/
- **Grafana Cloud:** https://grafana.com/docs/grafana-cloud/

---

## 📊 Key Queries

### Find Trace by ID
```
Grafana → Explore → Tempo
Query: {trace_id="<YOUR_TRACE_ID>"}
```

### Find Slow Workflows
```
Grafana → Explore → Tempo
Query: {resource.workflow_id="<ID>"} | duration > 30s
```

### Calculate Success Rate
```
Grafana → Explore → Prometheus
Query: 
(sum(rate(automation_tasks_processed_total{status="success"}[1h])) / sum(rate(automation_tasks_processed_total[1h]))) * 100
```

### Find Errors by User
```
Grafana → Explore → Prometheus
Query: 
sum by (user_id) (automation_errors_total)
```

---

## ✅ Success Checklist

- [ ] Updated `OTEL_SERVICE_NAME` in Render (both services)
- [ ] Waited 10 minutes after redeploy
- [ ] Traces appear in Grafana Cloud for "easyflow-backend"
- [ ] Traces show full journey: API → Kafka → Worker
- [ ] Logs include `trace_id`, `user_id`, `workflow_id` fields
- [ ] Metrics show `automation_tasks_processed_total` with labels
- [ ] Created 3 SLOs in Grafana Cloud
- [ ] Tested trace lookup with customer workflow

**When all checked ✅ → Observability is fully operational! 🎉**

---

## 💡 Pro Tips

1. **Use trace_id for support:** When customer reports issue, ask for trace_id from response headers
2. **Filter by user:** Use `{resource.user_id="<ID>"}` in Tempo to see all user's workflows
3. **Monitor SLOs daily:** First week, check dashboards daily to establish baseline
4. **Reduce sampling after 1 week:** Change `OTEL_TRACE_SAMPLING_RATIO` from `1.0` to `0.1` to save costs
5. **Create alerts:** Set up Slack/PagerDuty alerts for SLO violations

---

## 🆘 Emergency Contacts

**If observability stops working:**
1. Check Render service health: https://status.render.com
2. Check Grafana Cloud status: https://status.grafana.com
3. Review recent code changes: `git log --oneline -10`
4. Verify environment variables haven't been overwritten
5. Check Grafana Cloud API key hasn't expired

---

*Quick Reference Card v1.0 - Last Updated: November 6, 2025*
