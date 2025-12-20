#!/bin/bash
# Watch all application logs in one terminal
# Color-coded by service

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}📊 Watching all EasyFlow logs...${NC}"
echo "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Use multitail if available, otherwise use tail with colors
if command -v multitail >/dev/null 2>&1; then
    multitail \
        -s 2 \
        -cT ansi \
        -l "tail -f logs/backend.log" \
        -l "tail -f logs/frontend.log" \
        -l "tail -f logs/automation-worker.log"
else
    # Fallback: use tail with simple prefix colors
    tail -f logs/backend.log | sed "s/^/${GREEN}[BACKEND]${NC} /" &
    tail -f logs/frontend.log | sed "s/^/${BLUE}[FRONTEND]${NC} /" &
    tail -f logs/automation-worker.log | sed "s/^/${CYAN}[WORKER]${NC} /" &
    
    # Wait for all background processes
    wait
fi

