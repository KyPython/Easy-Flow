#!/bin/bash

# EasyFlow Stop Script (progress, timing, and full logging)
set -o pipefail

# Verbose flag
VERBOSE=false
KEEP_VOLUMES=false
for arg in "$@"; do
  case "$arg" in
    -v|--verbose) VERBOSE=true ;;
    -k|--keep-volumes) KEEP_VOLUMES=true ;;
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


# Python logging integration
py_log() {
  python3 scripts/human_log.py "$1" "$2"
}
py_actionable_log() {
  python3 scripts/human_log.py "$1" "$2" "$3"
}

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
exec > >(tee -a "$LOG_FILE") 2>&1

# Helpers
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { py_log "$1" "EasyFlow"; }
success() { py_log "$1" "✅"; }
warn() { py_log "$1" "⚠️"; }
error() { py_log "$1" "❌"; }

spinner() {
  local pid=$1
  local msg="$2"
  local start=$3
  local timeout=${4:-120} # Default timeout 120s
  
  # Disable xtrace during spinner to avoid flooding output if VERBOSE is on
  local restore_xtrace=false
  if [[ $- == *x* ]]; then
    set +x
    restore_xtrace=true
  fi

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

  if [ "$restore_xtrace" = true ]; then
    set -x
  fi
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
log "<current_datetime>$(ts)</current_datetime>"
log "🛑  Stopping EasyFlow Environment..."

## 1. Stop PM2/Node
if command -v pm2 &> /dev/null; then
  run_step "Stopping PM2 processes" bash -lc "pm2 delete all 2>/dev/null || true; pm2 kill 2>/dev/null || true; pm2 flush 2>/dev/null || true; pm2 save --force 2>/dev/null || true"
  run_step "Clearing PM2 dump" bash -lc "pm2 unstartup 2>/dev/null || true; pm2 reset all 2>/dev/null || true"
fi

## 1.5 Stop Local Supabase (if running)
if command -v supabase &> /dev/null; then
  if supabase status 2>/dev/null | grep -q "API URL"; then
    run_step "Stopping local Supabase" bash -lc "supabase stop 2>/dev/null || true"
  fi
fi

# Fallback: Kill any remaining node processes
run_step "Killing stray node processes" bash -lc "pkill -f 'node' 2>/dev/null || true"

# 2. Stop ngrok
run_step "Stopping ngrok" bash -lc "pkill ngrok 2>/dev/null || true"

## 3. Stop Docker Infrastructure (including observability stack)
COMPOSE_FILES=()
[ -f "$CORE_DOCKER_COMPOSE_FILE" ] && COMPOSE_FILES+=(-f "$CORE_DOCKER_COMPOSE_FILE")
[ -f "$DOCKER_COMPOSE_FILE" ] && COMPOSE_FILES+=(-f "$DOCKER_COMPOSE_FILE")
MONITORING_COMPOSE_FILE="$RPA_SYSTEM_DIR/docker-compose.monitoring.yml"
[ -f "$MONITORING_COMPOSE_FILE" ] && COMPOSE_FILES+=(-f "$MONITORING_COMPOSE_FILE")

if [ ${#COMPOSE_FILES[@]} -gt 0 ]; then
  DOCKER_ARGS=("down" "--remove-orphans" "-t" "30")
  if [ "$KEEP_VOLUMES" = false ]; then
    log "Stopping Docker containers (docker compose down -v --remove-orphans)..."
    DOCKER_ARGS+=("-v")
  else
    log "Stopping Docker containers (docker compose down --remove-orphans)..."
  fi

  START_D=$(date +%s)
  # Add timeout (-t 30) and trap interrupts to ensure clean exit
  docker compose "${COMPOSE_FILES[@]}" "${DOCKER_ARGS[@]}" >> "$LOG_FILE" 2>&1 &
  PID=$!
  trap "kill $PID 2>/dev/null" INT TERM
  spinner $PID "Docker down in progress" $START_D 120
  set +e
  wait $PID
  RC=$?
  set -e
  trap - INT TERM
  DUR=$(( $(date +%s) - START_D ))
  if [ $RC -eq 0 ]; then
    success "Docker containers (including observability stack) stopped in ${DUR}s"
  else
    warn "Docker down exited with code $RC in ${DUR}s"
    warn "Log tail:"
    tail -n 5 "$LOG_FILE" | sed 's/^/    /'
  fi
else
  warn "No Docker compose files found. Skipping Docker shutdown."
fi

# 4. Free Ports (Safety net)
# Includes local Supabase ports: 54321 (API), 54322 (DB), 54323 (Studio), 54324 (Inbucket)
PORTS=(3000 3030 5432 6379 9092 2181 9090 3001 3100 3200 54321 54322 54323 54324)
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