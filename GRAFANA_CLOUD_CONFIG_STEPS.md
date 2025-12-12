# Grafana Cloud Configuration Steps

## Step 1: Choose Use Case
Select: **"Send metrics from a single Prometheus instance"**

This is the most common setup and matches your configuration.

## Step 2: Configure Remote Write
Select: **"Directly"** (not "Via Grafana Alloy")

This uses standard Prometheus remote_write, which matches your `prometheus-production.yml`.

## Step 3: Generate API Token

1. Click **"Use an API token"**
2. **Token name**: `EasyFlow Prometheus Remote Write` (or any descriptive name)
3. **Expiration date**: 
   - Choose "No expiry" for production
   - Or set a long expiration (e.g., 365 days)
4. **Scopes**: 
   - Look for `set:alloy-data-write` or `MetricsPublisher`
   - This gives permission to write metrics
5. Click **"Create token"**

## Step 4: Copy the Configuration

Grafana Cloud will show you a configuration block that looks like:

```yaml
remote_write:
  - url: https://prometheus-prod-XX.grafana.net/api/prom/push
    basic_auth:
      username: 123456
      password: glc_eyJvIjoiMTIzNDU2IiwibiI6ImVhc3lmbG93IiwiaSI6IjEyMzQ1NiIsImsiOiJhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eiJ9
```

**Save these values:**
- `url` → This is your `GRAFANA_CLOUD_PROMETHEUS_URL`
- `username` → This is your `GRAFANA_CLOUD_PROMETHEUS_USERNAME`
- `password` → This is your `GRAFANA_CLOUD_PROMETHEUS_API_KEY`

## Step 5: Update Your Configuration

Once you have the credentials, update `rpa-system/monitoring/prometheus-production.yml`:

**Find this section (currently commented):**
```yaml
# remote_write:
#   - url: ${GRAFANA_CLOUD_PROMETHEUS_URL}
#     basic_auth:
#       username: ${GRAFANA_CLOUD_PROMETHEUS_USERNAME}
#       password: ${GRAFANA_CLOUD_PROMETHEUS_API_KEY}
```

**Uncomment and it will work:**
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

## Step 6: Add to Render (When Services Come Back)

Add these environment variables to your **backend** service in Render:

1. Go to Render Dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add:
   - `GRAFANA_CLOUD_PROMETHEUS_URL` = (the URL from step 4)
   - `GRAFANA_CLOUD_PROMETHEUS_USERNAME` = (the username from step 4)
   - `GRAFANA_CLOUD_PROMETHEUS_API_KEY` = (the password/token from step 4)

## Step 7: Deploy and Verify

1. Push your updated `prometheus-production.yml` to GitHub
2. Render will auto-deploy
3. Go to Grafana Cloud → **Explore**
4. Query: `up`
5. Your services should appear within 30-60 seconds!

## Important Notes

- ✅ The API token you generate is the **password** in the config
- ✅ Keep the token secure - don't commit it to Git
- ✅ Use Render's environment variables for secrets
- ✅ The configuration uses environment variables, so it's safe to commit

