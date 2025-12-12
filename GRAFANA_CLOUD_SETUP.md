# Grafana Cloud Setup Guide

## Step 1: Create Grafana Cloud Account

1. Go to https://grafana.com/auth/sign-up/create-user
2. Sign up for a free account (includes 10k metrics series, 50GB logs, 50GB traces)
3. Verify your email

## Step 2: Get Your Prometheus Remote Write Credentials

1. Log into Grafana Cloud: https://grafana.com/auth/sign-in
2. Go to **My Account** → **Prometheus** (or **Connections** → **Data Sources**)
3. Find your Prometheus instance
4. Copy these values:
   - **Remote Write URL**: `https://prometheus-prod-XX.grafana.net/api/prom/push`
   - **Username**: Your Grafana Cloud username (usually a number)
   - **Password/API Key**: Generate a new API key with "MetricsPublisher" role

## Step 3: Configure Your Backend to Send Metrics

When your Render services come back up, add these environment variables to your **backend** service in Render:

```bash
# Grafana Cloud Prometheus Remote Write
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX.grafana.net/api/prom/push
GRAFANA_CLOUD_PROMETHEUS_USERNAME=your_username_here
GRAFANA_CLOUD_PROMETHEUS_API_KEY=your_api_key_here

# OpenTelemetry Collector endpoint (if using OTLP)
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-XX.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic base64(username:api_key)
```

## Step 4: Update Prometheus Configuration

The `prometheus-production.yml` file already has remote_write configuration commented out. When services are back up:

1. Uncomment the `remote_write` section
2. Set the environment variables in Render
3. Restart Prometheus service

## Step 5: Access Grafana Cloud

1. Go to https://grafana.com/auth/sign-in
2. You'll see your Grafana Cloud instance
3. Import your dashboards from `rpa-system/monitoring/grafana/dashboards/`
4. Configure Prometheus as a data source (usually auto-configured)

## Benefits

- ✅ Works independently of Render services
- ✅ Metrics are stored in Grafana Cloud (persistent)
- ✅ Can access dashboards even when services are down
- ✅ Free tier: 10k metrics, 50GB logs, 50GB traces
- ✅ Automatic scaling and high availability

