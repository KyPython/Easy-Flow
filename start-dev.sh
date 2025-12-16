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

# Check for timeout command (for Kafka init script)
# On macOS, 'timeout' is 'gtimeout' from 'coreutils'
if ! command -v timeout &> /dev/null && ! command -v gtimeout &> /dev/null; then
    echo -e "${YELLOW}⚠ 'timeout' command not found. This may cause a non-critical error during Kafka topic initialization.${NC}"
    echo -e "${YELLOW}  On macOS, you can install it via Homebrew: 'brew install coreutils'${NC}"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}✗ PM2 is not installed. Installing...${NC}"
    npm install -g pm2
fi

# Stop any existing PM2 processes
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 delete all 2>/dev/null || true

# Ensure critical ports are free (prevent address in use errors)
echo -e "${YELLOW}Freeing up critical ports...${NC}"
for port in 3000 3030 7070 7001 9091; do
    if lsof -ti:$port > /dev/null 2>&1; then
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✓ Freed port $port${NC}"
    fi
done
sleep 1

# Stop Docker frontend container if running (it uses port 3000)
echo -e "${YELLOW}Stopping Docker frontend container...${NC}"
docker stop easy-flow-rpa-dashboard-1 2>/dev/null || true

sleep 2

# Create logs directory if it doesn't exist
mkdir -p logs
# Clear existing logs to start fresh
rm -f logs/*.log

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

# Start Observability Stack (Prometheus, Grafana, Loki, Tempo, OTEL Collector, Alertmanager)
echo -e "${YELLOW}Starting Observability Stack...${NC}"
# Clean up any existing monitoring containers first
docker-compose -f rpa-system/docker-compose.monitoring.yml down 2>/dev/null || true
# Remove stale containers that may conflict (including manually started ones)
docker rm -f easyflow-prometheus easyflow-grafana easyflow-loki easyflow-promtail easyflow-tempo easyflow-otel-collector easyflow-alertmanager 2>/dev/null || true
# Start all monitoring services
docker-compose -f rpa-system/docker-compose.monitoring.yml up -d
sleep 5

# Wait for Grafana to be ready (it may restart due to datasource provisioning)
echo -e "${YELLOW}Waiting for Grafana to be ready...${NC}"
GRAFANA_READY=false
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Grafana is ready${NC}"
        GRAFANA_READY=true
        break
    fi
    sleep 2
done
[ "$GRAFANA_READY" = false ] && echo -e "${YELLOW}⚠ Grafana may still be starting (check http://localhost:3001)${NC}"

echo -e "${GREEN}✓ Observability stack started${NC}"
echo "  Grafana:        http://localhost:3001 (admin/admin123)"
echo "  Prometheus:     http://localhost:9090"
echo "  Loki:           http://localhost:3100 (logs)"
echo "  Promtail:       http://localhost:9080 (log shipper)"
echo "  Tempo:          http://localhost:3200"
echo "  OTEL Collector: http://localhost:4318 (HTTP) / 4317 (gRPC)"
echo "  Alertmanager:   http://localhost:9093"

# Get absolute path for logs to avoid PM2 cwd resolution issues
ROOT_DIR=$(pwd)

# Generate a dynamic ecosystem file to ensure correct env vars
echo -e "${YELLOW}Generating PM2 ecosystem config...${NC}"
cat > ecosystem.config.js << EOL
module.exports = {
  apps: [
    {
      name: 'easyflow-backend',
      script: 'server.js',
      cwd: 'rpa-system/backend',
      watch: ['rpa-system/backend'],
      ignore_watch: ['node_modules', 'logs'],
      error_file: '$ROOT_DIR/logs/backend-error.log',
      out_file: '$ROOT_DIR/logs/backend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3030,
        KAFKA_ENABLED: 'true',
        AUTOMATION_URL: 'http://127.0.0.1:7070',
        KAFKA_CLIENT_ID: 'easyflow-backend',
        KAFKA_BOOTSTRAP_SERVERS: '127.0.0.1:9092',
        KAFKA_BROKERS: '127.0.0.1:9092',
        SUPABASE_URL: "https://syxzilyuysdoirnezgii.supabase.co",
        SUPABASE_SERVICE_ROLE: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk",
        SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0"
      },
    },
    {
      name: 'easyflow-frontend',
      script: 'node_modules/.bin/react-scripts',
      args: 'start',
      cwd: 'rpa-system/rpa-dashboard',
      error_file: '$ROOT_DIR/logs/frontend-error.log',
      out_file: '$ROOT_DIR/logs/frontend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PORT: 3000,
        BROWSER: 'none'
      },
    },
    {
      name: 'easyflow-automation',
      script: 'production_automation_service.py',
      interpreter: 'python3',
      cwd: 'rpa-system/automation/automation-service',
      error_file: '$ROOT_DIR/logs/automation-worker.log',
      out_file: '$ROOT_DIR/logs/automation-worker.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PYTHONUNBUFFERED: '1',
        KAFKA_ENABLED: 'true',
        PORT: 7070,
        BACKEND_URL: 'http://127.0.0.1:3030',
        KAFKA_BOOTSTRAP_SERVERS: '127.0.0.1:9092',
        KAFKA_BROKERS: '127.0.0.1:9092',
        SUPABASE_URL: "https://syxzilyuysdoirnezgii.supabase.co",
        SUPABASE_SERVICE_ROLE: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk",
        SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0"
      },
    },
  ],
};
EOL

# Start all services with PM2
echo -e "${GREEN}Starting all services with PM2...${NC}"
pm2 start ecosystem.config.js

# Check services health
echo ""

# Wait for Backend (up to 30s)
BACKEND_OK=false
for i in {1..30}; do
    if curl -s http://localhost:3030/health > /dev/null; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        BACKEND_OK=true
        break
    fi
    sleep 1
done
[ "$BACKEND_OK" = false ] && { echo -e "${RED}✗ Backend failed to start${NC}"; pm2 logs easyflow-backend --lines 20 --nostream; }

# Wait for Automation Worker (up to 30s)
AUTO_OK=false
for i in {1..30}; do
    if curl -s http://localhost:7070/health > /dev/null; then
        echo -e "${GREEN}✓ Automation worker is healthy${NC}"
        AUTO_OK=true
        break
    fi
    sleep 1
done
[ "$AUTO_OK" = false ] && { echo -e "${RED}✗ Automation worker failed to start${NC}"; echo -e "${YELLOW}Error logs:${NC}"; pm2 logs easyflow-automation --err --lines 20 --nostream; }

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
echo "  Grafana:          http://localhost:3001 (admin/admin123)"
echo "  Prometheus:       http://localhost:9090"
echo "  Loki:             http://localhost:3100 (logs)"
echo "  Promtail:         http://localhost:9080 (log shipper)"
echo "  Tempo:            http://localhost:3200"
echo "  OTEL Collector:   http://localhost:4318 (HTTP) / 4317 (gRPC)"
echo "  Alertmanager:     http://localhost:9093"
echo "  Backend Metrics:  http://localhost:9091/metrics"
echo ""
echo "  All logs are automatically shipped to Loki and visible in Grafana"
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
