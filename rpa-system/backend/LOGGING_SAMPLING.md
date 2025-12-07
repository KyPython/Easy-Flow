# Log Sampling Configuration

## Overview
EasyFlow uses **intelligent log sampling** to reduce log volume while maintaining observability. This prevents log flooding and makes it easier to diagnose issues.

## Current Sampling Rates

| Log Level | Sample Rate | Percentage | Description |
|-----------|-------------|------------|------------|
| **trace** | 1 in 1000 | 0.1% | Very verbose tracing (minimal sampling) |
| **debug** | 1 in 100 | 1% | Detailed debugging (sampled) |
| **info** | 1 in 50 | 2% | General information (reduced from 10% to reduce noise) |
| **warn** | 1 in 10 | 10% | Warnings (sampled to reduce noise, but still catch issues) |
| **error** | Always | 100% | Critical errors (never sampled) |
| **fatal** | Always | 100% | Fatal errors (never sampled) |

## HTTP Request Logging

- **Morgan (dev)**: 1 in 100 requests (1%)
- **Structured Logger**: 1 in 50 requests (2%) via `requestLoggingMiddleware`

## Trace Sampling (OpenTelemetry)

- **Default**: 10% (configurable via `OTEL_TRACE_SAMPLING_RATIO`)
- Uses `ParentBasedSampler` to preserve trace continuity

## Configuration

### Environment Variables

Override sampling rates via environment variables:

```bash
# Log sampling
TRACE_LOG_SAMPLE_RATE=1000    # 0.1% (1 in 1000)
DEBUG_LOG_SAMPLE_RATE=100     # 1% (1 in 100)
INFO_LOG_SAMPLE_RATE=50       # 2% (1 in 50)
WARN_LOG_SAMPLE_RATE=10       # 10% (1 in 10)

# HTTP request sampling
REQUEST_LOG_SAMPLE_RATE=100   # 1% (1 in 100)

# Trace sampling (OpenTelemetry)
OTEL_TRACE_SAMPLING_RATIO=0.1 # 10% (0.1)
```

### Log Level

Control which logs are processed at all:

```bash
LOG_LEVEL=info  # Only process info, warn, error, fatal (default)
LOG_LEVEL=debug # Process debug and above
LOG_LEVEL=trace # Process all logs (very verbose)
```

## What Changed

### Recent Improvements (2025-12-07)

1. **Replaced `console.log` calls**: All debug `console.log` statements in `app.js` now use `logger.debug()`, which is properly sampled at 1%
2. **More aggressive info sampling**: Reduced from 10% (1 in 10) to 2% (1 in 50) to reduce noise
3. **Warn log sampling**: Added 10% sampling for warn logs (previously always logged)
4. **Better documentation**: Added comprehensive comments explaining sampling rates

## Impact

- **Before**: ~10% of info logs + all warn logs + all console.log calls = high volume
- **After**: ~2% of info logs + 10% of warn logs + 1% of debug logs = significantly reduced volume

## Best Practices

1. **Use structured logger**: Always use `logger.debug()`, `logger.info()`, etc. instead of `console.log()`
2. **Choose appropriate level**: 
   - `debug`: Detailed debugging (sampled at 1%)
   - `info`: General information (sampled at 2%)
   - `warn`: Warnings (sampled at 10%)
   - `error`: Always logged (never sampled)
3. **For high-volume operations**: Use `logger.debug()` with sampling rather than `logger.info()`
4. **For critical issues**: Always use `logger.error()` or `logger.fatal()` (never sampled)

## Monitoring

All logs are structured JSON and include:
- Trace context (trace_id, span_id)
- Timestamp
- Service name
- Log level
- Business context (user_id, workflow_id, etc.)

This makes it easy to:
- Filter logs by trace_id to see full request flow
- Search for specific user/workflow operations
- Correlate logs with OpenTelemetry traces

