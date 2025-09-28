# EasyFlow Kafka Node.js Client

A Node.js client for interacting with Kafka clusters in the EasyFlow automation platform.

## Features

- Easy-to-use Kafka producer and consumer classes
- JSON message serialization/deserialization
- Environment variable configuration fallback
- Built-in error handling and logging
- Specialized methods for task, workflow, and status messages
- Graceful shutdown handling
- Connection pooling and reuse

## Prerequisites

- Node.js 18+ 
- Access to a Kafka cluster (Confluent Cloud or local)

## Installation

1. Navigate to the Node.js client directory:

```bash
cd kafka-clients/nodejs
```

2. Install dependencies:

```bash
npm install
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
client.id=easyflow-nodejs-client
```

### Option 2: Environment Variables

Set the following environment variables:

```bash
export KAFKA_BOOTSTRAP_SERVERS=your-kafka-server:9092
export KAFKA_SECURITY_PROTOCOL=SASL_SSL
export KAFKA_SASL_MECHANISMS=PLAIN
export KAFKA_SASL_USERNAME=your-username
export KAFKA_SASL_PASSWORD=your-password
export KAFKA_CLIENT_ID=easyflow-nodejs-client
```

## Usage

### Basic Producer Example

```javascript
const KafkaClient = require('./kafkaClient');

async function sendMessage() {
    const client = new KafkaClient();
    
    try {
        // Send a task message
        await client.sendTaskMessage({
            taskId: "task-001",
            type: "automation_run",
            status: "pending",
            payload: {
                script: "data_processing.js",
                parameters: { inputFile: "data.csv" }
            }
        });
        
        console.log("Message sent successfully");
    } finally {
        await client.disconnect();
    }
}

sendMessage();
```

### Basic Consumer Example

```javascript
const KafkaClient = require('./kafkaClient');

async function consumeMessages() {
    const client = new KafkaClient();
    
    try {
        await client.consumeMessages("automation-tasks", async (message) => {
            console.log("Received message:", message.parsedValue);
            
            // Process based on message type
            if (message.parsedValue.type === 'automation_run') {
                // Handle automation run
                console.log("Processing automation run...");
            }
        });
    } catch (error) {
        console.error("Consumer failed:", error);
    }
}

consumeMessages();
```

### Command Line Usage

Run the example producer:
```bash
npm run producer
# or
node kafkaClient.js producer
```

Run the example consumer:
```bash
npm run consumer
# or
node kafkaClient.js consumer
```

## API Reference

### KafkaClient

#### `constructor(configPath)`
Initialize the Kafka client with configuration file path.

#### `async produceMessage(topic, message, key)`
Send a message to a Kafka topic.
- `topic`: The Kafka topic name
- `message`: Object or string message to send
- `key`: Optional message key for partitioning

#### `async consumeMessages(topic, messageHandler, groupId)`
Start consuming messages from a topic.
- `topic`: The Kafka topic name
- `messageHandler`: Async function to process each message
- `groupId`: Consumer group ID (optional)

#### `async sendTaskMessage(taskData, topic)`
Helper method to send task messages to automation topics.

#### `async sendWorkflowMessage(workflowData, topic)`
Helper method to send workflow event messages.

#### `async sendStatusUpdate(statusData, topic)`
Helper method to send status update messages.

#### `async disconnect()`
Properly disconnect producer and consumer connections.

## Integration with EasyFlow

This client integrates with the EasyFlow platform for:

- **Automation Tasks**: Send/receive automation run requests
- **Workflow Events**: Handle workflow triggers and status updates
- **Real-time Updates**: Stream status changes to dashboard
- **Cross-service Communication**: Enable microservice messaging

## Message Types

### Task Messages
```javascript
{
    taskId: "task-001",
    type: "automation_run",
    status: "pending",
    payload: { script: "script.js", parameters: {} },
    createdAt: "2024-01-01T10:00:00Z"
}
```

### Workflow Messages
```javascript
{
    workflowId: "workflow-001",
    event: "started",
    status: "running",
    data: { initiatedBy: "user123" },
    timestamp: "2024-01-01T10:00:00Z"
}
```

### Status Updates
```javascript
{
    entityId: "task-001",
    entityType: "task",
    status: "completed",
    message: "Task completed successfully",
    timestamp: "2024-01-01T10:05:00Z"
}
```

## Error Handling

The client includes comprehensive error handling:
- Automatic connection retry
- Graceful shutdown on process termination
- Message delivery confirmation
- Configuration validation

## Contributing

When modifying this client:
1. Follow Node.js best practices
2. Add proper error handling
3. Update documentation for new features
4. Test with both local and cloud Kafka instances
5. Ensure graceful shutdown behavior