# Phase 1 Refactoring Implementation

**Status**: 🔄 **IN PROGRESS**  
**Date**: 2026-01-07  
**Phase**: Phase 1 - Critical REST Naming Fixes

## Overview

Refactoring critical workflow/task execution endpoints to follow REST conventions:
- Verb-based URLs → Resource-oriented URLs
- Proper HTTP status codes (202 Accepted for async, 201 Created for resource creation)
- Location headers for async operation tracking
- Backward compatibility with deprecation headers

---

## Implementation Status

### ✅ Completed
- `POST /api/workflows/:id/executions` - Already implemented, returns 202 Accepted
- Old endpoint `/api/workflows/execute` has backward compatibility layer

### 🔄 In Progress
- `POST /api/tasks/:id/executions` - New endpoint for executing existing tasks
- `POST /api/automation/executions` - New endpoint for general automation execution

### ⏳ Pending
- Frontend updates to use new endpoints
- Deprecation headers on old endpoints
- Documentation updates

---

## New Endpoints

### 1. `POST /api/tasks/:id/executions`

**Purpose**: Execute an existing automation task

**Request**:
```http
POST /api/tasks/:id/executions
Authorization: Bearer <token>
Content-Type: application/json

{
  "override_params": {  // Optional: override task parameters
    "url": "...",
    "username": "..."
  }
}
```

**Response** (202 Accepted):
```json
{
  "execution": {
    "id": "execution-uuid",
    "task_id": "task-id",
    "status": "queued",
    "created_at": "2026-01-07T..."
  },
  "message": "Task execution accepted and queued",
  "location": "/api/executions/:executionId"
}
```

**Headers**:
- `Location: /api/executions/:executionId`
- `Deprecation` (if called via old endpoint)

**Replaces**: `POST /api/tasks/:id/run`

---

### 2. `POST /api/automation/executions`

**Purpose**: Execute automation task (general purpose, creates task if needed)

**Request**:
```http
POST /api/automation/executions
Authorization: Bearer <token>
Content-Type: application/json

{
  "task_type": "web_automation" | "invoice_download" | ...,
  "url": "...",
  "username": "...",
  "password": "...",
  // ... other task-specific fields
}
```

**Response** (202 Accepted):
```json
{
  "execution": {
    "id": "execution-uuid",
    "task_id": "task-id",
    "status": "queued",
    "created_at": "2026-01-07T..."
  },
  "message": "Automation execution accepted and queued",
  "location": "/api/executions/:executionId"
}
```

**Headers**:
- `Location: /api/executions/:executionId`

**Replaces**: `POST /api/automation/execute`

---

## Backward Compatibility

Old endpoints will:
1. Log deprecation warning
2. Add deprecation headers
3. Redirect to new endpoint or reuse new logic
4. Continue working during migration period

**Deprecation Headers**:
```
Deprecation: true
Sunset: 2026-04-01
Link: </api/tasks/:id/executions>; rel="successor-version"
```

---

## Frontend Updates Required

### Files to Update:
1. `src/hooks/useWorkflowExecutions.js`
   - Update `POST /api/workflows/execute` → `POST /api/workflows/:id/executions`

2. `src/hooks/useWorkflow.js`
   - Update `POST /api/workflows/execute` → `POST /api/workflows/:id/executions`

3. `src/components/TaskForm/TaskForm.jsx`
   - Update `/api/run-task` → `/api/automation/executions`
   - Update `/api/automation/execute` → `/api/automation/executions`

4. `src/hooks/useWorkflowTesting.js`
   - Update `/api/automation/execute` → `/api/automation/executions`
   - Update `/api/workflows/execute-step` (if needed)

---

## Testing Checklist

- [ ] New endpoints return 202 Accepted for async operations
- [ ] Location headers are set correctly
- [ ] Old endpoints still work with deprecation headers
- [ ] Frontend successfully calls new endpoints
- [ ] Execution status can be polled via Location header URL
- [ ] Error handling works correctly
- [ ] Rate limiting still enforced
- [ ] Security validations (SSRF, auth) still work

---

## Migration Timeline

**Week 1**: Backend endpoints implemented
**Week 2**: Frontend updated to use new endpoints
**Week 3**: Monitor usage, fix any issues
**Week 4**: Remove old endpoints (or keep with deprecation warnings)

