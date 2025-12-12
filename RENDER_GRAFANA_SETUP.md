# Self-Hosted Grafana on Render.com Setup

## Option 2: Deploy Grafana on Render.com

This option requires your Render services to be running, but gives you full control.

## Step 1: Add Grafana Service to render.yaml

Add this to your existing `render.yaml`:

```yaml
services:
  # ... your existing services ...
  
  # Grafana Service
  - type: web
    name: easyflow-grafana
    runtime: docker
    region: oregon
    plan: starter
    dockerfilePath: ./rpa-system/monitoring/grafana/Dockerfile
    dockerContext: ./rpa-system/monitoring/grafana
    envVars:
      - key: GF_SECURITY_ADMIN_USER
        value: admin
      - key: GF_SECURITY_ADMIN_PASSWORD
        sync: false  # Set this securely in Render dashboard
      - key: GF_SERVER_ROOT_URL
        fromService:
          type: web
          name: easyflow-grafana
          property: host
      - key: GF_SERVER_DOMAIN
        fromService:
          type: web
          name: easyflow-grafana
          property: host
      - key: ENVIRONMENT
        value: production
    healthCheckPath: /api/health

  # Prometheus Service (optional - only if not using Grafana Cloud)
  - type: web
    name: easyflow-prometheus
    runtime: docker
    region: oregon
    plan: starter
    dockerfilePath: ./rpa-system/monitoring/prometheus/Dockerfile
    dockerContext: ./rpa-system/monitoring
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: PROMETHEUS_CONFIG_FILE
        value: /etc/prometheus/prometheus-production.yml
    command:
      - '--config.file=$(PROMETHEUS_CONFIG_FILE)'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'
```

## Step 2: Deploy to Render

1. Push your changes to GitHub
2. Render will automatically detect the new services
3. Set the `GF_SECURITY_ADMIN_PASSWORD` in Render dashboard (Environment tab)
4. Wait for services to deploy

## Step 3: Access Grafana

1. Go to your Render dashboard
2. Find the `easyflow-grafana` service
3. Click on the URL (e.g., `https://easyflow-grafana.onrender.com`)
4. Login with:
   - Username: `admin`
   - Password: (the one you set in Render)

## Step 4: Configure Data Sources

Grafana will auto-provision Prometheus if both services are in the same Render environment. Otherwise:

1. Go to **Configuration** → **Data Sources**
2. Add Prometheus
3. URL: `http://easyflow-prometheus:9090` (internal) or your Prometheus URL

## Limitations

- ⚠️ Requires Render services to be running
- ⚠️ Grafana will be unavailable if Render services are down
- ⚠️ Data is stored on Render (may be lost if service is deleted)

