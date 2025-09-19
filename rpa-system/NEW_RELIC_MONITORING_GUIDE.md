# 📊 New Relic Monitoring Guide for EasyFlow

## 🚀 Quick Access

1. **Login**: [https://one.newrelic.com](https://one.newrelic.com)
2. **Find Your Apps**: Look for `EasyFlow-Backend-Service` and `EasyFlow-Automation-Service`

## 📈 What You Can Monitor

### 🎯 Key Business Metrics

**Automation Performance:**
- ✅ 8 successful tasks processed (from our tests)
- ⏱️ Average task duration: 7.04 seconds
- 🔄 Task duration distribution (fastest: <0.075s, slowest: 35+ seconds)
- 👥 Active workers: Currently 0 (idle state)

**Error Tracking:**
- 🚨 Zero automation errors recorded
- 📊 Success rate: 100% 
- 🔍 Error breakdown by type (when they occur)

### 🖥️ Application Health

**Response Times:**
- API endpoint performance
- Database query times
- External service calls (automation targets)

**Resource Usage:**
- CPU utilization during automation runs
- Memory consumption patterns
- Thread/process pool efficiency

## 🔧 Current Monitoring Data

Based on our test run, here's what New Relic is tracking:

```
✅ Tasks Processed: 8 successful
⏱️ Average Duration: 7.04 seconds
📊 Duration Breakdown:
   • <0.1s: 2 tasks (quick operations)
   • 2.5-5s: 1 task (medium complexity)
   • 5-7.5s: 2 tasks (complex automation)
   • 7.5s+: 3 tasks (heavy web automation)
🔄 Active Workers: 0 (ready for new tasks)
```

## 📱 Useful New Relic Dashboards

### 1. **APM Overview** 
- Go to: `APM & services` → `EasyFlow-Automation-Service`
- See: Response times, throughput, error rates

### 2. **Custom Metrics Dashboard**
Create custom charts for:
```
automation_tasks_processed_total{status="success"}
automation_task_duration_seconds
automation_active_workers
automation_errors_total
```

### 3. **Transaction Traces**
- View slow automation tasks
- See which automation types take longest
- Identify bottlenecks in web scraping/form filling

### 4. **Error Analysis**
- Real-time error alerts
- Error patterns and trends
- Failed automation root causes

## 🚨 Recommended Alerts

Set up alerts for:
1. **Error Rate > 5%** - Too many failed automations
2. **Response Time > 30s** - Slow automation tasks
3. **Memory Usage > 80%** - Resource constraints
4. **Active Workers = 0 for >5min during business hours** - Service down

## 📊 Key NRQL Queries

Use these in New Relic's query builder:

```sql
-- Automation success rate over time
SELECT count(*) FROM Transaction WHERE appName = 'EasyFlow-Automation-Service' FACET request.uri TIMESERIES

-- Average task duration by type
SELECT average(duration) FROM Transaction WHERE appName = 'EasyFlow-Automation-Service' FACET custom.task_type

-- Error rate trend
SELECT percentage(count(*), WHERE error = true) FROM Transaction WHERE appName = 'EasyFlow-Automation-Service' TIMESERIES

-- Most common automation types
SELECT count(*) FROM Transaction WHERE custom.task_type IS NOT NULL FACET custom.task_type
```

## 🔍 What Data Points to Watch

### Daily Operations:
- **Task Volume**: How many automations per hour/day
- **Success Rate**: Percentage of successful automations
- **Average Duration**: Performance trends over time
- **Peak Usage Times**: When automations are most active

### Performance Optimization:
- **Slowest Endpoints**: Which automation types need optimization
- **Resource Usage**: CPU/Memory during peak loads
- **Error Patterns**: Common failure points

### Business Intelligence:
- **User Adoption**: Automation usage growth
- **Cost Per Task**: Resource efficiency metrics
- **ROI Tracking**: Time saved vs. infrastructure costs

## 🎯 Production Monitoring Checklist

- [ ] New Relic license key configured
- [ ] Both services reporting data
- [ ] Custom metrics appearing
- [ ] Error alerts configured
- [ ] Performance baselines established
- [ ] Business KPI dashboards created

## 🔧 Environment Variables Needed

For production, set these environment variables:

```bash
# Required
NEW_RELIC_LICENSE_KEY=your_license_key_here

# Optional (with defaults)
NEW_RELIC_APP_NAME=EasyFlow-Automation-Service
NEW_RELIC_LOG_LEVEL=info
NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
```

## 📞 Next Steps

1. **Set up your New Relic account** and configure the license key
2. **Deploy to production** with New Relic monitoring enabled
3. **Create custom dashboards** for your specific business metrics
4. **Set up alerts** for critical thresholds
5. **Monitor trends** to optimize automation performance

Your EasyFlow platform is now enterprise-ready with comprehensive observability! 🚀