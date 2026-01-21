#!/bin/bash

# EasyFlow Stop Script (progress, timing, and full logging)
set -o pipefail

# Verbose flag
VERBOSE=false
for arg in "$@"; do
  case "$arg" in
    -v|--verbose) VERBOSE=true ;;
  esac
done
[ "$VERBOSE" = true ] && set -x

PROJECT_ROOT=$(pwd)
RPA_SYSTEM_DIR="$PROJECT_ROOT/rpa-system"

# Detect Docker Compose file locations (root or rpa-system)
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
  CORE_DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
else
  CORE_DOCKER_COMPOSE_FILE="$RPA_SYSTEM_DIR/docker-compose.yml"
fi

if [ -f "$PROJECT_ROOT/docker-compose.monitoring.yml" ]; then
  DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.monitoring.yml"
else
  DOCKER_COMPOSE_FILE="$RPA_SYSTEM_DIR/docker-compose.monitoring.yml"
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging setup
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/stop-$(date -u +%Y%m%dT%H%M%SZ).log"
# Mirror all stdout/stderr to both console and logfile
exec > >(tee -a "$LOG_FILE") 2>&1

# Helpers
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo -e "${BLUE}[EasyFlow $(ts)]${NC} $1"; }
success() { echo -e "${GREEN}\xE2\x9C\x85 $1${NC}"; }
warn() { echo -e "${YELLOW}\xE2\x9A\xA0\xEF\xB8\x8F  $1${NC}"; }
error() { echo -e "${RED}\xE2\x9D\x8C $1${NC}"; }

spinner() {
  local pid=$1
  local msg="$2"
  local start=$3
  local timeout=${4:-120} # Default timeout 120s
  local spin='-\\|/'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    local current=$(date +%s)
    local elapsed=$(( current - start ))
    if [ $elapsed -gt $timeout ]; then
      printf "\r\033[K"
      warn "Operation timed out after ${elapsed}s. Forcing stop..."
      kill -TERM "$pid" 2>/dev/null
      sleep 2
      kill -KILL "$pid" 2>/dev/null || true
      break
    fi
    i=$(( (i+1) % 4 ))
    printf "\r%s %s [%s] %ss\033[K" "$msg" "${spin:$i:1}" "$(ts)" "$elapsed"
    sleep 0.2
  done
  printf "\r\033[K"
}

run_step() {
  local msg="$1"; shift
  local start_s=$(date +%s)
  log "$msg..."
  "$@"
  local rc=$?
  local dur=$(( $(date +%s) - start_s ))
  if [ $rc -eq 0 ]; then
    success "$msg done in ${dur}s"
  else
    warn "$msg finished with code $rc in ${dur}s"
  fi
  return $rc
}

TOTAL_START=$(date +%s)
echo "<current_datetime>$(ts)</current_datetime>"
echo -e "${YELLOW}🛑  Stopping EasyFlow Environment...${NC}"

# 1. Stop PM2/Node
if command -v pm2 &> /dev/null; then
  run_step "Stopping PM2 processes" bash -lc "pm2 delete all 2>/dev/null || true; pm2 kill 2>/dev/null || true"
fi

# Fallback: Kill any remaining node processes
run_step "Killing stray node processes" bash -lc "pkill -f 'node' 2>/dev/null || true"

# 2. Stop ngrok
run_step "Stopping ngrok" bash -lc "pkill ngrok 2>/dev/null || true"

# 3. Stop Docker Infrastructure
COMPOSE_FILES=()
[ -f "$CORE_DOCKER_COMPOSE_FILE" ] && COMPOSE_FILES+=(-f "$CORE_DOCKER_COMPOSE_FILE")
[ -f "$DOCKER_COMPOSE_FILE" ] && COMPOSE_FILES+=(-f "$DOCKER_COMPOSE_FILE")

if [ ${#COMPOSE_FILES[@]} -gt 0 ]; then
  log "Stopping Docker containers (docker compose down -v --remove-orphans)..."
  START_D=$(date +%s)
  # Add timeout (-t 30) and trap interrupts to ensure clean exit
  docker compose "${COMPOSE_FILES[@]}" down -v --remove-orphans -t 30 >> "$LOG_FILE" 2>&1 &
  PID=$!
  trap "kill $PID 2>/dev/null" INT TERM
  spinner $PID "Docker down in progress" $START_D 120
  wait $PID
  trap - INT TERM
  RC=$?
  DUR=$(( $(date +%s) - START_D ))
  if [ $RC -eq 0 ]; then
    success "Docker containers stopped in ${DUR}s"
  else
    warn "Docker down exited with code $RC in ${DUR}s"
    warn "Log tail:"
    tail -n 5 "$LOG_FILE" | sed 's/^/    /'
  fi
else
  warn "No Docker compose files found. Skipping Docker shutdown."
fi

# 4. Free Ports (Safety net)
PORTS=(3000 3030 5432 6379 9092 2181 9090 3001 3100 3200)
log "Ensuring ports are free: ${PORTS[*]}"
P_START=$(date +%s)
for PORT in "${PORTS[@]}"; do
  PID=$(lsof -n -P -ti:$PORT 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "$PID" | xargs kill -9 2>/dev/null || true
    log "Freed port $PORT (killed PIDs: $(echo "$PID" | tr '\n' ' '))"
  fi
done
success "Port sweep complete in $(( $(date +%s) - P_START ))s"

# 5. Verification
log "Verifying shutdown..."
FAILED=0
for PORT in "${PORTS[@]}"; do
  if lsof -ti:$PORT >/dev/null 2>&1; then
    warn "Port $PORT is still in use!"
    FAILED=1
  fi
done

TOTAL_DUR=$(( $(date +%s) - TOTAL_START ))
if [ $FAILED -eq 1 ]; then
  warn "Some services could not be stopped completely. Check 'lsof -i :<port>'"
  warn "Total stop duration: ${TOTAL_DUR}s (log: $LOG_FILE)"
  exit 1
fi

echo -e "${GREEN}✅ Environment stopped successfully in ${TOTAL_DUR}s.${NC}"
log "Log file: $LOG_FILE"