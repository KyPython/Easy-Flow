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

# Kill any existing processes
echo -e "${YELLOW}Killing existing processes...${NC}"
pkill -f "node server.js" 2>/dev/null || true
pkill -f "react-app-rewired" 2>/dev/null || true

# Stop Docker frontend container if running (it uses port 3000)
echo -e "${YELLOW}Stopping Docker frontend container...${NC}"
docker stop easy-flow-rpa-dashboard-1 2>/dev/null || true

sleep 2

# Export environment for backend
export NODE_ENV=development
# ✅ TELEMETRY ENABLED - Remove DISABLE_TELEMETRY to allow traces to flow
# export DISABLE_TELEMETRY=true  # REMOVED - We want telemetry enabled!
export KAFKA_ENABLED=false

# Start backend (with PORT=3030 only for backend)
echo -e "${GREEN}Starting backend on port 3030...${NC}"
cd rpa-system/backend
PORT=3030 nohup node server.js > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > /tmp/backend.pid
cd ../..

sleep 3

# Check backend health
if curl -s http://localhost:3030/health > /dev/null; then
    echo -e "${GREEN}✓ Backend started successfully (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    exit 1
fi

# Start frontend (explicitly set PORT=3000 to override any inherited PORT)
echo -e "${GREEN}Starting frontend on port 3000...${NC}"
cd rpa-system/rpa-dashboard
PORT=3000 nohup npm start > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > /tmp/frontend.pid
cd ../..

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Servers started successfully!${NC}"
echo ""
echo "Frontend:      http://localhost:3000"
echo "Backend:       http://localhost:3030"
echo "Health Check:  http://localhost:3030/health"
echo ""
echo "Logs:"
echo "  Backend:  tail -f logs/backend.log"
echo "  Frontend: tail -f logs/frontend.log"
echo ""
echo "PIDs:"
echo "  Backend:  $BACKEND_PID (saved to /tmp/backend.pid)"
echo "  Frontend: $FRONTEND_PID (saved to /tmp/frontend.pid)"
echo ""
echo -e "${YELLOW}To stop servers: ./stop-dev.sh${NC}"
echo ""

# Wait for user input
read -p "Press Enter to view logs (Ctrl+C to exit)..."
tail -f logs/backend.log
