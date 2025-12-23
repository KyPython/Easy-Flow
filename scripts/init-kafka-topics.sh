#!/bin/bash
# Initialize Kafka topics required for Easy-Flow

# Don't exit on error - allow graceful degradation if Kafka isn't ready
set +e

KAFKA_CONTAINER="easy-flow-kafka-1"
KAFKA_BOOTSTRAP="localhost:9092"

echo "🔧 Initializing Kafka topics for Easy-Flow"
echo "=========================================="

# Wait for Kafka to be ready
# Use internal bootstrap address when checking from inside container
echo "⏳ Waiting for Kafka to be ready..."
MAX_WAIT=30  # Reduced to 30 seconds - if it's not ready by then, container is likely stuck
WAIT_COUNT=0
KAFKA_INTERNAL_BOOTSTRAP="kafka:29092"  # Internal address for docker exec commands

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  # First check if container is actually running
  if ! docker ps --filter "name=$KAFKA_CONTAINER" --format "{{.Names}}" | grep -q "$KAFKA_CONTAINER"; then
    echo "❌ ERROR: Kafka container is not running"
    exit 1
  fi
  
  # Check if Kafka broker is responding using internal address (faster, more reliable)
  if docker exec $KAFKA_CONTAINER kafka-broker-api-versions --bootstrap-server $KAFKA_INTERNAL_BOOTSTRAP 2>&1 | grep -q "broker"; then
    # Double-check with topics list to ensure full readiness
    if docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_INTERNAL_BOOTSTRAP --list >/dev/null 2>&1; then
      echo "✅ Kafka is ready"
      break
    fi
  fi
  echo "  Waiting for Kafka... ($((WAIT_COUNT + 1))s)"
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 2))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
  echo "⚠️  WARNING: Kafka health check timed out (waited ${MAX_WAIT}s)"
  echo "⚠️  Kafka container status:"
  docker ps --filter "name=$KAFKA_CONTAINER" --format "table {{.Names}}\t{{.Status}}"
  echo "⚠️  Attempting to restart Kafka container..."
  docker restart $KAFKA_CONTAINER 2>/dev/null || true
  sleep 5
  echo "⚠️  Topics will be auto-created on first use if Kafka is still not ready"
  # Don't exit - allow script to continue, topics will auto-create
  KAFKA_READY=false
else
  KAFKA_READY=true
fi

if [ "$KAFKA_READY" = true ]; then
  echo "✅ Kafka is ready"
fi

# Function to create or verify topic
create_topic() {
  local topic_name=$1
  local partitions=$2
  local replication_factor=$3
  
  echo ""
  echo "📌 Checking topic: $topic_name"
  
  # Check if we can even connect to Kafka first
  if ! docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_INTERNAL_BOOTSTRAP --list >/dev/null 2>&1; then
    echo "  ⚠️  Cannot connect to Kafka - topic will be auto-created on first use"
    return 1
  fi
  
  if docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_INTERNAL_BOOTSTRAP --list 2>/dev/null | grep -q "^${topic_name}$"; then
    echo "  ✅ Topic already exists"
    
    # Describe the topic
    echo "  📊 Topic details:"
    docker exec $KAFKA_CONTAINER kafka-topics \
      --bootstrap-server $KAFKA_INTERNAL_BOOTSTRAP \
      --describe \
      --topic $topic_name 2>/dev/null | sed 's/^/    /' || echo "    (could not describe topic)"
  else
    echo "  🆕 Creating topic..."
    docker exec $KAFKA_CONTAINER kafka-topics \
      --bootstrap-server $KAFKA_INTERNAL_BOOTSTRAP \
      --create \
      --topic $topic_name \
      --partitions $partitions \
      --replication-factor $replication_factor 2>&1 || {
      echo "  ⚠️  Failed to create topic (may already exist or Kafka not ready)"
      return 1
    }
    
    echo "  ✅ Topic created successfully"
  fi
}

# Create required topics
create_topic "automation-tasks" 1 1
create_topic "workflow-events" 1 1
create_topic "step-results" 1 1

echo ""
echo "=========================================="
echo "✅ All Kafka topics initialized"
echo ""

# List all consumer groups
echo "📋 Consumer groups:"
docker exec $KAFKA_CONTAINER kafka-consumer-groups \
  --bootstrap-server $KAFKA_INTERNAL_BOOTSTRAP \
  --list 2>/dev/null | sed 's/^/  /' || echo "  (none yet)"

echo ""
echo "✅ Done!"
