EasyFlow

EasyFlow is a general-purpose workflow orchestration engine focused on reliability, concurrency control, and fault isolation in distributed systems.

It is designed to demonstrate how enterprise-grade systems safely coordinate work across unreliable inputs, legacy data sources, and evolving architectures — using PostgreSQL as a durable coordination layer.

Rather than optimizing for “happy-path” automation, EasyFlow prioritizes:
	•	exactly-once semantics
	•	bounded retries
	•	dead-letter queues
	•	observability
	•	safe horizontal scaling

⸻

Why EasyFlow Exists

Most workflow examples stop at “it works.”
EasyFlow focuses on “it keeps working when things go wrong.”

The project explores how to:
	•	prevent double-processing of critical jobs
	•	isolate poison-pill data
	•	safely scale workers without collisions
	•	recover and replay failures intentionally
	•	evolve workflows without breaking in-flight work

These are the same concerns faced by:
	•	claims processing
	•	financial transactions
	•	data pipelines
	•	background job systems
	•	legacy-to-modern migrations

⸻

Core Design Principles

1. Atomic Job Claiming

Workers claim jobs using row-level locking (FOR UPDATE SKIP LOCKED), allowing multiple workers to run concurrently without race conditions or duplicate processing.

This mirrors queue semantics found in systems like SQS while retaining strong consistency guarantees.

⸻

2. Exactly-Once Semantics

Each workflow step is processed at most once, even under retries, crashes, or worker restarts.
	•	Idempotency keys
	•	Atomic state transitions
	•	Durable state stored in Postgres

This prevents failures like double-payments or duplicate side effects.

⸻

3. Bounded Retries & Dead Letter Queues (DLQ)

Failures are tracked explicitly:
	•	Each job records retry_count and last_error
	•	After exceeding a retry threshold, jobs move to a FAILED state
	•	Failed jobs are isolated instead of blocking the system

A dedicated inspection tool allows operators to:
	•	see why a job failed
	•	replay or remediate intentionally

⸻

4. Observability First

Debuggability is treated as a first-class feature.

EasyFlow makes it easy to answer:
	•	What failed?
	•	Why did it fail?
	•	How often does it fail?
	•	Can we safely replay it?

Because in production systems, visibility matters more than perfection.

⸻

Architecture Overview

Core Components
	•	PostgreSQL — durable state, coordination, locking
	•	Worker Processes — concurrent job execution
	•	Workflow Queue — explicit state machine
	•	DLQ Inspector — failure analysis and recovery

Conceptual AWS Mapping
	•	PostgreSQL → SQS + DynamoDB
	•	Workers → Lambda / ECS
	•	DLQ → SQS DLQ
	•	Inspect Tool → CloudWatch + custom tooling

This mapping is intentional to demonstrate cloud-native patterns without requiring cloud infrastructure.

⸻

Use Cases (Examples, Not Identity)

EasyFlow has been exercised against scenarios such as:
	•	Legacy flat-file ingestion (e.g., mainframe exports)
	•	Portal-driven CSV automation
	•	Long-running background workflows
	•	Multi-step data normalization pipelines

These are examples of stress, not constraints on the engine’s scope.

⸻

Getting Started (Development)

# Start development environment (auto-installs dependencies)
./start-dev.sh

Local services:
	•	Frontend: http://localhost:3000
	•	Backend API: http://localhost:3030

See DAILY_DEVELOPER_GUIDE.md for full setup and daily workflow.

⸻

Developer Documentation
	•	DAILY_DEVELOPER_GUIDE.md — daily development workflow
	•	CODEBASE_NAVIGATION.md — full codebase map
	•	docs/guides/easyflow_guide.md — system-level walkthrough
	•	BRANCH_AWARE_CI_CD.md — validation & deployment model

⸻

What This Project Demonstrates

This repository is intended to show:
	•	backend system design judgment
	•	concurrency control in practice
	•	failure-aware architecture
	•	production-oriented thinking

It is not a demo app — it is an architectural artifact.

⸻

Status

EasyFlow is actively evolving as a systems exploration project.
Interfaces and internals may change as reliability guarantees are strengthened.

