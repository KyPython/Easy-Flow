#!/bin/bash
# Development Server Startup Script

set -e

echo "🚀 Starting Easy-Flow Development Servers"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}✗ PM2 is not installed. Installing...${NC}"
    npm install -g pm2
fi

# Stop any existing PM2 processes
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 delete all 2>/dev/null || true

# Stop Docker frontend container if running (it uses port 3000)
echo -e "${YELLOW}Stopping Docker frontend container...${NC}"
docker stop easy-flow-rpa-dashboard-1 2>/dev/null || true

sleep 2

# Create logs directory if it doesn't exist
mkdir -p logs

# Start Kafka and Zookeeper via Docker Compose
echo -e "${YELLOW}Starting Kafka and Zookeeper...${NC}"
docker-compose up -d kafka zookeeper
sleep 5

# Initialize Kafka topics
echo -e "${YELLOW}Initializing Kafka topics...${NC}"
./scripts/init-kafka-topics.sh || {
  echo -e "${RED}⚠ Warning: Failed to initialize Kafka topics${NC}"
  echo -e "${YELLOW}  Topics will be auto-created on first use${NC}"
}

# Start Observability Stack (Prometheus, Grafana, Loki, Promtail, Tempo, OTEL Collector)
echo -e "${YELLOW}Starting Observability Stack...${NC}"
cd rpa-system/monitoring
# Clean up any existing monitoring containers
docker-compose -f docker-compose.monitoring.yml down 2>/dev/null || true
# Remove stale containers that may conflict
docker rm -f easyflow-alertmanager 2>/dev/null || true
docker-compose -f docker-compose.monitoring.yml up -d
cd ../..
sleep 5
echo -e "${GREEN}✓ Observability stack started${NC}"
echo "  Grafana:        http://localhost:3001 (admin/admin)"
echo "  Prometheus:     http://localhost:9090"
echo "  Loki:           http://localhost:3100"
echo "  OTEL Collector: http://localhost:4318 (HTTP) / 4317 (gRPC)"

# Export environment variables
export NODE_ENV=development
export KAFKA_ENABLED=true
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092
export KAFKA_BROKERS=localhost:9092

# Start all services with PM2
echo -e "${GREEN}Starting all services with PM2...${NC}"
pm2 start ecosystem.config.js

sleep 5

# Check services health
echo ""
echo -e "${YELLOW}Checking services health...${NC}"

if curl -s http://localhost:3030/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    pm2 logs easyflow-backend --lines 20 --nostream
fi

if lsof -ti:7070 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Automation worker is running${NC}"
else
    echo -e "${YELLOW}⚠ Automation worker may still be starting...${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All services started successfully!${NC}"
echo ""
echo "Application:"
echo "  Frontend:         http://localhost:3000"
echo "  Backend:          http://localhost:3030"
echo "  Automation:       http://localhost:7070"
echo "  Health Check:     http://localhost:3030/health"
echo ""
echo "Infrastructure:"
echo "  Kafka:            localhost:9092"
echo ""
echo "Observability:"
echo "  Grafana:          http://localhost:3001 (admin/admin)"
echo "  Prometheus:       http://localhost:9090"
echo "  Loki:             http://localhost:3100"
echo "  Backend Metrics:  http://localhost:9091/metrics"
echo ""
echo "Logs (PM2):"
echo "  All services:     pm2 logs"
echo "  Backend only:     pm2 logs easyflow-backend"
echo "  Frontend only:    pm2 logs easyflow-frontend"
echo "  Automation only:  pm2 logs easyflow-automation"
echo ""
echo "  Log files:"
echo "    Backend:        logs/backend.log"
echo "    Frontend:       logs/frontend.log"
echo "    Automation:     logs/automation-worker.log"
echo ""
echo "Process Management:"
echo "  Status:           pm2 status"
echo "  Restart service:  pm2 restart <service-name>"
echo "  Stop services:    ./stop-dev.sh"
echo ""
echo -e "${YELLOW}To stop all services: ./stop-dev.sh${NC}"
echo ""

# Wait for user input
read -p "Press Enter to view PM2 logs (Ctrl+C to exit)..."
pm2 logs
