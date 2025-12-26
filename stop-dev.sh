#!/bin/bash
# Stop Development Servers
# Gracefully stops all EasyFlow development services and infrastructure

# Don't exit on error - we want to clean up as much as possible even if some steps fail
set +e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stop all PM2 processes
echo -e "${YELLOW}Stopping PM2 processes...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 delete all 2>/dev/null && echo -e "${GREEN}✓ All PM2 processes stopped${NC}" || echo -e "${YELLOW}⚠ No PM2 processes running${NC}"
else
    echo -e "${YELLOW}⚠ PM2 not installed, skipping PM2 cleanup${NC}"
fi

# Fallback: kill by process name (for any orphaned processes)
echo -e "${YELLOW}Cleaning up any orphaned processes...${NC}"
pkill -f "node server.js" 2>/dev/null && echo -e "${GREEN}✓ Killed node server.js processes${NC}" || true
pkill -f "react-scripts start" 2>/dev/null && echo -e "${GREEN}✓ Killed react-scripts processes${NC}" || true
pkill -f "production_automation_service.py" 2>/dev/null && echo -e "${GREEN}✓ Killed automation service processes${NC}" || true

# Load environment variables from .env file if it exists to get dynamic ports
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set dynamic ports from environment variables with defaults
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${PORT:-3030}
AUTOMATION_PORT=${AUTOMATION_PORT:-7070}
BACKEND_METRICS_PORT=${BACKEND_METRICS_PORT:-9091}

# Kill processes on specific ports (matching ports freed in start-dev.sh)
# Use quoted variables and validate port numbers
for port in "$FRONTEND_PORT" "$BACKEND_PORT" "$AUTOMATION_PORT" "$BACKEND_METRICS_PORT"; do
    # Validate port is a number
    if [[ "$port" =~ ^[0-9]+$ ]]; then
        if lsof -ti :"$port" > /dev/null 2>&1; then
            echo -e "${YELLOW}Killing processes on port $port...${NC}"
            lsof -ti :"$port" | xargs kill -9 2>/dev/null && echo -e "${GREEN}✓ Killed processes on port $port${NC}" || true
        fi
    fi
done

# Check if Docker daemon is running (non-critical - just skip if not)
if docker info > /dev/null 2>&1; then
    # Stop Docker containers
    echo -e "${YELLOW}Stopping Docker containers...${NC}"
    if docker stop easy-flow-rpa-dashboard-1 2>/dev/null; then
        echo -e "${GREEN}✓ Docker frontend container stopped${NC}"
    else
        echo -e "${YELLOW}⚠ Docker frontend container not running${NC}"
    fi

    if docker stop easy-flow-automation-worker-1 2>/dev/null; then
        echo -e "${GREEN}✓ Docker automation worker stopped${NC}"
    else
        echo -e "${YELLOW}⚠ Docker automation worker not running${NC}"
    fi

    # Stop and completely remove Kafka and Zookeeper (prevents stale Zookeeper nodes)
    echo -e "${YELLOW}Stopping and cleaning up Kafka and Zookeeper...${NC}"
    # Stop first
    docker compose stop kafka zookeeper 2>/dev/null || true
    # Remove containers completely (this clears Zookeeper state and prevents NodeExistsException)
    if docker compose rm -f kafka zookeeper 2>/dev/null; then
        echo -e "${GREEN}✓ Kafka and Zookeeper stopped and cleaned up${NC}"
    else
        # Fallback: try to remove containers directly by name
        docker rm -f easy-flow-kafka-1 easy-flow-zookeeper-1 2>/dev/null || true
        echo -e "${YELLOW}⚠ Kafka/Zookeeper cleanup attempted${NC}"
    fi

    # Stop Observability Stack
    echo -e "${YELLOW}Stopping Observability Stack...${NC}"
    if [ -f rpa-system/docker-compose.monitoring.yml ]; then
        docker compose -f rpa-system/docker-compose.monitoring.yml down 2>/dev/null && echo -e "${GREEN}✓ Observability stack stopped${NC}" || echo -e "${YELLOW}⚠ Could not stop observability stack${NC}"
        # Also remove any stale containers (all monitoring services, including manually started ones)
        docker rm -f easyflow-prometheus easyflow-grafana easyflow-loki easyflow-promtail easyflow-tempo easyflow-otel-collector easyflow-alertmanager 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠ Monitoring compose file not found at rpa-system/docker-compose.monitoring.yml${NC}"
        # Fallback: try to remove containers directly
        docker rm -f easyflow-prometheus easyflow-grafana easyflow-loki easyflow-promtail easyflow-tempo easyflow-otel-collector easyflow-alertmanager 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}⚠ Docker daemon not running, skipping Docker container cleanup${NC}"
fi

sleep 1

# Verify critical ports are free
echo ""
echo -e "${YELLOW}Verifying critical ports are free...${NC}"

PORTS_OK=true
# Check application ports (dynamic) and observability ports (fixed)
# Use quoted variables and validate port numbers
for port in "$FRONTEND_PORT" "$BACKEND_PORT" "$AUTOMATION_PORT" 9090 3001 3100 3200 4317 4318 "$BACKEND_METRICS_PORT" 9080 9093; do
    # Validate port is a number
    if [[ "$port" =~ ^[0-9]+$ ]]; then
        if lsof -i :"$port" 2>/dev/null | grep LISTEN > /dev/null 2>&1; then
            echo -e "${RED}✗ Port $port still in use${NC}"
            PORTS_OK=false
        else
            echo -e "${GREEN}✓ Port $port is free${NC}"
        fi
    fi
done

echo ""
if [ "$PORTS_OK" = true ]; then
    echo -e "${GREEN}✓ All servers and infrastructure stopped successfully${NC}"
else
    echo -e "${YELLOW}⚠ Some ports are still in use. You may need to manually kill processes.${NC}"
fi
