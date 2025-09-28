# EasyFlow Kafka Clients

This directory contains Kafka clients for the EasyFlow automation platform, providing messaging capabilities for task orchestration, workflow management, and real-time updates.

## Overview

The EasyFlow platform uses Kafka for:
- **Task Distribution**: Sending automation tasks to worker services
- **Status Updates**: Real-time progress tracking and notifications
- **Workflow Orchestration**: Coordinating complex automation workflows
- **Event Streaming**: Broadcasting system events and state changes

## Client Implementations

### 1. Python Client (`python/`)
- **Purpose**: Automation task processing and background services
- **Framework**: confluent-kafka-python
- **Use Cases**: 
  - Task execution workers
  - Data processing services
  - Background automation scripts

### 2. Node.js Client (`nodejs/`)
- **Purpose**: Web application integration and real-time features
- **Framework**: @confluentinc/kafka-javascript
- **Use Cases**:
  - Dashboard real-time updates
  - API endpoint integration
  - WebSocket message routing

## Quick Start

### Python Client
```bash
cd kafka-clients/python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python kafka_client.py producer  # Test producer
python kafka_client.py consumer  # Test consumer
```

### Node.js Client
```bash
cd kafka-clients/nodejs
npm install
npm run producer  # Test producer
npm run consumer  # Test consumer
```

## Configuration

Both clients support two configuration methods:

### 1. Configuration Files
- `python/client.properties` 
- `nodejs/client.properties`

### 2. Environment Variables
```bash
export KAFKA_BOOTSTRAP_SERVERS=your-server:9092
export KAFKA_SECURITY_PROTOCOL=SASL_SSL
export KAFKA_SASL_MECHANISMS=PLAIN
export KAFKA_SASL_USERNAME=your-username
export KAFKA_SASL_PASSWORD=your-password
```

## Topics

The platform uses these primary topics:

| Topic | Purpose | Producers | Consumers |
|-------|---------|-----------|-----------|
| `automation-tasks` | Task distribution | Dashboard, API | Worker services |
| `automation-results` | Task completion status | Worker services | Dashboard, API |
| `workflow-events` | Workflow state changes | All services | Dashboard, API |
| `status-updates` | Real-time notifications | All services | Dashboard |

## Message Formats

### Task Message
```json
{
  "taskId": "task-001",
  "type": "automation_run",
  "status": "pending",
  "payload": {
    "script": "data_processing.py",
    "parameters": {}
  },
  "createdAt": "2024-01-01T10:00:00Z"
}
```

### Status Update
```json
{
  "entityId": "task-001",
  "entityType": "task",
  "status": "completed",
  "message": "Task completed successfully",
  "timestamp": "2024-01-01T10:05:00Z"
}
```

## Integration with EasyFlow

### Backend Integration
The Node.js client is already integrated with the RPA system backend at:
- `rpa-system/backend/utils/kafkaService.js`

### Adding New Services
1. Choose appropriate client (Python for workers, Node.js for web services)
2. Import the client class
3. Configure connection settings
4. Implement message handlers for your service's needs

## Development

### Testing
Both clients include test commands and example implementations:
- Producer examples for sending test messages
- Consumer examples for processing messages
- Command-line interfaces for testing

### Monitoring
Monitor your Kafka integration:
- Check client health endpoints
- Monitor topic lag and throughput
- Review error logs for connection issues

## Troubleshooting

### Common Issues
1. **Connection Failures**: Verify broker URLs and credentials
2. **SSL/SASL Errors**: Check authentication configuration
3. **Topic Not Found**: Ensure topics exist or enable auto-creation
4. **Consumer Lag**: Monitor partition assignment and processing time

### Debug Mode
Enable debug logging:
```bash
# Python
export KAFKA_LOG_LEVEL=DEBUG

# Node.js
export DEBUG=kafka*
```

## Contributing

When extending these clients:
1. Follow existing code patterns
2. Add comprehensive error handling
3. Update documentation
4. Test with both local and cloud Kafka instances
5. Ensure backward compatibility

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │  Worker Service │
│  (Node.js)      │    │   (Python)      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────┬─────────┬─────┘
                 │         │
         ┌───────▼─────────▼────────┐
         │     Kafka Cluster        │
         │   (Confluent Cloud)      │
         └──────────────────────────┘
```

This architecture enables scalable, reliable messaging between all EasyFlow components.