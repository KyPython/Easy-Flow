#!/bin/bash

# EasyFlow Stop Script
# Clean shutdown of all services

PROJECT_ROOT=$(pwd)
RPA_SYSTEM_DIR="$PROJECT_ROOT/rpa-system"
DOCKER_COMPOSE_FILE="$RPA_SYSTEM_DIR/docker-compose.monitoring.yml"
CORE_DOCKER_COMPOSE_FILE="$RPA_SYSTEM_DIR/docker-compose.yml"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Stopping EasyFlow Environment...${NC}"

# 1. Stop PM2/Node
if command -v pm2 &> /dev/null; then
    echo "Stopping PM2 processes..."
    pm2 delete all 2>/dev/null || true
    pm2 kill 2>/dev/null || true
fi

# Fallback: Kill any remaining node processes
pkill -f "node" || true

# 2. Stop ngrok
echo "Stopping ngrok..."
pkill ngrok || true

# 3. Stop Docker Infrastructure
echo "Stopping Docker containers..."
COMPOSE_FILES=()
if [ -f "$CORE_DOCKER_COMPOSE_FILE" ]; then
    COMPOSE_FILES+=(-f "$CORE_DOCKER_COMPOSE_FILE")
fi
if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    COMPOSE_FILES+=(-f "$DOCKER_COMPOSE_FILE")
fi

if [ ${#COMPOSE_FILES[@]} -gt 0 ]; then
    docker compose "${COMPOSE_FILES[@]}" down -v --remove-orphans
fi

# 4. Free Ports (Safety net)
echo "Ensuring ports are free..."
PORTS=(3000 3030 5432 6379 9092 2181 9090 3001 3100 3200)
for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo "$PID" | xargs kill -9 2>/dev/null || true
    fi
done

# 5. Verification
echo "Verifying shutdown..."
FAILED=0
for PORT in "${PORTS[@]}"; do
    if lsof -ti:$PORT >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $PORT is still in use!${NC}"
        FAILED=1
    fi
done

if [ $FAILED -eq 1 ]; then
    echo -e "${YELLOW}⚠️  Some services could not be stopped completely. Check 'lsof -i :<port>'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment stopped successfully.${NC}"