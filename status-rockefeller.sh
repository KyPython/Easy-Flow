#!/bin/bash
# Check Rockefeller Operating System Status

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Rockefeller Operating System Status Check${NC}"
echo ""

# Check Backend
if curl -m 5 -s http://localhost:3030/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend API running on port 3030"
else
    echo -e "${RED}✗${NC} Backend API not responding on port 3030"
fi

# Check Frontend
if curl -m 5 -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend Dashboard running on port 3000"
else
    echo -e "${RED}✗${NC} Frontend Dashboard not responding on port 3000"
fi

# Check PIDs
if [ -f ".rockefeller/backend.pid" ] && [ -f ".rockefeller/frontend.pid" ]; then
    BACKEND_PID=$(cat .rockefeller/backend.pid)
    FRONTEND_PID=$(cat .rockefeller/frontend.pid)
    echo ""
    echo -e "${BLUE}Process Information:${NC}"
    echo -e "  Backend PID:  ${GREEN}$BACKEND_PID${NC}"
    echo -e "  Frontend PID: ${GREEN}$FRONTEND_PID${NC}"
fi

echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo -e "  Dashboard:    ${GREEN}http://localhost:3000${NC}"
echo -e "  Backend API:  ${GREEN}http://localhost:3030${NC}"
echo -e "  Health Check: ${GREEN}http://localhost:3030/health${NC}"
