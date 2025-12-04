#!/bin/bash
# Rockefeller Operating System - Automated Startup Script
# This script starts the complete Rockefeller system for EasyFlow

set -e

echo "🚀 Starting Rockefeller Operating System..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    lsof -ti:$1 > /dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service=$2
    local max_attempts=30
    local attempt=0
    
    echo -n "Waiting for $service to start on port $port..."
    while [ $attempt -lt $max_attempts ]; do
        if check_port $port; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        sleep 1
        echo -n "."
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗${NC}"
    return 1
}

# Step 1: Kill any existing processes
echo -e "${BLUE}Step 1: Cleaning up existing processes...${NC}"
pkill -f "node.*3030" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true
lsof -ti:3030,3000 | xargs kill -9 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Step 2: Check environment files
echo -e "${BLUE}Step 2: Checking environment configuration...${NC}"

# Check backend .env
if [ ! -f "rpa-system/backend/.env" ]; then
    echo -e "${RED}✗ Backend .env file not found${NC}"
    echo "Creating from example..."
    if [ -f "rpa-system/backend/.env.example" ]; then
        cp rpa-system/backend/.env.example rpa-system/backend/.env
        echo -e "${GREEN}✓ Created backend .env - Please configure it${NC}"
    else
        echo -e "${RED}✗ .env.example not found. Please create rpa-system/backend/.env manually${NC}"
        exit 1
    fi
fi

# Check frontend env
if [ ! -f ".env.local" ]; then
    echo "Frontend .env.local not found (optional - using public/env.js runtime config)"
fi

echo -e "${GREEN}✓ Environment check complete${NC}"
echo ""

# Step 3: Check dependencies
echo -e "${BLUE}Step 3: Checking dependencies...${NC}"

# Check backend dependencies
if [ ! -d "rpa-system/backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd rpa-system/backend
    npm install
    cd ../..
fi

# Check frontend dependencies
if [ ! -d "rpa-system/rpa-dashboard/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd rpa-system/rpa-dashboard
    npm install
    cd ../..
fi

echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Step 4: Start Backend
echo -e "${BLUE}Step 4: Starting Backend API (Port 3030)...${NC}"
cd rpa-system/backend
node server.js > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ../..

# Wait for backend to be ready
if wait_for_service 3030 "Backend API"; then
    echo -e "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}✗ Backend failed to start. Check logs/backend.log${NC}"
    exit 1
fi
echo ""

# Step 5: Start Frontend
echo -e "${BLUE}Step 5: Starting Frontend Dashboard (Port 3000)...${NC}"
cd rpa-system/rpa-dashboard
npm start > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# Wait for frontend to be ready
if wait_for_service 3000 "Frontend Dashboard"; then
    echo -e "${GREEN}✓ Frontend running (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}✗ Frontend failed to start. Check logs/frontend.log${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi
echo ""

# Step 6: Save PIDs
echo -e "${BLUE}Step 6: Saving process information...${NC}"
mkdir -p .rockefeller
echo $BACKEND_PID > .rockefeller/backend.pid
echo $FRONTEND_PID > .rockefeller/frontend.pid
echo -e "${GREEN}✓ PIDs saved${NC}"
echo ""

# Success message
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Rockefeller Operating System is now running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Access Points:${NC}"
echo -e "  📊 Dashboard:    ${GREEN}http://localhost:3000${NC}"
echo -e "  🔌 Backend API:  ${GREEN}http://localhost:3030${NC}"
echo -e "  📖 API Docs:     ${GREEN}http://localhost:3030/api-docs${NC}"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  Backend:  ${GREEN}tail -f logs/backend.log${NC}"
echo -e "  Frontend: ${GREEN}tail -f logs/frontend.log${NC}"
echo ""
echo -e "${BLUE}To stop the system:${NC}"
echo -e "  ${GREEN}./stop-rockefeller.sh${NC}"
echo ""
echo -e "${BLUE}Daily Workflow:${NC}"
echo -e "  1. Review metrics: ${GREEN}http://localhost:3000/founder/dashboard${NC}"
echo -e "  2. Complete daily checklist"
echo -e "  3. Log competitive intelligence"
echo -e "  4. Track efficiency improvements"
echo ""
echo "Press Ctrl+C to stop watching logs (services will continue running)"
echo ""
echo "Tailing logs..."
tail -f logs/backend.log logs/frontend.log
