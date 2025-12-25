#!/bin/bash
# Watch all application logs in one terminal
# Color-coded by service

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

# Use printf for reliable color codes (works on both GNU and BSD sed)
GREEN=$(printf '\033[0;32m')
YELLOW=$(printf '\033[1;33m')
BLUE=$(printf '\033[0;34m')
RED=$(printf '\033[0;31m')
CYAN=$(printf '\033[0;36m')
NC=$(printf '\033[0m')

echo -e "${BLUE}📊 Watching all EasyFlow logs...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
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

# Cleanup function to kill background processes
cleanup() {
    echo -e "\n${YELLOW}Stopping log watchers...${NC}"
    kill $TAIL_PID1 $TAIL_PID2 $TAIL_PID3 2>/dev/null || true
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Use multitail if available, otherwise use tail with colors
if command -v multitail >/dev/null 2>&1; then
    multitail \
        -s 2 \
        -cT ansi \
        -l "tail -f $BACKEND_LOG" \
        -l "tail -f $FRONTEND_LOG" \
        -l "tail -f $AUTOMATION_LOG"
else
    # Fallback: use tail with colors (using printf for reliable escape sequences)
    # Store PIDs for cleanup
    tail -f "$BACKEND_LOG" | sed "s/^/$(printf '\033[0;32m')[BACKEND]$(printf '\033[0m') /" &
    TAIL_PID1=$!
    tail -f "$FRONTEND_LOG" | sed "s/^/$(printf '\033[0;34m')[FRONTEND]$(printf '\033[0m') /" &
    TAIL_PID2=$!
    tail -f "$AUTOMATION_LOG" | sed "s/^/$(printf '\033[0;36m')[WORKER]$(printf '\033[0m') /" &
    TAIL_PID3=$!
    
    # Wait for all background processes
    wait
fi

