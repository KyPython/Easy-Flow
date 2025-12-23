# Environment Variables

## Required (Core)
```bash
# Supabase (REQUIRED - move from ecosystem.config.js to .env)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE=your_service_role_key

# Session Management (REQUIRED for production)
SESSION_SECRET=your-random-secret-key-here

# Node Environment
NODE_ENV=development

# Kafka
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:9092
KAFKA_BROKERS=127.0.0.1:9092
KAFKA_CLIENT_ID=easyflow-backend

# Service URLs
AUTOMATION_URL=http://127.0.0.1:7070
BACKEND_URL=http://127.0.0.1:3030
PORT=3030
```

## Optional (Development)
```bash
# Dev Bypass (local testing only)
DEV_BYPASS_TOKEN=your-secret-token
DEV_USER_ID=dev-user-123
DEV_THEME=light
DEV_LANGUAGE=en
DEV_ENABLE_NEW_BUILDER=false
DEV_ENABLE_BETA_ACTIONS=false
DEV_ALLOW_EXECUTE=false
DEV_USER_EMAIL=dev@example.com
DEV_USER_PASSWORD=dev-password

# Test Mode
ALLOW_TEST_TOKEN=false
```

## Optional (CORS & Security)
```bash
# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000
ALLOWED_ORIGIN_SUFFIXES=.vercel.app

# Supabase Storage
SUPABASE_BUCKET=artifacts
SUPABASE_USE_SIGNED_URLS=true
SUPABASE_SIGNED_URL_EXPIRES=86400
```

## Optional (Scraping/Lead Gen)
```bash
# Proxy (if using scraping)
PROXY_PROVIDER=none  # none, brightdata, oxylabs, smartproxy
BRIGHTDATA_USERNAME=your_username
BRIGHTDATA_PASSWORD=your_password

# CAPTCHA (if using scraping)
CAPTCHA_PROVIDER=none  # none, 2captcha, anticaptcha
CAPTCHA_API_KEY=your_api_key

# Scraping Settings
MAX_CONCURRENT_SCRAPES=10
DEFAULT_RATE_LIMIT=60
```

## Optional (Analytics & Integrations)
```bash
# Analytics
MIXPANEL_TOKEN=your_mixpanel_token

# HubSpot
HUBSPOT_API_KEY=your_hubspot_api_key

# Automation Service Auth
AUTOMATION_API_KEY=your_automation_api_key
```

## Optional (Monitoring & Observability)
```bash
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
DISABLE_TELEMETRY=false
```

## Optional (Execution Settings)
```bash
# Execution Control
ALLOW_DRAFT_EXECUTION=false
ENABLE_EMAIL_WORKER=true
STUCK_EXECUTION_CLEANUP_INTERVAL_MINUTES=10
STUCK_EXECUTION_MAX_AGE_MINUTES=10
```

**⚠️ IMPORTANT:** 
- Move `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, and `SUPABASE_KEY` from `ecosystem.config.js` to `.env` file
- Set `SESSION_SECRET` for production (required)
- Never commit `.env` file to git

