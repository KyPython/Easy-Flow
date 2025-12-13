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
lsof -ti:7070 | xargs kill -9 2>/dev/null || true
lsof -ti:3030 | xargs kill -9 2>/dev/null || true
sleep 1

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
export KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:9092
export KAFKA_BROKERS=127.0.0.1:9092

# Helper function to update .env without overwriting secrets
update_env() {
    local file=$1
    local key=$2
    local value=$3
    mkdir -p "$(dirname "$file")"
    if [ ! -f "$file" ]; then touch "$file"; fi
    
    if grep -q "^$key=" "$file"; then
        # Update existing key (compatible with both GNU and BSD sed)
        sed "s|^$key=.*|$key=$value|" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    else
        # Append new key
        echo "$key=$value" >> "$file"
    fi
}

# Force configuration for Automation Service via .env
# This ensures Python picks up 127.0.0.1 instead of defaulting to localhost (IPv6 issue)
AUTO_ENV="rpa-system/automation/automation-service/.env"
update_env "$AUTO_ENV" "KAFKA_BROKERS" "127.0.0.1:9092"
update_env "$AUTO_ENV" "KAFKA_BOOTSTRAP_SERVERS" "127.0.0.1:9092"
update_env "$AUTO_ENV" "PORT" "7070"
update_env "$AUTO_ENV" "BACKEND_URL" "http://127.0.0.1:3030"
update_env "$AUTO_ENV" "SUPABASE_URL" "https://syxzilyuysdoirnezgii.supabase.co"
update_env "$AUTO_ENV" "SUPABASE_SERVICE_ROLE" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk"
update_env "$AUTO_ENV" "SUPABASE_ANON_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0"

# Force configuration for Backend via .env
# This prevents port conflicts and stops the backend from spawning its own worker
BACKEND_ENV="rpa-system/backend/.env"
update_env "$BACKEND_ENV" "PORT" "3030"
update_env "$BACKEND_ENV" "AUTOMATION_URL" "http://127.0.0.1:7070"
update_env "$BACKEND_ENV" "KAFKA_BROKERS" "127.0.0.1:9092"
update_env "$BACKEND_ENV" "SUPABASE_URL" "https://syxzilyuysdoirnezgii.supabase.co"
update_env "$BACKEND_ENV" "SUPABASE_SERVICE_ROLE" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk"
update_env "$BACKEND_ENV" "SUPABASE_ANON_KEY" "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0"

# Start all services with PM2
echo -e "${GREEN}Starting all services with PM2...${NC}"
pm2 start ecosystem.config.js

# Check services health
echo ""
echo -e "${YELLOW}Checking services health...${NC}"

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
