#!/bin/bash

# ==============================================
# Kafka Initialization Script for Python Services
# ==============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Initializing Kafka for Python Microservices${NC}"

# Configuration
KAFKA_HOST=${KAFKA_HOST:-"localhost"}
KAFKA_PORT=${KAFKA_PORT:-"9092"}
KAFKA_BOOTSTRAP_SERVERS="${KAFKA_HOST}:${KAFKA_PORT}"
MAX_WAIT_TIME=${MAX_WAIT_TIME:-120}  # 2 minutes max wait
CHECK_INTERVAL=${CHECK_INTERVAL:-5}   # Check every 5 seconds

# Topics to create
TOPICS=(
    "automation-tasks:3:1"      # topic:partitions:replication
    "automation-results:3:1"
    "email-tasks:1:1"
    "notification-tasks:1:1"
)

# Function to check if Kafka is ready
check_kafka_ready() {
    echo -e "${YELLOW}📡 Checking Kafka connectivity at ${KAFKA_BOOTSTRAP_SERVERS}...${NC}"
    
    # Try to connect using Python kafka library
    python3 -c "
import sys
try:
    from kafka import KafkaProducer
    from kafka.errors import NoBrokersAvailable
    
    producer = KafkaProducer(
        bootstrap_servers=['${KAFKA_BOOTSTRAP_SERVERS}'],
        request_timeout_ms=5000,
        api_version=(0, 10, 1)
    )
    
    # Try to get metadata
    metadata = producer.list_topics(timeout=5)
    producer.close()
    print('✅ Kafka is ready')
    sys.exit(0)
    
except NoBrokersAvailable:
    print('❌ No Kafka brokers available')
    sys.exit(1)
except Exception as e:
    print(f'❌ Kafka connection failed: {e}')
    sys.exit(1)
"
}

# Function to wait for Kafka
wait_for_kafka() {
    echo -e "${YELLOW}⏳ Waiting for Kafka to be ready...${NC}"
    
    local elapsed=0
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if check_kafka_ready > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Kafka is ready after ${elapsed} seconds${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏱️ Kafka not ready yet, waiting... (${elapsed}s/${MAX_WAIT_TIME}s)${NC}"
        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
    done
    
    echo -e "${RED}❌ Timeout waiting for Kafka after ${MAX_WAIT_TIME} seconds${NC}"
    return 1
}

# Function to create topics
create_topics() {
    echo -e "${BLUE}📋 Creating Kafka topics...${NC}"
    
    for topic_config in "${TOPICS[@]}"; do
        IFS=':' read -ra TOPIC_PARTS <<< "$topic_config"
        topic_name="${TOPIC_PARTS[0]}"
        partitions="${TOPIC_PARTS[1]}"
        replication="${TOPIC_PARTS[2]}"
        
        echo -e "${YELLOW}📝 Creating topic: ${topic_name} (${partitions} partitions, ${replication} replication)${NC}"
        
        python3 -c "
import sys
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError

try:
    admin_client = KafkaAdminClient(
        bootstrap_servers=['${KAFKA_BOOTSTRAP_SERVERS}'],
        request_timeout_ms=10000
    )
    
    topic = NewTopic(
        name='${topic_name}',
        num_partitions=${partitions},
        replication_factor=${replication}
    )
    
    admin_client.create_topics([topic])
    print(f'✅ Topic ${topic_name} created successfully')
    
except TopicAlreadyExistsError:
    print(f'ℹ️ Topic ${topic_name} already exists')
except Exception as e:
    print(f'❌ Failed to create topic ${topic_name}: {e}')
    sys.exit(1)
finally:
    admin_client.close()
"
    done
}

# Function to verify topics
verify_topics() {
    echo -e "${BLUE}🔍 Verifying Kafka topics...${NC}"
    
    python3 -c "
from kafka import KafkaProducer
from kafka.errors import KafkaError

try:
    producer = KafkaProducer(
        bootstrap_servers=['${KAFKA_BOOTSTRAP_SERVERS}'],
        request_timeout_ms=10000
    )
    
    metadata = producer.list_topics(timeout=10)
    topics = list(metadata.topics.keys())
    
    print(f'📊 Available topics: {topics}')
    
    # Check if our required topics exist
    required_topics = ['automation-tasks', 'automation-results']
    missing_topics = [t for t in required_topics if t not in topics]
    
    if missing_topics:
        print(f'❌ Missing required topics: {missing_topics}')
        exit(1)
    else:
        print(f'✅ All required topics are available')
    
    producer.close()
    
except Exception as e:
    print(f'❌ Topic verification failed: {e}')
    exit(1)
"
}

# Function to test Kafka connectivity
test_connectivity() {
    echo -e "${BLUE}🧪 Testing Kafka connectivity...${NC}"
    
    python3 -c "
import json
import uuid
from kafka import KafkaProducer, KafkaConsumer
from kafka.errors import KafkaError

# Test producer
try:
    producer = KafkaProducer(
        bootstrap_servers=['${KAFKA_BOOTSTRAP_SERVERS}'],
        value_serializer=lambda x: json.dumps(x).encode('utf-8'),
        request_timeout_ms=10000
    )
    
    test_message = {
        'test_id': str(uuid.uuid4()),
        'message': 'Kafka connectivity test',
        'timestamp': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
    }
    
    future = producer.send('automation-tasks', test_message)
    record_metadata = future.get(timeout=10)
    
    print(f'✅ Test message sent - Topic: {record_metadata.topic}, Partition: {record_metadata.partition}')
    producer.close()
    
except Exception as e:
    print(f'❌ Producer test failed: {e}')
    exit(1)

# Test consumer
try:
    consumer = KafkaConsumer(
        'automation-results',
        bootstrap_servers=['${KAFKA_BOOTSTRAP_SERVERS}'],
        auto_offset_reset='latest',
        enable_auto_commit=False,
        consumer_timeout_ms=5000,
        value_deserializer=lambda x: json.loads(x.decode('utf-8'))
    )
    
    print('✅ Consumer connected successfully')
    consumer.close()
    
except Exception as e:
    print(f'❌ Consumer test failed: {e}')
    exit(1)

print('🎉 Kafka connectivity test completed successfully')
"
}

# Function to setup Python environment
setup_python_env() {
    echo -e "${BLUE}🐍 Setting up Python environment...${NC}"
    
    # Check if kafka-python is installed
    if ! python3 -c "import kafka" 2>/dev/null; then
        echo -e "${YELLOW}📦 Installing kafka-python...${NC}"
        pip3 install kafka-python==2.0.2
    else
        echo -e "${GREEN}✅ kafka-python already installed${NC}"
    fi
    
    # Verify installation
    python3 -c "
import kafka
print(f'✅ kafka-python version: {kafka.__version__}')
"
}

# Main execution
main() {
    echo -e "${BLUE}=====================================
🚀 Kafka Initialization for Python Services
=====================================${NC}"
    
    # Check if Kafka should be enabled
    if [[ "${KAFKA_ENABLED:-true}" == "false" ]]; then
        echo -e "${YELLOW}🔇 Kafka is disabled (KAFKA_ENABLED=false)${NC}"
        echo -e "${GREEN}✅ Initialization skipped${NC}"
        exit 0
    fi
    
    # Setup Python environment
    setup_python_env
    
    # Wait for Kafka to be ready
    if ! wait_for_kafka; then
        echo -e "${RED}❌ Kafka initialization failed - service unavailable${NC}"
        
        # Check if we should fail or continue
        if [[ "${KAFKA_REQUIRED:-true}" == "true" ]]; then
            exit 1
        else
            echo -e "${YELLOW}⚠️ Continuing without Kafka (KAFKA_REQUIRED=false)${NC}"
            exit 0
        fi
    fi
    
    # Create topics
    create_topics
    
    # Verify topics
    verify_topics
    
    # Test connectivity
    test_connectivity
    
    echo -e "${GREEN}🎉 Kafka initialization completed successfully!${NC}"
    echo -e "${GREEN}✅ Python microservices can now connect to Kafka${NC}"
    echo -e "${BLUE}📋 Topics created: ${TOPICS[*]}${NC}"
    echo -e "${BLUE}🔗 Bootstrap servers: ${KAFKA_BOOTSTRAP_SERVERS}${NC}"
}

# Handle script arguments
case "${1:-}" in
    "check")
        check_kafka_ready
        ;;
    "topics")
        create_topics
        ;;
    "test")
        test_connectivity
        ;;
    "verify")
        verify_topics
        ;;
    *)
        main
        ;;
esac
