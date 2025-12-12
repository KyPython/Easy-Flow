#!/bin/bash
# Stop Development Servers

echo "🛑 Stopping Easy-Flow Development Servers"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Kill processes by PID if files exist
if [ -f /tmp/backend.pid ]; then
    BACKEND_PID=$(cat /tmp/backend.pid)
    if kill $BACKEND_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Backend stopped (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${YELLOW}⚠ Backend process not found (may have already stopped)${NC}"
    fi
    rm /tmp/backend.pid
fi

if [ -f /tmp/frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/frontend.pid)
    if kill $FRONTEND_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Frontend stopped (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${YELLOW}⚠ Frontend process not found (may have already stopped)${NC}"
    fi
    rm /tmp/frontend.pid
fi

if [ -f /tmp/automation.pid ]; then
    AUTOMATION_PID=$(cat /tmp/automation.pid)
    if kill $AUTOMATION_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Automation worker stopped (PID: $AUTOMATION_PID)${NC}"
    else
        echo -e "${YELLOW}⚠ Automation worker process not found (may have already stopped)${NC}"
    fi
    rm /tmp/automation.pid
fi

# Fallback: kill by process name (more aggressive)
echo -e "${YELLOW}Killing any remaining processes...${NC}"
pkill -f "node server.js" 2>/dev/null && echo -e "${GREEN}✓ Killed node server.js processes${NC}" || true
pkill -f "react-app-rewired" 2>/dev/null && echo -e "${GREEN}✓ Killed react-app-rewired processes${NC}" || true
pkill -f "production_automation_service.py" 2>/dev/null && echo -e "${GREEN}✓ Killed automation service processes${NC}" || true

# Kill processes on port 7001 (automation worker)
echo -e "${YELLOW}Killing processes on port 7001...${NC}"
if lsof -ti :7001 | xargs kill -9 2>/dev/null; then
    echo -e "${GREEN}✓ Killed processes on port 7001${NC}"
else
    echo -e "${YELLOW}⚠ No processes found on port 7001${NC}"
fi

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

sleep 1

# Verify ports are free
echo ""
echo -e "${YELLOW}Verifying ports are free...${NC}"
if lsof -i :3030 | grep LISTEN > /dev/null 2>&1; then
    echo -e "${RED}⚠ Port 3030 still in use${NC}"
else
    echo -e "${GREEN}✓ Port 3030 is free${NC}"
fi

if lsof -i :3000 | grep LISTEN > /dev/null 2>&1; then
    echo -e "${RED}⚠ Port 3000 still in use${NC}"
else
    echo -e "${GREEN}✓ Port 3000 is free${NC}"
fi

if lsof -i :7001 | grep LISTEN > /dev/null 2>&1; then
    echo -e "${RED}⚠ Port 7001 still in use${NC}"
else
    echo -e "${GREEN}✓ Port 7001 is free${NC}"
fi

echo ""
echo -e "${GREEN}✓ All servers stopped${NC}"
