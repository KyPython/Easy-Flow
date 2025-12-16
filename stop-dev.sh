#!/bin/bash
# Stop Development Servers

echo "🛑 Stopping Easy-Flow Development Servers"
echo "========================================="

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

# Kill processes on specific ports
for port in 3000 3030 7070 7001; do
    if lsof -ti :$port > /dev/null 2>&1; then
        echo -e "${YELLOW}Killing processes on port $port...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null && echo -e "${GREEN}✓ Killed processes on port $port${NC}"
    fi
done

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

# Stop Kafka and Zookeeper using docker-compose
echo -e "${YELLOW}Stopping Kafka and Zookeeper...${NC}"
if docker-compose stop kafka zookeeper 2>/dev/null; then
    echo -e "${GREEN}✓ Kafka and Zookeeper stopped${NC}"
else
    echo -e "${YELLOW}⚠ Could not stop Kafka/Zookeeper via docker-compose${NC}"
fi

# Stop Observability Stack
echo -e "${YELLOW}Stopping Observability Stack...${NC}"
if [ -f rpa-system/docker-compose.monitoring.yml ]; then
    docker-compose -f rpa-system/docker-compose.monitoring.yml down 2>/dev/null && echo -e "${GREEN}✓ Observability stack stopped${NC}" || echo -e "${YELLOW}⚠ Could not stop observability stack${NC}"
    # Also remove any stale containers (all monitoring services, including manually started ones)
    docker rm -f easyflow-prometheus easyflow-grafana easyflow-loki easyflow-promtail easyflow-tempo easyflow-otel-collector easyflow-alertmanager 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ Monitoring compose file not found at rpa-system/docker-compose.monitoring.yml${NC}"
    # Fallback: try to remove containers directly
    docker rm -f easyflow-prometheus easyflow-grafana easyflow-loki easyflow-promtail easyflow-tempo easyflow-otel-collector easyflow-alertmanager 2>/dev/null || true
fi

sleep 1

# Verify critical ports are free
echo ""
echo -e "${YELLOW}Verifying critical ports are free...${NC}"

PORTS_OK=true
for port in 3000 3030 7070 9090 3001 3100 3200 4317 4318 9091 9080; do
    if lsof -i :$port | grep LISTEN > /dev/null 2>&1; then
        echo -e "${RED}✗ Port $port still in use${NC}"
        PORTS_OK=false
    else
        echo -e "${GREEN}✓ Port $port is free${NC}"
    fi
done

echo ""
if [ "$PORTS_OK" = true ]; then
    echo -e "${GREEN}✓ All servers and infrastructure stopped successfully${NC}"
else
    echo -e "${YELLOW}⚠ Some ports are still in use. You may need to manually kill processes.${NC}"
fi
