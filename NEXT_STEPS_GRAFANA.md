# 🚀 Next Steps: Grafana Cloud Integration - Quick Action Guide

**Status:** Backend critical fixes deployed ✅ | Waiting for traces to appear ⏳

---

## ✅ STEP 1: Update Service Names in Render (CRITICAL)

The service name mismatch is preventing traces from appearing. The code is configured correctly to use environment variables, but they need to be set.

### Action Required:
1. Go to **Render Dashboard** → Your backend service
2. Navigate to **Environment** tab
3. **Add or Update** these variables:

```bash
# For rpa-system-backend service:
OTEL_SERVICE_NAME=easyflow-backend

# For automation-service (Python worker):
OTEL_SERVICE_NAME=easyflow-worker
```

4. **Save Changes** → This will trigger automatic redeploy
5. Wait 2-3 minutes for redeploy to complete

---

## ⏳ STEP 2: Wait and Verify (5-10 minutes)

After the redeploy completes:

1. **Check Render Logs** for confirmation:
   ```
   ✅ [Telemetry] Service Name: easyflow-backend
   ✅ [Telemetry] OTEL Exporters: ACTIVE
   ```

2. **Go to Grafana Cloud**:
   - Navigate to **Connections** → **Your Apps** → **Application Observability**
   - Or use the direct link from the setup wizard
   - Click **"Test connection"** button

3. **If traces appear** ✅:
   - Congratulations! Observability is working
   - You should see service "easyflow-backend" in the list
   - Click on it to see trace data

4. **If NO traces after 10 minutes** ⚠️:
   - Check the troubleshooting steps below

---

## 🐛 STEP 3: Troubleshooting (If Traces Don't Appear)

### Check 1: Verify Environment Variables
```bash
# SSH into Render or check environment tab
echo $OTEL_SERVICE_NAME  # Should print "easyflow-backend"
echo $OTEL_EXPORTER_OTLP_ENDPOINT  # Should print Grafana OTLP URL
echo $OTEL_EXPORTER_OTLP_HEADERS  # Should start with "Authorization=Basic"
```

### Check 2: Verify Logs Show OTEL Active
Look for these lines in Render logs:
```
✅ [Telemetry] OpenTelemetry backend instrumentation initialized successfully
✅ [Telemetry] Service Name: easyflow-backend
✅ [Telemetry] OTLP Endpoint: https://otlp-gateway-prod-us-east-2.grafana.net/otlp
✅ [Telemetry] OTEL Exporters: ACTIVE
```

If you see these, telemetry is working. The issue is with Grafana Cloud receiving data.

### Check 3: Test with Manual Request
Trigger a workflow or API call to generate traces:
```bash
# From your local machine or Postman
curl -X GET https://easyflow-backend-ad8e.onrender.com/health
```

Check Render logs for the request, then check Grafana again after 2 minutes.

### Check 4: Verify Grafana Cloud API Key
- Go to **Grafana Cloud** → **Configuration** → **API Keys**
- Verify the key you're using has **Traces Publisher** role
- Regenerate the key if unsure
- Update `OTEL_EXPORTER_OTLP_HEADERS` in Render with new key

### Check 5: Network/Firewall Issues
Render should have no issues reaching Grafana Cloud, but verify:
```bash
# SSH into Render instance (if possible) or check logs
curl -v https://otlp-gateway-prod-us-east-2.grafana.net/otlp
# Should get a response (even if 404/405), proving connectivity
```

---

## 🎯 STEP 4: Once Traces Appear - Define SLOs

After confirming traces are flowing:

1. **Go to Grafana Cloud** → **Alerting** → **SLOs**
2. **Create 3 SLOs** as defined in the audit report:

### SLO 1: Process Execution Success Rate
```
Query: rate(automation_tasks_processed_total{status="success"}[5m]) / rate(automation_tasks_processed_total[5m])
Target: > 99.5%
Alert: < 99.0%
```

### SLO 2: Task Processing Latency (P95)
```
Query: histogram_quantile(0.95, rate(automation_task_duration_seconds_bucket[5m]))
Target: < 30 seconds
Alert: > 45 seconds
```

### SLO 3: API Gateway Availability
```
Query: (sum(rate(http_server_duration_count{status_code!~"5.."}[5m])) / sum(rate(http_server_duration_count[5m]))) * 100
Target: > 99.9%
Alert: < 99.5%
```

---

## 📊 STEP 5: Create Dashboards

### Pre-built Dashboards Available:
1. **APM Dashboard** - Comes with Grafana Cloud Application Observability
2. **Custom EasyFlow Dashboard** - Import from `Dashboard JSON.json` in repo root

### To Import Custom Dashboard:
1. Go to **Dashboards** → **Import**
2. Upload `/Users/ky/Desktop/GitHub/VS_Code/EasyFlow/Easy-Flow-clean/Dashboard JSON.json`
3. Select your Prometheus and Tempo data sources
4. Click **Import**

---

## 🔧 STEP 6: Remaining Implementation Tasks

These are **optional enhancements** - the core observability is functional:

### Frontend OpenTelemetry SDK (Optional)
**Priority:** Medium | **Effort:** ~2 hours

```bash
cd rpa-system/rpa-dashboard
npm install @opentelemetry/web @opentelemetry/instrumentation-fetch @opentelemetry/exporter-trace-otlp-http
```

Create `src/telemetry.js`:
```javascript
import { WebTracerProvider } from '@opentelemetry/web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new WebTracerProvider();
const exporter = new OTLPTraceExporter({
  url: import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces',
  headers: {
    Authorization: import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS
  }
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

registerInstrumentations({
  instrumentations: [new FetchInstrumentation()]
});
```

Then import in `src/main.jsx` before ReactDOM.render.

### Webhook Root Span Generation (Optional)
**Priority:** Medium | **Effort:** ~30 minutes

Edit `/rpa-system/backend/routes/webhookRoutes.js`:
```javascript
const { trace } = require('@opentelemetry/api');

router.post('/webhooks/:hookId', async (req, res) => {
  const tracer = trace.getTracer('webhook-handler');
  
  // Create root span for webhook (since external webhooks have no trace context)
  await tracer.startActiveSpan('webhook.receive', async (span) => {
    try {
      span.setAttribute('webhook.id', req.params.hookId);
      span.setAttribute('webhook.source', req.get('user-agent') || 'unknown');
      
      // ... existing webhook processing logic ...
      
      // Inject trace ID into response header
      res.set('X-Trace-ID', span.spanContext().traceId);
      
      span.setStatus({ code: 1 }); // OK
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message }); // ERROR
      throw err;
    } finally {
      span.end();
    }
  });
});
```

### RPA Step Spans (Optional)
**Priority:** Low | **Effort:** ~1 hour

Add spans to `/rpa-system/automation/automation-service/generic_scraper.py`:
```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def scrape_web_page(url, task_data):
    with tracer.start_as_current_span('browser.navigate') as span:
        span.set_attribute('url', url)
        # ... navigation logic ...
    
    with tracer.start_as_current_span('browser.extract_data') as span:
        # ... data extraction logic ...
    
    with tracer.start_as_current_span('browser.close') as span:
        # ... cleanup logic ...
```

---

## 📞 Support Contacts

**If you're stuck:**
- **Grafana Cloud Docs:** https://grafana.com/docs/grafana-cloud/send-data/otlp/
- **OpenTelemetry Docs:** https://opentelemetry.io/docs/
- **Render Logs:** https://dashboard.render.com → Your Service → Logs

**Common Issues & Quick Fixes:**
1. **"Cannot find module @opentelemetry/..."** → Run `npm install` in backend folder
2. **"OTEL_EXPORTER_OTLP_HEADERS not set"** → Check Render environment variables
3. **"traces not appearing"** → Wait 5-10 minutes, traces are batched/delayed
4. **"service name mismatch"** → Verify `OTEL_SERVICE_NAME` in Render matches Grafana query

---

## ✅ Success Criteria

You'll know observability is fully operational when:

1. ✅ Grafana Cloud shows service "easyflow-backend" in Application Observability
2. ✅ Traces show complete journey: API Request → Kafka → Python Worker
3. ✅ Logs in Grafana Loki include `trace_id`, `user_id`, `workflow_id` fields
4. ✅ Metrics in Grafana show `automation_tasks_processed_total` with labels
5. ✅ SLO dashboard shows green (all targets met)

---

**Current Status:** Waiting for Render redeploy with updated `OTEL_SERVICE_NAME` ⏳

**Next Action:** Update environment variables in Render dashboard, then wait 10 minutes.
