# How to Check if Workflow is Actually Executing

## Quick Check Commands

### 1. Check for Workflow Execution Logs
```bash
tail -f logs/backend.log | grep -E "🚀|Starting workflow|workflow.execute|Executing step"
```

### 2. Check for Trace IDs (Observability Working)
```bash
tail -f logs/backend.log | grep -E "trace_id|traceId|otel"
```

### 3. Check Recent API Calls
```bash
tail -f logs/backend.log | grep -E "POST.*workflows/execute|/api/workflows/execute"
```

### 4. View Structured Logs with jq
```bash
tail -f logs/backend.log | jq 'select(.message | contains("workflow") or contains("execution"))'
```

## What to Look For

### ✅ Workflow is Executing If You See:
- `🚀 Starting workflow execution` - Execution started
- `workflow.execute.*` - OpenTelemetry span created
- `Executing workflow step` - Steps are running
- `workflow.step.*` - Step spans being created
- Trace IDs in logs - Observability working

### ❌ Workflow is NOT Executing If:
- No workflow logs appear
- Only "Workflow execution started" but no follow-up logs
- Errors about "No start step"
- Errors about workflow not found

## Common Issues

### Issue: "Workflow execution started" but nothing happens
**Possible causes:**
1. Workflow has no start step → Add a start step
2. Workflow not found → Check workflow ID
3. Execution failed silently → Check error logs

### Issue: No observability logs
**Check:**
- Backend is running: `ps aux | grep "node.*backend"`
- Telemetry enabled: Check logs for "OpenTelemetry initialized"
- Sampling: Check `OTEL_TRACE_SAMPLING_RATIO` (10% default)

## Debug Steps

1. **Check Backend Status**
   ```bash
   curl http://localhost:3030/api/health/supabase
   ```

2. **Check Recent Executions**
   - Go to "Executions" tab in workflow builder
   - Check status and error messages

3. **Check Logs in Real-Time**
   ```bash
   tail -f logs/backend.log | grep -E "workflow|execution"
   ```

4. **Check for Errors**
   ```bash
   tail -f logs/backend.log | grep -E "error|Error|ERROR|failed|Failed"
   ```

---

**Last Updated**: December 6, 2025

