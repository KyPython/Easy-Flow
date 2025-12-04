#!/bin/bash
# Stop the Rockefeller Operating System

set -e

echo "🛑 Stopping Rockefeller Operating System..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Stop processes from PID files
if [ -f ".rockefeller/backend.pid" ]; then
    BACKEND_PID=$(cat .rockefeller/backend.pid)
    echo -n "Stopping Backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
    echo -e " ${GREEN}✓${NC}"
fi

if [ -f ".rockefeller/frontend.pid" ]; then
    FRONTEND_PID=$(cat .rockefeller/frontend.pid)
    echo -n "Stopping Frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e " ${GREEN}✓${NC}"
fi

# Cleanup any remaining processes
echo -n "Cleaning up remaining processes..."
pkill -f "node.*3030" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true
lsof -ti:3030,3000 | xargs kill -9 2>/dev/null || true
echo -e " ${GREEN}✓${NC}"

# Remove PID files
rm -rf .rockefeller

echo -e "${GREEN}✅ Rockefeller Operating System stopped${NC}"
