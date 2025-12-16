# Loki Query Examples for Easy-Flow

## Basic Query Structure

Loki queries require at least one label matcher. Use the format: `{label="value"}`

## Available Labels (from Promtail config)

Based on your Promtail configuration, you can query using these labels:

### Job Labels
- `job="easyflow-backend"` - Backend application logs
- `job="easyflow-frontend"` - Frontend application logs  
- `job="easyflow-automation"` - Automation worker logs
- `job="easyflow-backend-errors"` - Backend error logs
- `job="easyflow-frontend-errors"` - Frontend error logs

### Service Labels
- `service="rpa-system-backend"` - Backend service
- `service="rpa-system-frontend"` - Frontend service
- `service="automation-worker"` - Automation worker

### Log Level Labels (extracted from JSON)
- `level="info"` - Info level logs
- `level="error"` - Error level logs
- `level="warn"` - Warning level logs
- `level="debug"` - Debug level logs

### Other Labels
- `logger="app"` - Logger name (extracted from JSON)
- `environment="development"` - Environment label

## Example Queries

### 1. All Backend Logs
```
{job="easyflow-backend"}
```

### 2. Backend Errors Only
```
{job="easyflow-backend", level="error"}
```
or
```
{job="easyflow-backend-errors"}
```

### 3. Search for Specific Text in Backend Logs
```
{job="easyflow-backend"} |= "workflow"
```

### 4. Backend Logs with Specific Logger
```
{job="easyflow-backend", logger="app"}
```

### 5. All Error Logs (Any Service)
```
{level="error"}
```

### 6. Frontend Logs
```
{job="easyflow-frontend"}
```

### 7. Automation Worker Logs
```
{job="easyflow-automation"}
```

### 8. Search for Execution IDs
```
{job="easyflow-backend"} |= "execution_id"
```

### 9. Search for Trace IDs
```
{job="easyflow-backend"} |= "trace_id"
```

### 10. Filter by Service
```
{service="rpa-system-backend"}
```

## LogQL Operators

### Text Search
- `|= "text"` - Contains text (case-sensitive)
- `!= "text"` - Does not contain text
- `|~ "regex"` - Matches regex
- `!~ "regex"` - Does not match regex

### Examples with Text Search
```
{job="easyflow-backend"} |= "workflow" |= "execution"
{job="easyflow-backend"} |~ "error|exception|failed"
{level="error"} != "timeout"
```

## Using in Grafana Explore

1. **Select Loki datasource** (should be pre-configured)
2. **Add a label filter**: Click "Label browser" or type `{job="easyflow-backend"}`
3. **Add text search** (optional): Add `|= "your search term"` after the label filter
4. **Run query**: Click "Run query" or press Shift+Enter

## Quick Start Queries

**See all backend logs:**
```
{job="easyflow-backend"}
```

**See all errors:**
```
{level="error"}
```

**Search for workflow executions:**
```
{job="easyflow-backend"} |= "workflow"
```

**See recent errors with trace context:**
```
{level="error"} |= "trace_id"
```

