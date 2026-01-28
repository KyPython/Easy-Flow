# Workflow Checkpoint Architecture

## Overview

This document describes the checkpoint architecture for workflow execution, enabling resumption of failed executions from the last successful step. The design follows CP consistency principles: **Consistency** and **Partition Tolerance** over Availability.

## Architecture Principles

### 1. Statelessness (202 Accepted Pattern)
- API returns `202 Accepted` immediately, decoupling request handling from long-running tasks
- Workflow state is persisted in checkpoints, not held in memory
- Enables horizontal scaling to handle massive traffic surges

### 2. CP Consistency
Following the CAP Theorem, we prioritize:
- **Consistency (C)**: Workflow state must be accurate and complete
- **Partition Tolerance (P)**: System continues to function during network partitions
- **Availability (A)**: Temporary unavailability is acceptable if it ensures consistent state

**Trade-off**: If a checkpoint cannot be saved atomically, we fail the checkpoint rather than proceeding with incomplete state.

### 3. P99 Latency Focus
- Every request is logged with `duration_ms` for tail-end latency analysis
- Identify the 1% of users experiencing slow workflows due to external I/O bottlenecks
- Checkpoint creation is logged separately for latency analysis

## Checkpoint Schema

The checkpoint schema (`schemas/workflowCheckpoint.schema.json`) defines the complete structure needed for resuming execution:

```json
{
  "checkpoint_version": "1.0.0",
  "workflow_execution_id": "uuid",
  "last_successful_step_execution_id": "uuid",
  "last_successful_step_id": "uuid",
  "last_successful_step_key": "node-start-123",
  "last_successful_step_name": "Extract User Data",
  "checkpointed_at": "2026-01-07T12:59:00.000Z",
  "state_variables": {
    "scraped_data": [...],
    "user_id": "123",
    "processed_count": 10
  },
  "execution_context": {
    "workflow_id": "uuid",
    "user_id": "uuid",
    "execution_mode": "balanced",
    "steps_total": 5,
    "steps_executed": 2,
    "execution_order": 2,
    "triggered_by": "manual",
    "trigger_data": {}
  },
  "resume_metadata": {
    "next_step_id": "uuid",
    "next_step_key": "node-email-456",
    "visited_steps": ["step-uuid-1", "step-uuid-2"],
    "branch_history": [
      {
        "step_id": "uuid",
        "condition_evaluated": "user.age > 18",
        "condition_result": true,
        "branch_taken": "true"
      }
    ],
    "loop_iterations": {}
  },
  "step_output": {
    "data": {...},
    "metadata": {
      "duration_ms": 1234,
      "step_details": "Scraped 10 records",
      "external_resources": []
    }
  },
  "validation": {
    "checksum": "sha256-hash",
    "schema_version_validated": true,
    "validation_timestamp": "2026-01-07T12:59:00.000Z"
  }
}
```

## Key Fields for Resuming

### Required for Resume

1. **`last_successful_step_execution_id`**: The exact step execution record to resume from
2. **`state_variables`**: The complete data state (output from last successful step)
3. **`execution_context`**: Workflow and execution metadata needed to continue
4. **`resume_metadata.next_step_id`**: Which step to execute next

### Critical for Deterministic Resumption

1. **`resume_metadata.visited_steps`**: Prevents infinite loops
2. **`resume_metadata.branch_history`**: Ensures conditional branches are re-evaluated correctly
3. **`resume_metadata.loop_iterations`**: Tracks loop progress for iterative steps

## Checkpoint Creation

Checkpoints are created automatically after each successful step execution:

```javascript
// After step completes successfully
const checkpointService = new WorkflowCheckpointService();
await checkpointService.createCheckpoint({
  workflowExecutionId: execution.id,
  stepExecution: stepExecution,
  workflowStep: step,
  stateVariables: result.data,
  executionContext: {
    workflowId: workflow.id,
    userId: execution.user_id,
    executionMode: 'balanced',
    stepsTotal: 5,
    stepsExecuted: 2
  },
  resumeMetadata: {
    nextStepId: nextStep?.id,
    visitedSteps: [...],
    branchHistory: [...]
  }
});
```

### Atomicity Guarantee

Checkpoints are saved atomically:
1. Update `step_executions` with checkpoint data
2. Update `workflow_executions` with latest checkpoint reference
3. If either fails, checkpoint creation fails (CP consistency)

## Resume Process

When resuming from a checkpoint:

```javascript
const resumeInfo = await checkpointService.resumeFromCheckpoint(executionId);

if (resumeInfo.canResume) {
  const { checkpoint } = resumeInfo;
  
  // Resume from checkpoint
  const nextStep = workflow.workflow_steps.find(
    step => step.id === checkpoint.resume_metadata.next_step_id
  );
  
  // Continue execution with checkpoint state
  await executeStep(execution, nextStep, checkpoint.state_variables, ...);
}
```

## Validation

### Checksum Validation
Every checkpoint includes a SHA-256 checksum of critical data:
- `workflow_execution_id`
- `last_successful_step_execution_id`
- `state_variables`
- `execution_context`

On resume, the checksum is recalculated and validated to ensure checkpoint integrity.

### Schema Validation
Checkpoints are validated against the JSON schema on creation and resume to ensure backward compatibility.

## Failure Scenarios

### Checkpoint Creation Fails
- **Action**: Workflow execution continues (checkpointing is best-effort)
- **Impact**: If worker crashes, cannot resume from this step
- **Recovery**: Can reconstruct checkpoint from step_executions data

### Resume Validation Fails
- **Action**: Attempt to reconstruct checkpoint from step_executions
- **Impact**: May lose some metadata (branch history, loop iterations)
- **Recovery**: Can still resume with basic state_variables

### Checkpoint Data Corrupted
- **Action**: Reject resume attempt, mark execution as failed
- **Impact**: Workflow must be retried from beginning
- **Prevention**: Checksum validation prevents corruption from going undetected

## Performance Considerations

### Checkpoint Creation Overhead
- Checkpoint creation adds ~10-50ms per step (database writes)
- Acceptable trade-off for resume capability
- Logged separately for latency analysis

### Storage Impact
- Each checkpoint includes full `state_variables` (may be large)
- Stored in `step_executions.result.checkpoint` (JSONB)
- Total storage: ~1-10KB per checkpoint

### Resume Performance
- Resuming from checkpoint: ~20-100ms (database read + validation)
- Much faster than restarting entire workflow

## Monitoring

### Checkpoint Metrics
- Checkpoint creation success rate
- Checkpoint creation latency (P50, P95, P99)
- Resume success rate
- Resume latency

### Alerts
- Checkpoint creation failure rate > 1%
- Checkpoint creation P99 latency > 100ms
- Resume validation failures

## Future Enhancements

1. **Incremental Checkpoints**: Only store changed state_variables
2. **Compression**: Compress large state_variables before storage
3. **Checkpoint Pruning**: Remove old checkpoints after workflow completion
4. **Distributed Checkpoints**: Store checkpoints in Redis for faster resume
5. **Branch Prediction**: Pre-compute next step for conditional branches

## Example Resume Flow

```
1. Workflow execution fails at Step 3
   → Last successful step: Step 2
   → Checkpoint exists for Step 2

2. User clicks "Retry" or system auto-retries
   → Load checkpoint for Step 2
   → Validate checksum
   → Extract state_variables

3. Resume execution
   → Start from Step 3 (next_step_id from checkpoint)
   → Use state_variables as input
   → Continue execution normally

4. If Step 3 succeeds
   → Create new checkpoint for Step 3
   → Continue to Step 4
```

## Implementation Files

- **Schema**: `schemas/workflowCheckpoint.schema.json`
- **Service**: `services/workflowCheckpointService.js`
- **Integration**: `services/workflowExecutor.js` (checkpoint creation)
- **Worker**: `workers/workflowWorker.js` (resume capability)

## Testing

### Unit Tests
- Checkpoint creation with various state sizes
- Checksum validation
- Schema validation
- Resume from valid checkpoint
- Resume from corrupted checkpoint

### Integration Tests
- Full workflow execution with checkpoint creation
- Resume after simulated failure
- Resume with different state_variables
- Multiple resume attempts

