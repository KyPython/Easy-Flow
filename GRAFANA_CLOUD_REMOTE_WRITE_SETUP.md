# Grafana Cloud Remote Write Setup

## Step 1: Choose "From my local Prometheus server"

In Grafana Cloud, select this option (not Grafana Alloy).

## Step 2: Get Your Credentials

After selecting "From my local Prometheus server", Grafana Cloud will show you:

1. **Remote Write URL** - Looks like:
   ```
   https://prometheus-prod-XX.grafana.net/api/prom/push
   ```

2. **Username** - Your Grafana Cloud username (usually a number)

3. **Password** - Generate an API token with "MetricsPublisher" role

## Step 3: Save These Credentials

Copy and save these values. You'll need them for Render environment variables:

```bash
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX.grafana.net/api/prom/push
GRAFANA_CLOUD_PROMETHEUS_USERNAME=your_username_here
GRAFANA_CLOUD_PROMETHEUS_API_KEY=your_api_key_here
```

## Step 4: Update prometheus-production.yml

Uncomment and update the `remote_write` section in:
`rpa-system/monitoring/prometheus-production.yml`

**Current (commented out):**
```yaml
# remote_write:
#   - url: ${GRAFANA_CLOUD_PROMETHEUS_URL}
#     basic_auth:
#       username: ${GRAFANA_CLOUD_PROMETHEUS_USERNAME}
#       password: ${GRAFANA_CLOUD_PROMETHEUS_API_KEY}
```

**After uncommenting:**
```yaml
remote_write:
  - url: ${GRAFANA_CLOUD_PROMETHEUS_URL}
    basic_auth:
      username: ${GRAFANA_CLOUD_PROMETHEUS_USERNAME}
      password: ${GRAFANA_CLOUD_PROMETHEUS_API_KEY}
    write_relabel_configs:
      - source_labels: [__name__]
        regex: 'easyflow_.*'
        action: keep
```

## Step 5: Add to Render (When Services Come Back)

Add these as environment variables to your **backend** service in Render:

1. Go to Render Dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add:
   - `GRAFANA_CLOUD_PROMETHEUS_URL` = (your remote write URL)
   - `GRAFANA_CLOUD_PROMETHEUS_USERNAME` = (your username)
   - `GRAFANA_CLOUD_PROMETHEUS_API_KEY` = (your API key)

## Step 6: Deploy and Verify

1. Push your changes to GitHub (updated prometheus-production.yml)
2. Render will auto-deploy
3. Go to Grafana Cloud → Explore
4. Query: `up`
5. You should see your services appear!

## Alternative: Test Locally First

If you want to test before deploying to Render:

1. Set environment variables locally:
   ```bash
   export GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX.grafana.net/api/prom/push
   export GRAFANA_CLOUD_PROMETHEUS_USERNAME=your_username
   export GRAFANA_CLOUD_PROMETHEUS_API_KEY=your_api_key
   ```

2. Run Prometheus with production config:
   ```bash
   cd rpa-system/monitoring
   prometheus --config.file=prometheus-production.yml
   ```

3. Check Grafana Cloud - metrics should appear within 30 seconds

