#!/bin/bash

# EasyFlow Interview Practice CLI - LOCAL USE ONLY (gitignored)
# Usage: ./interview_practice.sh [--hostile]

# Inline flashcards (SRP: single source of truth in this file)
HOSTILE_QUESTIONS=(
    "What if the API has a bug that bypasses tenant checks?"
    "Why didn't you just use separate databases per tenant from day one?"
    "How do you prevent noisy neighbors?"
    "What happens if the queue fails?"
)

HOSTILE_ANSWERS=(
    "The database still enforces isolation through row-level security. A bad API call can't cross tenant boundaries. The database is the source of truth—if someone passes the wrong tenant_id, the database catches it and refuses. The app doesn't even know it happened."
    "Cost and operational overhead. Shared infrastructure with hard isolation lets you move faster early, then split when there's real pressure—compliance, enterprise contracts, or noisy-neighbor risk."
    "Tenant-scoped workers, Kafka topic partitioning, per-tenant rate limits, concurrency caps, and fair scheduling. Resource contention is isolated economically, not allowed to cascade."
    "Async workflows pause, but correctness and isolation remain intact. The database is the source of truth. Requests either fail fast with retryable errors or persist intent for replay."
)

ALL_QUESTIONS=(
    "What is EasyFlow in 15 seconds?"
    "What is EasyFlow in 30 seconds?"
    "What mistake does the multi-tenant system prevent?"
    "Why didn't you just use separate databases per tenant from day one?"
    "How do you prevent noisy neighbors?"
    "What happens if the queue fails?"
    "Why do you use Kafka if queues aren't trusted?"
    "How do you handle cost optimization?"
    "What are the three failure classes in EasyFlow?"
    "Describe a real problem you solved with EasyFlow."
)

ALL_ANSWERS=(
    "EasyFlow is a multi-tenant workflow automation system I built with strict tenant isolation. Tenant identity is resolved at the API using JWTs and enforced end-to-end through Kafka, workers, and Postgres row-level security. The key design goal: preventing cross-tenant data access even under shared infrastructure."
    "EasyFlow is a multi-tenant workflow automation system with defense-in-depth isolation. Tenant identity is resolved at the API using JWTs and propagated through Kafka topics, worker execution, and Postgres schemas with row-level security. I designed it so even if the API layer fails, the database still enforces tenant boundaries. We start with shared infrastructure for cost efficiency and only split when scale or compliance requires it."
    "Two mistakes: 1) Someone passes the wrong tenant_id to the database, 2) A buggy API bypasses tenant checks. With row-level security, the database is the source of truth—it REFUSES operations for the wrong tenant. The app doesn't even know it happened. Defense-in-depth: even if the application layer fails, the database still blocks cross-tenant access."
    "Cost and operational overhead. Shared infrastructure with hard isolation lets you move faster early, then split when there's real pressure—compliance, enterprise contracts, or noisy-neighbor risk."
    "Tenant-scoped workers, Kafka topic partitioning, per-tenant rate limits, concurrency caps, and fair scheduling. Resource contention is isolated economically, not allowed to cascade."
    "Async workflows pause, but correctness and isolation remain intact. The database is the source of truth. Requests either fail fast with retryable errors or persist intent for replay."
    "Queues optimize throughput but are never trusted for correctness. They decouple request handling from execution. If the queue is unavailable, we allow availability to drop rather than risk correctness or isolation."
    "Three execution modes: user-triggered is real-time (0.004/exec), scheduled uses eco-mode during off-peak windows (0.003/exec, ~25% cheaper), and balanced is the default (0.0035/exec)."
    "1) Throughput failures (queue down) - async pauses but correctness intact. 2) Security failures (RLS misconfig) - treated as security regression with limited blast radius. 3) Economic failures (noisy tenants) - rate limits and fair scheduling prevent cascade."
    "Analytics queries were scanning millions of workflow records. Instead of over-indexing the OLTP database, I moved aggregation to off-peak execution windows, scoped queries by tenant, enforced RLS, and validated system stability under load. Result: analytics added without impacting OLTP or tenant isolation."
)

# Parse arguments
HOSTILE=false
for arg in "$@"; do
    case $arg in
        --hostile)
            HOSTILE=true
            ;;
    esac
done

if [ "$HOSTILE" = true ]; then
    echo "=== HOSTILE INTERVIEW MODE ==="
    echo "Prepare for pushback. Stay calm. Answer with principles, not defensiveness."
    echo ""
    QUESTIONS=("${HOSTILE_QUESTIONS[@]}")
    ANSWERS=("${HOSTILE_ANSWERS[@]}")
else
    QUESTIONS=("${ALL_QUESTIONS[@]}")
    ANSWERS=("${ALL_ANSWERS[@]}")
fi

echo "Press Enter to see each answer..."
echo ""

for i in "${!QUESTIONS[@]}"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Q: ${QUESTIONS[$i]}"
    echo ""
    read -r
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "${ANSWERS[$i]}"
    echo ""
done

echo "=== Practice Complete ==="
echo "Key metrics to track:"
echo "  - Clarity: How crisp were your answers?"
echo "  - Brevity: Did you stay within time limits?"
echo "  - Confidence: Did you hesitate or search for words?"
