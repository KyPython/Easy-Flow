# Complete REST API Refactoring Plan - All Phases

**Status**: 🔄 **IN PROGRESS**  
**Target**: Complete all 4 phases with tests and production readiness

## Implementation Strategy

Given the complexity and scope, we'll:
1. **Fix Phase 1 endpoints** (proper delegation pattern)
2. **Complete Phase 2** (HTTP status codes) 
3. **Complete Phase 3** (remaining 20 endpoints) systematically
4. **Complete Phase 4** (API versioning middleware)
5. **Create comprehensive tests**
6. **Update frontend incrementally**
7. **Commit and deploy to dev**

## Phase 1: Critical Endpoints (In Progress)

### Current Status:
- ✅ `POST /api/workflows/:id/executions` - Complete
- ✅ `POST /api/tasks/:id/executions` - Complete  
- ⚠️ `POST /api/automation/executions` - Needs handler extraction

### Fix Needed:
Extract the `/api/automation/execute` handler logic into a shared function, then:
- New endpoint calls shared handler
- Old endpoint calls shared handler with deprecation middleware

## Phase 2: HTTP Status Codes

Update all async operations to return 202 Accepted:
- ✅ `/api/workflows/:id/executions` - Already 202
- ✅ `/api/tasks/:id/executions` - Already 202
- ✅ `/api/run-task` - Updated to 202
- ✅ `/api/automation/execute` - Already 202
- ⏳ `/api/run-task-with-ai` - Needs 202

Update resource creation to return 201 Created:
- ✅ `/api/track-event` - Already 201
- ⏳ `/api/notifications/create` - Needs check

Add Location headers to all 201/202 responses

## Phase 3: Remaining 20 Endpoints

### Priority Order:
1. Data Extraction (2 endpoints)
2. Events & Tracking (2 endpoints)  
3. Campaigns & Notifications (2 endpoints)
4. Referrals & Checkouts (3 endpoints)

### Implementation Pattern:
For each endpoint:
1. Create new REST-compliant endpoint
2. Add deprecation middleware to old endpoint
3. Both call shared handler function
4. Update response format if needed

## Phase 4: API Versioning

1. Create versioning middleware
2. Add `/api/v1/` prefix option
3. Document versioning strategy
4. Add version to all responses

## Testing Strategy

Create test files:
- `tests/api/rest-refactoring.test.js` - Phase 1-3 endpoints
- `tests/api/http-status-codes.test.js` - Phase 2 validation
- `tests/api/versioning.test.js` - Phase 4 versioning

Test coverage:
- ✅ New endpoints work correctly
- ✅ Old endpoints still work with deprecation
- ✅ Status codes are correct
- ✅ Location headers are set
- ✅ Deprecation headers are present

## Frontend Updates

Update API client files:
1. `src/hooks/useWorkflowExecutions.js`
2. `src/hooks/useWorkflow.js`
3. `src/components/TaskForm/TaskForm.jsx`
4. `src/hooks/useWorkflowTesting.js`
5. Create API client utility to centralize endpoint paths

## Production Readiness Checklist

- [ ] All tests passing
- [ ] No linter errors
- [ ] Security scans passing
- [ ] Backward compatibility verified
- [ ] Frontend updated and tested
- [ ] Documentation updated
- [ ] Migration guide created
- [ ] Performance tested

