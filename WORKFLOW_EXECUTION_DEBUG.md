# Workflow Execution Debugging Guide

## How to Check if Workflow is Actually Executing

### 1. Check Backend Logs
```bash
tail -f /Users/ky/Easy-Flow/logs/backend.log | grep WorkflowExecutor
```

You should see logs like:
- `🚀 Starting workflow execution` - Execution started
- `📋 Found start step, executing X total steps` - Steps found
- `▶️ Beginning step execution` - Steps starting
- `✅ Workflow execution completed successfully` - Completed
- `❌ Execution failed: ...` - Failed with error

### 2. Check Database Status
Query the `workflow_executions` table to see:
- `status`: Should be `running`, `completed`, `failed`, or `cancelled`
- `status_message`: Current execution message
- `steps_executed`: Number of steps completed
- `error_message`: If failed, the error details

### 3. Common Issues

#### Issue: "Workflow has no start step"
**Solution**: Add a start step to your workflow in the canvas

#### Issue: Execution stuck in "running"
**Possible causes**:
- Step is taking a long time (check logs)
- Step is waiting for external service (automation service, API, etc.)
- Execution crashed silently (check error logs)

#### Issue: Execution fails immediately
**Check**:
- Backend logs for error messages
- Database `error_message` field
- Whether required services are running (automation service, etc.)

### 4. Enhanced Logging Added

The workflow executor now logs:
- ✅ Execution start with workflow details
- ✅ Start step found/not found
- ✅ Step execution beginning
- ✅ Execution completion with duration
- ✅ Execution failures with error details

### 5. Real-time Monitoring

The frontend polls execution status every 2 seconds, so you should see:
- Status updates in the UI
- "Executing..." overlay disappears when done
- Success/error messages when execution completes

---

**Last Updated**: December 6, 2025

