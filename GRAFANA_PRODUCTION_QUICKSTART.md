# Grafana Production Quick Start

## ✅ Yes, you can set up Grafana in production even if Render services are down!

## Recommended: Grafana Cloud (5 minutes)

### Step 1: Sign Up
1. Go to https://grafana.com/auth/sign-up/create-user
2. Create a free account

### Step 2: Get Credentials
1. Log in to Grafana Cloud
2. Go to **Connections** → **Prometheus**
3. Copy:
   - Remote Write URL
   - Username
   - API Key (create one with "MetricsPublisher" role)

### Step 3: Configure When Services Come Back
Add these to your **backend** service environment variables in Render:

```bash
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX.grafana.net/api/prom/push
GRAFANA_CLOUD_PROMETHEUS_USERNAME=your_username
GRAFANA_CLOUD_PROMETHEUS_API_KEY=your_api_key
```

### Step 4: Enable Remote Write
Uncomment the `remote_write` section in `rpa-system/monitoring/prometheus-production.yml`:

```yaml
remote_write:
  - url: ${GRAFANA_CLOUD_PROMETHEUS_URL}
    basic_auth:
      username: ${GRAFANA_CLOUD_PROMETHEUS_USERNAME}
      password: ${GRAFANA_CLOUD_PROMETHEUS_API_KEY}
```

### Step 5: Access Dashboards
1. Go to https://grafana.com/auth/sign-in
2. Your dashboards will appear once metrics start flowing
3. Import dashboards from `rpa-system/monitoring/grafana/dashboards/`

## Alternative: Self-Hosted on Render

See `RENDER_GRAFANA_SETUP.md` for full instructions.

**Note**: This requires Render services to be running.

## Benefits of Grafana Cloud

- ✅ **Works independently** - Access dashboards even when Render is down
- ✅ **Free tier** - 10k metrics, 50GB logs, 50GB traces
- ✅ **No infrastructure** - Fully managed by Grafana
- ✅ **Persistent storage** - Metrics stored in cloud
- ✅ **High availability** - 99.9% uptime SLA

## Next Steps

1. **Now**: Sign up for Grafana Cloud and get credentials
2. **When services are back**: Add environment variables to Render
3. **Deploy**: Push changes and restart services
4. **Monitor**: Access dashboards in Grafana Cloud

