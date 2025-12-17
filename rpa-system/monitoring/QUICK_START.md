# Quick Alert Setup

**Your Info (Already Configured):**
- Email: kyjahntsmith@gmail.com
- Phone: 203-449-4970 (SMS via email-to-SMS gateways)

## One-Time Setup

1. **Get Gmail App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Generate app password for "Mail"
   - Copy the 16-character password

2. **Edit `alertmanager.yml`:**
   - Find line 10: `smtp_auth_password: 'YOUR_GMAIL_APP_PASSWORD_HERE'`
   - Replace `YOUR_GMAIL_APP_PASSWORD_HERE` with your app password

3. **Restart Alertmanager:**
```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

## Test Alerts

```bash
curl -X POST http://localhost:9093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "critical"},
    "annotations": {"summary": "Test", "description": "Testing alerts"}
  }]'
```

You should receive email + SMS within seconds!

## View Alerts

- Prometheus: http://localhost:9090/alerts
- Alertmanager: http://localhost:9093
- Grafana: http://localhost:3001

## What You'll Get Alerts For

- 🚨 **Critical:** MRR drops, zero signups, very low activation rates
- ⚠️ **Warning:** Signup drops, low conversion rates, no workflows created

