# Fix OTLP Authorization Header Issue on Render

## Problem
The `OTEL_EXPORTER_OTLP_HEADERS` environment variable on Render contains quotes around the Authorization value, causing the error:
```
Invalid character in header content ["Authorization"]
```

## Root Cause
When you set the environment variable in Render's dashboard, you likely entered it with quotes like:
```
Authorization="Basic <token>"
```

But the value stored by Render INCLUDES those quotes, so it becomes:
```
"Basic <token>"
```

When Node.js tries to set this as an HTTP header, it fails because quotes are invalid in header values.

## Solution

### Step 1: Go to Render Dashboard
1. Go to https://dashboard.render.com
2. Select your `easyflow-backend` service
3. Click on "Environment" tab

### Step 2: Find and Edit OTEL_EXPORTER_OTLP_HEADERS
Look for the variable `OTEL_EXPORTER_OTLP_HEADERS`

### Step 3: Check Current Value
The current value probably looks like:
```
Authorization="Basic <your-base64-token>"
```

### Step 4: Remove Quotes
Change it to (WITHOUT any quotes):
```
Authorization=Basic <your-base64-token>
```

**IMPORTANT:** 
- No quotes at all
- No quotes around the entire value
- No quotes around "Basic"
- No quotes around the token

The format should be exactly:
```
Authorization=Basic MTIzNDU2Nzg5MDpzb21lLXRva2VuLWhlcmU=
```

### Step 5: Save and Redeploy
1. Click "Save Changes"
2. Render will automatically redeploy your service
3. Wait for deployment to complete

## Verification
After redeployment, check the logs. You should see:
- `[Telemetry] Raw OTEL_EXPORTER_OTLP_HEADERS:` - showing your value WITHOUT quotes
- `[Telemetry] Contains quotes? false` - confirming no quotes
- NO more `Invalid character in header content` errors
- Traces and metrics successfully exporting to Grafana Cloud

## Alternative: Use Render CLI
If you prefer command line:
```bash
render config:set OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic YOUR_TOKEN_HERE"
```

Note: The quotes in the CLI command are for the shell, not part of the value.

## Why Our Code Fixes Didn't Work
Our parseHeaders() function strips quotes, but:
1. The HTTP instrumentation intercepts the OTLP exporter's requests
2. It serializes the headers object before our parsing can clean it
3. By the time it reaches Node's HTTP client, the quotes are already in the serialized string

The only real fix is to ensure the environment variable never has quotes in the first place.

## Test Your Token Format
Your Authorization header should be:
```
Basic <base64-encoded-string>
```

Where `<base64-encoded-string>` is your Grafana Cloud instance ID and API token encoded in base64:
```
echo -n "instance_id:api_token" | base64
```

Example (with fake credentials):
```
Authorization=Basic MTIzNDU2OmFiY2RlZg==
```
