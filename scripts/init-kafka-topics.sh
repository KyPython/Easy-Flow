#!/bin/bash
# Initialize Kafka topics required for Easy-Flow

set -e

KAFKA_CONTAINER="easy-flow-kafka-1"
KAFKA_BOOTSTRAP="localhost:9092"

echo "🔧 Initializing Kafka topics for Easy-Flow"
echo "=========================================="

# Wait for Kafka to be ready
# Use kafka-broker-api-versions as it's faster and more reliable than kafka-topics --list
echo "⏳ Waiting for Kafka to be ready..."
MAX_WAIT=90  # Increased timeout to 90 seconds for slower systems
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  # Check if Kafka broker is responding using broker API versions (faster check)
  if docker exec $KAFKA_CONTAINER kafka-broker-api-versions --bootstrap-server $KAFKA_BOOTSTRAP 2>&1 | grep -q "broker"; then
    # Double-check with topics list to ensure full readiness
    if docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP --list >/dev/null 2>&1; then
      echo "✅ Kafka is ready"
      break
    fi
  fi
  echo "  Waiting for Kafka... ($((WAIT_COUNT + 1))s)"
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 2))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
  echo "❌ ERROR: Kafka did not become ready in time (waited ${MAX_WAIT}s)"
  echo "⚠️  Kafka container status:"
  docker ps --filter "name=$KAFKA_CONTAINER" --format "table {{.Names}}\t{{.Status}}"
  echo "⚠️  Kafka logs (last 10 lines):"
  docker logs $KAFKA_CONTAINER --tail 10 2>&1 | sed 's/^/  /'
  exit 1
fi

echo "✅ Kafka is ready"

# Function to create or verify topic
create_topic() {
  local topic_name=$1
  local partitions=$2
  local replication_factor=$3
  
  echo ""
  echo "📌 Checking topic: $topic_name"
  
  if docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP --list | grep -q "^${topic_name}$"; then
    echo "  ✅ Topic already exists"
    
    # Describe the topic
    echo "  📊 Topic details:"
    docker exec $KAFKA_CONTAINER kafka-topics \
      --bootstrap-server $KAFKA_BOOTSTRAP \
      --describe \
      --topic $topic_name | sed 's/^/    /'
  else
    echo "  🆕 Creating topic..."
    docker exec $KAFKA_CONTAINER kafka-topics \
      --bootstrap-server $KAFKA_BOOTSTRAP \
      --create \
      --topic $topic_name \
      --partitions $partitions \
      --replication-factor $replication_factor
    
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
  --bootstrap-server $KAFKA_BOOTSTRAP \
  --list 2>/dev/null | sed 's/^/  /' || echo "  (none yet)"

echo ""
echo "✅ Done!"
