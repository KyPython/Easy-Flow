# Kafka-based Scalable Automation Microservices

This project implements a highly scalable, enterprise-grade automation system using Docker containers, Apache Kafka message queues, and horizontally scalable Python microservices.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Nginx Load     │    │   Backend Service   │
│   (React)       │───▶│   Balancer       │───▶│   (Node.js + Kafka) │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │                         │
                                │                         ▼
                                │                ┌─────────────────────┐
                                │                │   Kafka Broker      │
                                │                │   + Zookeeper       │
                                │                └─────────────────────┘
                                │                         │
                                │        ┌────────────────┼────────────────┐
                                │        │                │                │
                                ▼        ▼                ▼                ▼
                    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                    │ Automation      │ │ Automation      │ │ Automation      │
                    │ Worker 1        │ │ Worker 2        │ │ Worker 3        │
                    │ (Python+Kafka)  │ │ (Python+Kafka)  │ │ (Python+Kafka)  │
                    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 🚀 Key Features

- **Horizontal Scaling**: Add/remove automation workers dynamically
- **Message Queuing**: Kafka-based task distribution and result collection
- **Load Balancing**: Nginx distributes requests across multiple workers
- **Health Monitoring**: Comprehensive health checks and metrics
- **Container Orchestration**: Docker Compose for easy deployment
- **Real-time Monitoring**: Kafka UI for queue monitoring
- **Fault Tolerance**: Automatic retries and graceful error handling
- **Legacy Compatibility**: Existing APIs still work with Kafka backend

## 📋 Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- 8GB+ RAM recommended for full stack
- Ports 80, 3000, 5000, 8080, 9092 available

## 🛠️ Quick Start

### 1. Deploy the Full Stack

```bash
# Clone the repository and navigate to the project
cd rpa-system

# Start all services (this may take a few minutes)
./deploy-kafka.sh

# Or with cleanup (removes old containers/images)
./deploy-kafka.sh --clean
```

### 2. Verify Deployment

```bash
# Check service health
./monitor-kafka.sh

# Or run continuous monitoring
./monitor-kafka.sh --continuous
```

### 3. Access Services

- **Kafka UI (Monitoring)**: http://localhost:8080
- **Load Balancer**: http://localhost
- **Backend API**: http://localhost/api
- **Worker Health Checks**: http://localhost/worker-{1,2,3}/health
- **Downloaded Files**: http://localhost/downloads

## 🔧 Configuration

### Environment Variables

| Variable                  | Default              | Description                 |
| ------------------------- | -------------------- | --------------------------- |
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092`         | Kafka broker addresses      |
| `KAFKA_TASK_TOPIC`        | `automation-tasks`   | Topic for task messages     |
| `KAFKA_RESULT_TOPIC`      | `automation-results` | Topic for result messages   |
| `KAFKA_CONSUMER_GROUP`    | `automation-workers` | Consumer group for workers  |
| `MAX_WORKERS`             | `3`                  | Thread pool size per worker |

### Scaling Workers

```bash
# Scale to 5 automation workers
docker-compose -f docker-compose.kafka.yml up -d --scale automation-worker=5

# Or edit docker-compose.kafka.yml to add more named workers
```

## 📚 API Documentation

### 🔄 New Kafka-based Endpoints

#### Queue Automation Task (Fire-and-Forget)

```bash
curl -X POST http://localhost/api/automation/queue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "task_type": "web_automation",
    "url": "https://example.com",
    "actions": [
      {"type": "click", "selector": "#submit-btn"},
      {"type": "wait", "value": "3"}
    ]
  }'
```

#### Execute Automation Task (With Result)

```bash
curl -X POST http://localhost/api/automation/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "task_type": "data_extraction",
    "url": "https://example.com/products",
    "selectors": {
      "title": "h1.product-title",
      "price": ".price",
      "description": ".product-desc"
    }
  }'
```

#### Batch Processing

```bash
curl -X POST http://localhost/api/automation/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "mode": "queue",
    "tasks": [
      {
        "task_type": "web_automation",
        "url": "https://site1.com",
        "actions": [{"type": "click", "selector": "#btn1"}]
      },
      {
        "task_type": "data_extraction",
        "url": "https://site2.com",
        "selectors": {"title": "h1"}
      }
    ]
  }'
```

### 📊 Health & Monitoring Endpoints

- `GET /health` - Backend service health
- `GET /api/kafka/health` - Kafka connection status
- `GET /worker-{N}/health` - Individual worker health
- `GET /worker-{N}/status` - Worker detailed status
- `GET /worker-{N}/metrics` - Worker performance metrics

### 🔙 Legacy Compatibility

All existing endpoints continue to work:

- `POST /api/trigger-automation` - Now uses Kafka backend
- `POST /api/trigger-campaign` - Email campaigns still functional

## 🎯 Supported Task Types

### 1. Web Automation

```json
{
  "task_type": "web_automation",
  "url": "https://example.com",
  "actions": [
    { "type": "click", "selector": "#button" },
    { "type": "input", "selector": "#field", "value": "text" },
    { "type": "wait", "value": "2" },
    { "type": "extract", "selector": ".result" }
  ]
}
```

### 2. Form Submission

```json
{
  "task_type": "form_submission",
  "url": "https://example.com/form",
  "form_data": {
    "username": "testuser",
    "email": "test@example.com"
  },
  "submit_selector": "input[type='submit']"
}
```

### 3. Data Extraction

```json
{
  "task_type": "data_extraction",
  "url": "https://example.com/data",
  "selectors": {
    "title": "h1",
    "items": ".list-item",
    "price": ".price"
  }
}
```

### 4. File Download

```json
{
  "task_type": "file_download",
  "url": "https://example.com/file.pdf",
  "download_selector": "#download-btn"
}
```

## 🔍 Monitoring & Debugging

### Real-time Monitoring

```bash
# Watch all services
./monitor-kafka.sh --continuous

# Run performance test
./monitor-kafka.sh --test

# View logs
docker-compose -f docker-compose.kafka.yml logs -f

# View specific service logs
docker-compose -f docker-compose.kafka.yml logs -f automation-worker-1
```

### Kafka UI Dashboard

Access http://localhost:8080 for:

- Topic message counts
- Consumer group lag
- Worker activity
- Message routing

### Debug Individual Workers

```bash
# Check worker 1 status
curl http://localhost/worker-1/status

# Check worker health
curl http://localhost/worker-1/health

# View worker metrics
curl http://localhost/worker-1/metrics
```

## 🚦 Load Testing

The system includes built-in performance testing:

```bash
# Send test automation tasks
./monitor-kafka.sh --test

# Or manual load test
for i in {1..10}; do
  curl -X POST http://localhost/api/automation/queue \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer TOKEN" \
    -d "{\"task_type\":\"web_automation\",\"url\":\"https://httpbin.org/delay/2\"}" &
done
```

## 🔧 Troubleshooting

### Common Issues

1. **Kafka Connection Failed**

   ```bash
   # Check Kafka logs
   docker logs kafka

   # Restart Kafka services
   docker-compose -f docker-compose.kafka.yml restart kafka zookeeper
   ```

2. **Workers Not Processing Tasks**

   ```bash
   # Check worker logs
   docker-compose -f docker-compose.kafka.yml logs automation-worker-1

   # Check Kafka topics
   docker exec kafka kafka-topics --list --bootstrap-server localhost:9092
   ```

3. **High Memory Usage**

   ```bash
   # Check resource usage
   docker stats

   # Reduce worker count or thread pool size
   # Edit MAX_WORKERS environment variable
   ```

### Performance Tuning

- **Increase Workers**: Scale horizontally by adding more worker containers
- **Tune Thread Pools**: Adjust `MAX_WORKERS` environment variable
- **Kafka Partitions**: Increase topic partitions for better parallelism
- **Resource Limits**: Adjust Docker resource limits in docker-compose.yml

## 🔒 Security Considerations

- All API endpoints require authentication
- Rate limiting on automation endpoints
- Container isolation with Docker networks
- No external ports exposed for Kafka (internal only)
- SSL/TLS ready (certificates required)

## 📈 Production Deployment

For production use:

1. **Use External Kafka Cluster**: Replace embedded Kafka with managed service
2. **Configure SSL**: Add SSL certificates for HTTPS
3. **Database Persistence**: Ensure Kafka data persistence
4. **Resource Limits**: Set appropriate CPU/memory limits
5. **Monitoring**: Add Prometheus/Grafana for metrics
6. **Backup Strategy**: Implement Kafka topic backup

## 🤝 Contributing

The system is designed for extensibility:

- Add new task types in `automation/automate.py`
- Extend API endpoints in `backend/index.js`
- Modify Docker configurations as needed
- Add monitoring/alerting integrations

## 📄 License

This project is part of the EasyFlow automation system.

---

🎉 **Your scalable Kafka-based automation microservices are now ready!**

For support or questions, check the monitoring dashboard at http://localhost:8080 or run `./monitor-kafka.sh` for system status.
