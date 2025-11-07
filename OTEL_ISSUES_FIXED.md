# OpenTelemetry Issues Analysis & Fixes

**Date:** 2025-11-06
**Issue:** 401 Unauthorized error when sending traces to Grafana Cloud

---

## 🔍 Root Cause Analysis

### Primary Issue
**401 Unauthorized - "authentication error: invalid token"**

The OpenTelemetry OTLP exporter was failing to authenticate with Grafana Cloud because:

1. ❌ **Invalid or expired credentials** in `OTEL_EXPORTER_OTLP_HEADERS`
2. ❌ **No credential validation** before attempting to send data
3. ❌ **Poor error handling** - errors were logged but not clearly identified
4. ❌ **No verification tool** to test credentials before deployment

### Error Log Analysis

```
2025-11-06T03:23:44.707531337Z
{"stack":"OTLPExporterError: Unauthorized\n    at IncomingMessage.<anonymous>
  (/opt/render/project/src/rpa-system/backend/node_modules/@opentelemetry/otlp-exporter-base/build/src/platform/node/util.js:103:39)\n
  ...","message":"Unauthorized","name":"OTLPExporterError",
  "data":"{\"status\":\"error\",\"error\":\"authentication error: invalid token\"}",
  "code":"401"}
```

**Translation:** The OTLP exporter tried to send traces but Grafana Cloud rejected them due to invalid authentication token.

---

## ✅ Fixes Implemented

### 1. Added Environment Variable Configuration

**Files Modified:**
- `rpa-system/backend/.env` (lines 36-58)
- `.env.example` (lines 69-87)

**Changes:**
```bash
# Added OpenTelemetry configuration section
OTEL_SERVICE_NAME=rpa-system-backend
SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-east-2.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-token>
OTEL_TRACE_SAMPLING_RATIO=1.0
```

**Impact:**
- ✅ Credentials now configurable via environment variables
- ✅ Clear documentation on where to get credentials
- ✅ Template available for new developers

### 2. Enhanced Error Handling in telemetryInit.js

**File:** `rpa-system/backend/middleware/telemetryInit.js`

#### Change 2a: Credential Validation (lines 42-70)

**Before:**
```javascript
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
});
```

**After:**
```javascript
// Validate credentials before creating exporters
const hasValidCredentials = () => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS;

  if (!endpoint || !headers) return false;

  // Check for placeholder values
  if (endpoint.includes('your-grafana') || endpoint.includes('your-actual')) {
    return false;
  }

  if (headers.includes('your-base64') || headers.includes('your-actual')) {
    return false;
  }

  return true;
};

if (!hasValidCredentials()) {
  console.warn('⚠️  [Telemetry] OpenTelemetry exporters disabled - credentials not configured');
  console.warn('⚠️  [Telemetry] To enable Grafana Cloud integration, set:');
  console.warn('    - OTEL_EXPORTER_OTLP_ENDPOINT');
  console.warn('    - OTEL_EXPORTER_OTLP_HEADERS');
}
```

**Impact:**
- ✅ App won't crash if credentials are missing
- ✅ Clear warning messages for developers
- ✅ Prevents placeholder values from being used

#### Change 2b: Added Timeout Configuration (lines 72-88)

**Before:**
```javascript
const traceExporter = new OTLPTraceExporter({
  url: ...,
  headers: ...
});
```

**After:**
```javascript
const traceExporter = new OTLPTraceExporter({
  url: ...,
  headers: ...,
  timeoutMillis: 10000  // 10 second timeout
});

const metricExporter = new OTLPMetricExporter({
  url: ...,
  headers: ...,
  timeoutMillis: 10000  // 10 second timeout
});
```

**Impact:**
- ✅ Prevents hanging on authentication failures
- ✅ Faster failure feedback
- ✅ Better resource management

#### Change 2c: Authentication Error Detection (lines 202-221)

**Added:**
```javascript
// Wrap exporter to detect auth failures
if (traceExporter && typeof traceExporter.export === 'function') {
  const originalExport = traceExporter.export.bind(traceExporter);
  traceExporter.export = function(spans, resultCallback) {
    originalExport(spans, (result) => {
      if (result.error) {
        if (result.error.message && result.error.message.includes('Unauthorized')) {
          console.error('❌ [Telemetry] Authentication failed - check OTEL_EXPORTER_OTLP_HEADERS');
          console.error('   Endpoint:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
          console.error('   Error:', result.error.message);
        } else if (result.error.code === 401) {
          console.error('❌ [Telemetry] 401 Unauthorized - Invalid Grafana Cloud credentials');
          console.error('   Please verify your OTEL_EXPORTER_OTLP_HEADERS token is correct');
        }
      }
      resultCallback(result);
    });
  };
}
```

**Impact:**
- ✅ Clear identification of auth errors
- ✅ Helpful error messages with remediation steps
- ✅ Easier debugging for developers

### 3. Created Verification Script

**File:** `rpa-system/backend/scripts/verify-otel-credentials.js` (new, 220 lines)

**Features:**
- ✅ Validates environment variables are set
- ✅ Checks for placeholder values
- ✅ Parses and validates headers
- ✅ Constructs correct endpoint URL
- ✅ Sends test trace to Grafana Cloud
- ✅ Provides detailed success/failure feedback
- ✅ Color-coded output for easy reading

**Usage:**
```bash
cd rpa-system/backend
node scripts/verify-otel-credentials.js
```

**Sample Output (on failure):**
```
============================================================
🔍 OpenTelemetry Credentials Verification
============================================================

📋 Step 1: Checking environment variables...
✅ Environment variables are set

📋 Step 2: Parsing headers...
✅ Headers parsed successfully

📋 Step 3: Constructing endpoint URL...
✅ URL is valid

📋 Step 4: Testing connection to Grafana Cloud...
⏳ Sending test trace data...
   HTTP Status: 401

❌ AUTHENTICATION FAILED (401 Unauthorized)
⚠️  Your credentials are incorrect or expired

Please verify:
  1. Your Grafana Cloud instance ID is correct
  2. Your API token has not expired
  3. The token has proper permissions
```

**Impact:**
- ✅ Can verify credentials before deployment
- ✅ Saves time debugging auth issues
- ✅ Provides actionable error messages

### 4. Created Comprehensive Documentation

**Files Created:**
- `OTEL_SETUP_GUIDE.md` - Step-by-step setup instructions
- `OTEL_ISSUES_FIXED.md` - This file

**Content:**
- ✅ How to get Grafana Cloud credentials
- ✅ How to encode credentials properly
- ✅ Local testing instructions
- ✅ Render deployment instructions
- ✅ Troubleshooting guide
- ✅ Verification checklist

---

## 🎯 Current Status

### What's Working ✅
- OpenTelemetry SDK initialization
- Auto-instrumentation of HTTP, Express, etc.
- Trace context propagation
- Structured logging with trace correlation
- Sensitive data redaction
- Sampling configuration
- Graceful fallback when credentials missing

### What Needs Fixing ❌
- **Invalid Grafana Cloud credentials** - Need fresh token
- **Render environment variables** - Not set in production

### Impact on Application
- ✅ **Application runs normally** - telemetry is non-blocking
- ❌ **No observability data** exported to Grafana Cloud
- ✅ **Local Prometheus metrics** still available on port 9090

---

## 🚀 Next Steps (Priority Order)

### 1. Get Valid Grafana Cloud Credentials (HIGH PRIORITY)

**Action Required:**
1. Log into https://grafana.com
2. Navigate to Application Observability → OpenTelemetry
3. Copy Instance ID and generate new token
4. Encode as Base64: `echo -n "instance-id:token" | base64`
5. Update `.env` file with new credentials

**Expected Time:** 5 minutes

### 2. Verify Credentials Locally (HIGH PRIORITY)

**Action Required:**
```bash
cd rpa-system/backend
node scripts/verify-otel-credentials.js
```

**Expected Output:** ✅ SUCCESS! Credentials are valid and working

**Expected Time:** 1 minute

### 3. Update Render Environment Variables (HIGH PRIORITY)

**Action Required:**
1. Go to https://dashboard.render.com
2. Select `easyflow-backend` service
3. Click "Environment" tab
4. Add variables from `OTEL_SETUP_GUIDE.md`
5. Save (triggers auto-redeploy)

**Expected Time:** 3 minutes
**Deployment Time:** 2-3 minutes

### 4. Verify in Production (MEDIUM PRIORITY)

**Action Required:**
1. Check Render logs for telemetry initialization
2. Wait 5-10 minutes for traces
3. Check Grafana Cloud for service `easyflow-backend`

**Expected Time:** 10-15 minutes

### 5. Set Up SLO Dashboards (LOW PRIORITY)

**Action Required:**
- Follow instructions in `NEXT_STEPS_GRAFANA.md`
- Create SLO definitions
- Import custom dashboards

**Expected Time:** 1-2 hours

---

## 📊 Testing Checklist

- [x] Identified root cause (invalid credentials)
- [x] Added credential validation
- [x] Added error handling
- [x] Created verification script
- [x] Verified script detects auth failure
- [x] Created documentation
- [ ] Obtained valid Grafana Cloud credentials
- [ ] Verified credentials work locally
- [ ] Updated Render environment variables
- [ ] Verified traces in Grafana Cloud

---

## 🔧 Configuration Reference

### Local Development (.env)
```bash
OTEL_SERVICE_NAME=rpa-system-backend
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-<region>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-token>
OTEL_TRACE_SAMPLING_RATIO=1.0
```

### Render Production
Same variables but set in Render Dashboard → Environment tab

### Expected Log Output (Success)
```
✅ [Telemetry] OpenTelemetry backend instrumentation initialized successfully
✅ [Telemetry] Service Name: rpa-system-backend
✅ [Telemetry] OTLP Endpoint: https://otlp-gateway-prod-us-east-2.grafana.net/otlp
✅ [Telemetry] OTLP Headers: CONFIGURED ✓
✅ [Telemetry] Trace Sampler: ParentBasedSampler with 100% sampling ratio
✅ [Telemetry] Data Redaction: Active
✅ [Telemetry] OTEL Exporters: ACTIVE - Ready to stream to Grafana Cloud
```

---

## 📞 Support

**If you encounter issues:**
1. Run verification script: `node scripts/verify-otel-credentials.js`
2. Check `OTEL_SETUP_GUIDE.md` troubleshooting section
3. Verify Grafana Cloud credentials haven't expired
4. Check Render logs for telemetry initialization messages

**Documentation:**
- `OTEL_SETUP_GUIDE.md` - Complete setup instructions
- `NEXT_STEPS_GRAFANA.md` - Post-setup configuration
- OpenTelemetry Docs: https://opentelemetry.io/docs/
- Grafana Cloud Docs: https://grafana.com/docs/grafana-cloud/send-data/otlp/
