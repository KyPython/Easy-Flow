# EasyFlow — Architecture Brief (Interview Guide)

One-page architecture, 5-minute walkthrough, and the failure/concurrency reasoning.

---

## High-Level Architecture

```
┌──────────────────────────┐
│        Clients           │
│   (API / UI / Ingestion)  │
└─────────────┬────────────┘
              │
              ▼
┌──────────────────────────┐
│     Workflow API         │
│  (Create / Enqueue Job)  │
└─────────────┬────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│              PostgreSQL                       │
│                                              │
│   workflow_executions                         │
│   ──────────────────────────────────────────  │
│   id                                          │
│   status: PENDING | PROCESSING | COMPLETE |  │
│           FAILED                                │
│   retry_count                                  │
│   last_error                                   │
│   error_category                               │
│   payload                                      │
│                                              │
│   Guarantees:                                  │
│   • ACID transactions                          │
│   • Row-level locking (FOR UPDATE SKIP LOCKED) │
│   • Durable state                               │
└─────────────┬────────────────────────────────┘
              │
              │ FOR UPDATE SKIP LOCKED
              ▼
┌──────────────────────────┐
│        Workers           │
│   (Horizontal Scale)     │
│                          │
│   1. Atomically claim job│
│   2. Execute business   │
│      logic (idempotent)  │
│   3. Commit success OR   │
│      record failure      │
└─────────────┬────────────┘
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
┌──────────────┐  ┌──────────────────┐
│  COMPLETE    │  │   FAILED (DLQ)   │
│  (Success)   │  │  retry_count >=N │
└──────────────┘  └─────────┬────────┘
                            │
                            ▼
                ┌────────────────────┐
                │ DLQ Inspection Tool │
                │ • View failures     │
                │ • Replay jobs       │
                └────────────────────┘
```

---

## Core Primitives

### 1. Failure Memory

Jobs retain failure context for debugging and operational awareness:

| Column | Purpose |
|--------|---------|
| `retry_count` | Number of retry attempts made |
| `last_error` | Error message from last failure |
| `last_error_at` | Timestamp of last failure |
| `error_category` | Categorized error type (timeout, validation, external_api) |

### 2. Atomic Job Claiming (FOR UPDATE SKIP LOCKED)

This is the exact primitive used in production distributed systems:

```sql
SELECT * FROM workflow_executions
WHERE state = 'PENDING'
ORDER BY created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

**Why this matters:**
- Workers atomically claim jobs in a single statement
- No race conditions between workers
- Workers skip already-locked rows immediately (no waiting)
- Enables safe horizontal scaling of workers

### 3. Bounded Retries + DLQ Semantics

```
Retry Loop:
  Attempt 1 → Fail → retry_count = 1
  Attempt 2 → Fail → retry_count = 2
  Attempt 3 → Fail → retry_count = 3 (MAX) → FAILED (DLQ)
```

- **Max Retries**: 3 (configurable)
- **Backoff**: Exponential (2^attempt seconds with jitter)
- **Non-retryable errors**: Go directly to DLQ (validation errors, business rule violations)

### 4. DLQ Inspection + Replay

Operators can:
- View all FAILED jobs with full error context
- Filter by error category, workflow, or time range
- Replay jobs after fixing root cause
- Bulk replay for batch recovery

---

## AWS Mental Model

| EasyFlow Component | AWS Equivalent | Notes |
|--------------------|----------------|-------|
| PostgreSQL queue | SQS + DynamoDB | ACID vs eventual consistency |
| FOR UPDATE SKIP LOCKED | SQS Visibility Timeout | Prevents concurrent processing |
| Worker processes | Lambda / ECS | Horizontal scaling |
| retry_count | ApproximateReceiveCount | SQS tracks this automatically |
| FAILED state | SQS DLQ | Dead Letter Queue pattern |
| DLQ API | CloudWatch + Custom Ops | Observability layer |
| inspect_dlq.py CLI | AWS CLI + custom scripts | Operator tooling |

**Say this in interviews:**
> "EasyFlow implements the SQS + DLQ pattern explicitly in PostgreSQL. This shows I understand the cloud primitives—I just chose to implement them myself for transparency and educational value."

---

## Key Tradeoffs

### Why PostgreSQL Instead of Redis Queue?

| Aspect | PostgreSQL (EasyFlow) | Redis (Bull.js) |
|--------|----------------------|-----------------|
| **Consistency** | ✅ Strong (ACID) | ⚠️ Eventual |
| **Latency** | ⚠️ ~5-10ms higher | ✅ ~1-2ms |
| **Infrastructure** | ✅ Single DB | ❌ Redis required |
| **Observability** | ✅ SQL queries | ❌ Redis CLI only |
| **Retry policies** | ⚠️ Custom | ✅ Built-in |

### When This Pattern Is Correct

✅ **Good fit:**
- Workflows requiring exactly-once semantics
- Audit-critical processes (finance, compliance)
- Teams already using PostgreSQL/Supabase
- Learning/proof-of-concept work

❌ **Consider alternatives:**
- Ultra-high-throughput (>1000 jobs/sec)
- Complex delayed job schedules
- Existing Redis infrastructure

---

## 5-Minute Walkthrough Script

Use this in interviews or presentations:

### Minute 0-1: Framing
> "EasyFlow is a workflow orchestration engine I built to focus on correctness and reliability rather than just happy-path automation. Most workflow demos work when everything goes right—EasyFlow is designed to keep working when things go wrong."

### Minute 1-2: Core Problem
> "In production systems—especially in finance or data pipelines—you can't afford double processing, silent failures, or one bad record blocking the entire system. EasyFlow treats workflows as state machines stored durably in Postgres, not ephemeral in-memory jobs."

### Minute 2-3: Architecture
> "At the center is a PostgreSQL-backed workflow queue. Workers claim jobs using FOR UPDATE SKIP LOCKED, which lets me run many workers in parallel without collisions. This gives me queue-like semantics with strong consistency."

### Minute 3-4: Failure Handling
> "Failures are first-class. Nothing fails silently. Every failed job preserves how many times it was retried, the last error, and the original payload. I built a DLQ inspection tool that lets operators see exactly why jobs failed and replay them safely."

### Minute 4-5: Why This Matters
> "This pattern applies directly to payment workflows, data ingestion, or any backend orchestration. The CSV automation use cases are just stress tests—the engine is general-purpose. I wanted to demonstrate I think in terms of system guarantees: exactly-once semantics, fault isolation, and safe concurrency."

---

## CLI Usage

```bash
# List failed jobs in DLQ
python rpa-system/backend/scripts/inspect_dlq.py list

# Show job details
python rpa-system/backend/scripts/inspect_dlq.py show <job_id>

# Replay a failed job
python rpa-system/backend/scripts/inspect_dlq.py replay <job_id>

# Get DLQ statistics
python rpa-system/backend/scripts/inspect_dlq.py stats
```

---

## Files Changed in Phase 1

| File | Purpose |
|------|---------|
| `supabase/migrations/20240206000000_phase1_failure_memory.sql` | Database schema changes |
| `rpa-system/backend/services/workflowExecutionService.js` | Failure tracking in execution |
| `rpa-system/backend/services/dlqService.js` | DLQ operations service |
| `rpa-system/backend/routes/dlqRoutes.js` | DLQ API endpoints |
| `rpa-system/backend/scripts/inspect_dlq.py` | CLI inspection tool |
| `docs/EASYFLOW_ARCHITECTURE.md` | This document |

---

## Interview Talking Points

1. **"I design systems that survive bad data."**
   - Failure memory with `retry_count`, `last_error`, `error_category`
   - Partial index on FAILED makes DLQ queries efficient

2. **"I understand concurrency at the database level."**
   - `FOR UPDATE SKIP LOCKED` for atomic job claiming
   - No double-processing even with N concurrent workers

3. **"I design for failure, not hope."**
   - Bounded retries (max 3 attempts)
   - DLQ for jobs that exhaust retries
   - Error context preserved for debugging

4. **"I think about the engineer at 3 a.m."**
   - DLQ inspection API
   - CLI tool for on-call operators
   - Error categorization for alerting

---

## Success Criteria

After Phase 1:
- [x] Jobs can be atomically claimed by multiple workers
- [x] Failed jobs preserve full error context
- [x] Failed jobs are queryable via SQL and API
- [x] Failed jobs can be replayed manually
- [x] README clearly explains concurrency and failure models
- [x] AWS mental model maps EasyFlow to cloud primitives
