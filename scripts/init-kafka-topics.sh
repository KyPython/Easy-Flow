#!/bin/bash
# Initialize Kafka topics required for Easy-Flow

set -e

KAFKA_CONTAINER="easy-flow-kafka-1"
KAFKA_BOOTSTRAP="localhost:9092"

echo "🔧 Initializing Kafka topics for Easy-Flow"
echo "=========================================="

# Wait for Kafka to be ready
echo "⏳ Waiting for Kafka to be ready..."
timeout 60s bash -c "until docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP --list >/dev/null 2>&1; do echo '  Waiting for Kafka...'; sleep 2; done" || {
  echo "❌ ERROR: Kafka did not become ready in time"
  exit 1
}

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
