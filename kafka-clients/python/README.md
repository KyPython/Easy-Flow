# EasyFlow Kafka Python Client

A Python client for interacting with Kafka clusters in the EasyFlow automation platform.

## Features

- Easy-to-use Kafka producer and consumer
- JSON message serialization/deserialization
- Environment variable configuration fallback
- Built-in error handling and logging
- Specialized methods for task and workflow messages

## Prerequisites

- Python 3.8+
- Access to a Kafka cluster (Confluent Cloud or local)

## Installation

1. Create and activate a Python virtual environment:

```bash
cd kafka-clients/python
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

## Configuration

### Option 1: Configuration File

Create or modify `client.properties` with your Kafka connection details:

```properties
bootstrap.servers=your-kafka-server:9092
security.protocol=SASL_SSL
sasl.mechanisms=PLAIN
sasl.username=your-username
sasl.password=your-password
client.id=easyflow-python-client
```

### Option 2: Environment Variables

Set the following environment variables:

```bash
export KAFKA_BOOTSTRAP_SERVERS=your-kafka-server:9092
export KAFKA_SECURITY_PROTOCOL=SASL_SSL
export KAFKA_SASL_MECHANISMS=PLAIN
export KAFKA_SASL_USERNAME=your-username
export KAFKA_SASL_PASSWORD=your-password
export KAFKA_CLIENT_ID=easyflow-python-client
```

## Usage

### Basic Producer Example

```python
from kafka_client import KafkaClient

client = KafkaClient()

# Send a task message
task_data = {
    "task_id": "task-001",
    "type": "data_processing",
    "status": "pending",
    "payload": {"input_file": "data.csv"}
}

success = client.send_task_message(task_data)
if success:
    print("Message sent successfully")
```

### Basic Consumer Example

```python
from kafka_client import KafkaClient

client = KafkaClient()

# Consume messages from automation-tasks topic
for message in client.consume_messages("automation-tasks"):
    print(f"Received: {message['value']}")
    
    # Process based on message type
    if message['value'].get('type') == 'data_processing':
        # Handle data processing task
        pass
```

### Command Line Usage

Run the example producer:
```bash
python kafka_client.py producer
```

Run the example consumer:
```bash
python kafka_client.py consumer
```

## API Reference

### KafkaClient

#### `__init__(config_path="kafka-clients/python/client.properties")`
Initialize the Kafka client with configuration.

#### `produce_message(topic, message, key=None)`
Send a message to a Kafka topic.
- `topic`: The Kafka topic name
- `message`: Dictionary or string message to send
- `key`: Optional message key for partitioning

#### `consume_messages(topic, group_id="easyflow-python-group", auto_offset_reset="earliest")`
Generator that yields messages from a Kafka topic.

#### `send_task_message(task_data, topic="automation-tasks")`
Helper method to send task messages.

#### `send_workflow_message(workflow_data, topic="workflow-events")`
Helper method to send workflow messages.

## Integration with EasyFlow

This Kafka client is designed to integrate with the EasyFlow automation platform:

- **Task Messages**: Send automation tasks to the `automation-tasks` topic
- **Workflow Events**: Send workflow triggers to the `workflow-events` topic
- **Status Updates**: Consume status updates from various topics

## Error Handling

The client includes built-in error handling:
- Automatic retry on transient failures
- Graceful handling of configuration errors
- Comprehensive logging for debugging

## Contributing

When modifying this client:
1. Follow the existing code style
2. Add appropriate error handling
3. Update this README if adding new features
4. Test with both local and cloud Kafka instances