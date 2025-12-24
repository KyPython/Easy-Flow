#!/bin/bash
# Watch all application logs in one terminal
# Color-coded by service

set -e

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Dynamic log directory
LOG_DIR="${LOG_DIR:-logs}"

# Validate log directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo "Error: Log directory '$LOG_DIR' does not exist"
    exit 1
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}📊 Watching all EasyFlow logs...${NC}"
echo "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Sanitize log file paths (prevent directory traversal)
sanitize_path() {
    local path="$1"
    # Remove any .. or / characters that could be used for traversal
    echo "$path" | sed 's/\.\.//g' | sed 's|^/||'
}

BACKEND_LOG=$(sanitize_path "${LOG_DIR}/backend.log")
FRONTEND_LOG=$(sanitize_path "${LOG_DIR}/frontend.log")
AUTOMATION_LOG=$(sanitize_path "${LOG_DIR}/automation-worker.log")

# Validate log files exist (create if needed)
[ -f "$BACKEND_LOG" ] || touch "$BACKEND_LOG"
[ -f "$FRONTEND_LOG" ] || touch "$FRONTEND_LOG"
[ -f "$AUTOMATION_LOG" ] || touch "$AUTOMATION_LOG"

# Use multitail if available, otherwise use tail with colors
if command -v multitail >/dev/null 2>&1; then
    multitail \
        -s 2 \
        -cT ansi \
        -l "tail -f $BACKEND_LOG" \
        -l "tail -f $FRONTEND_LOG" \
        -l "tail -f $AUTOMATION_LOG"
else
    # Fallback: use tail with simple prefix colors
    tail -f "$BACKEND_LOG" | sed "s/^/${GREEN}[BACKEND]${NC} /" &
    tail -f "$FRONTEND_LOG" | sed "s/^/${BLUE}[FRONTEND]${NC} /" &
    tail -f "$AUTOMATION_LOG" | sed "s/^/${CYAN}[WORKER]${NC} /" &
    
    # Wait for all background processes
    wait
fi

