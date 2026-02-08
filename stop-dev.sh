#!/bin/bash

# EasyFlow Self-Healing Stop Script
# Features:
# - Graceful shutdown with timeouts and force-kill fallback
# - Automatic retry on stuck processes
# - Port cleanup with multiple attempts
# - Supabase-aware shutdown
# - Detailed logging and verification
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

## 1. Stop PM2/Node with retry logic
if command -v pm2 &> /dev/null; then
  log "Stopping PM2 processes..."
  local PM2_STOP_ATTEMPTS=3
  local PM2_ATTEMPT=1
  
  while [ $PM2_ATTEMPT -le $PM2_STOP_ATTEMPTS ]; do
    if [ $PM2_ATTEMPT -gt 1 ]; then
      warn "PM2 stop attempt $PM2_ATTEMPT/$PM2_STOP_ATTEMPTS..."
      sleep 2
    fi
    
    # Try graceful stop first
    pm2 delete all 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    pm2 flush 2>/dev/null || true
    pm2 save --force 2>/dev/null || true
    
    # Check if PM2 is actually stopped
    if ! pm2 list 2>/dev/null | grep -q "online\|stopping"; then
      success "PM2 processes stopped on attempt $PM2_ATTEMPT"
      break
    fi
    
    if [ $PM2_ATTEMPT -eq $PM2_STOP_ATTEMPTS ]; then
      warn "PM2 processes still running after $PM2_STOP_ATTEMPTS attempts, will force-kill"
      pkill -9 -f "PM2" 2>/dev/null || true
    fi
    
    PM2_ATTEMPT=$((PM2_ATTEMPT + 1))
  done
  
  run_step "Clearing PM2 dump" bash -lc "pm2 unstartup 2>/dev/null || true; pm2 reset all 2>/dev/null || true"
else
  log "PM2 not installed, skipping PM2 shutdown"
fi

## 1.5 Stop Local Supabase with retry logic
if command -v supabase &> /dev/null; then
  if supabase status 2>/dev/null | grep -q "API URL"; then
    log "Stopping local Supabase..."
    local SUPABASE_STOP_ATTEMPTS=3
    local SUPABASE_ATTEMPT=1
    
    while [ $SUPABASE_ATTEMPT -le $SUPABASE_STOP_ATTEMPTS ]; do
      if [ $SUPABASE_ATTEMPT -gt 1 ]; then
        warn "Supabase stop attempt $SUPABASE_ATTEMPT/$SUPABASE_STOP_ATTEMPTS..."
        sleep 2
      fi
      
      # Try graceful stop
      if supabase stop 2>/dev/null; then
        # Verify it's actually stopped
        sleep 1
        if ! supabase status 2>/dev/null | grep -q "API URL"; then
          success "Supabase stopped successfully on attempt $SUPABASE_ATTEMPT"
          break
        fi
      fi
      
      if [ $SUPABASE_ATTEMPT -eq $SUPABASE_STOP_ATTEMPTS ]; then
        warn "Supabase still running after $SUPABASE_STOP_ATTEMPTS attempts"
        warn "Forcing Supabase Docker containers to stop..."
        docker ps -a | grep supabase | awk '{print $1}' | xargs -r docker stop -t 10 2>/dev/null || true
        docker ps -a | grep supabase | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
      fi
      
      SUPABASE_ATTEMPT=$((SUPABASE_ATTEMPT + 1))
    done
  else
    log "Supabase not running, skipping Supabase shutdown"
  fi
else
  log "Supabase CLI not installed, skipping Supabase shutdown"
fi

# Fallback: Kill any remaining node processes
run_step "Killing stray node processes" bash -lc "pkill -f 'node' 2>/dev/null || true"

# 2. Stop ngrok
run_step "Stopping ngrok" bash -lc "pkill ngrok 2>/dev/null || true"

## 3. Stop Docker Infrastructure with enhanced error handling
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
  local DOCKER_STOP_ATTEMPTS=2
  local DOCKER_ATTEMPT=1
  local DOCKER_SUCCESS=false
  
  while [ $DOCKER_ATTEMPT -le $DOCKER_STOP_ATTEMPTS ]; do
    if [ $DOCKER_ATTEMPT -gt 1 ]; then
      warn "Docker compose down attempt $DOCKER_ATTEMPT/$DOCKER_STOP_ATTEMPTS..."
      sleep 3
    fi
    
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
    
    if [ $RC -eq 0 ]; then
      DOCKER_SUCCESS=true
      break
    elif [ $DOCKER_ATTEMPT -eq $DOCKER_STOP_ATTEMPTS ]; then
      warn "Docker compose down failed after $DOCKER_STOP_ATTEMPTS attempts"
      warn "Forcing container removal..."
      
      # Force stop all project containers
      docker ps -a --filter "name=easy-flow" --format "{{.ID}}" | xargs -r docker stop -t 10 2>/dev/null || true
      docker ps -a --filter "name=easy-flow" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
      
      # Also stop rpa-system named containers
      docker ps -a --filter "name=rpa-system" --format "{{.ID}}" | xargs -r docker stop -t 10 2>/dev/null || true
      docker ps -a --filter "name=rpa-system" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
    fi
    
    DOCKER_ATTEMPT=$((DOCKER_ATTEMPT + 1))
  done
  
  DUR=$(( $(date +%s) - START_D ))
  if [ "$DOCKER_SUCCESS" = true ]; then
    success "Docker containers (including observability stack) stopped in ${DUR}s"
  else
    warn "Docker shutdown completed with force-kill in ${DUR}s"
    warn "Log tail:"
    tail -n 5 "$LOG_FILE" | sed 's/^/    /'
  fi
else
  warn "No Docker compose files found. Skipping Docker shutdown."
fi

# 4. Free Ports with retry logic (Safety net)
# Includes local Supabase ports: 54321 (API), 54322 (DB), 54323 (Studio), 54324 (Inbucket)
PORTS=(3000 3030 5432 6379 9092 2181 9090 3001 3100 3200 54321 54322 54323 54324)
log "Ensuring ports are free: ${PORTS[*]}"
P_START=$(date +%s)

local PORT_CLEANUP_ATTEMPTS=3
local PORTS_FREED=0
local TOTAL_PORTS=${#PORTS[@]}

for ATTEMPT in $(seq 1 $PORT_CLEANUP_ATTEMPTS); do
  local PORTS_STILL_BUSY=()
  
  if [ $ATTEMPT -gt 1 ]; then
    warn "Port cleanup attempt $ATTEMPT/$PORT_CLEANUP_ATTEMPTS..."
    sleep 1
  fi
  
  for PORT in "${PORTS[@]}"; do
    PID=$(lsof -n -P -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
      if [ $ATTEMPT -lt $PORT_CLEANUP_ATTEMPTS ]; then
        # Graceful termination first
        echo "$PID" | xargs kill -TERM 2>/dev/null || true
      else
        # Force kill on last attempt
        echo "$PID" | xargs kill -9 2>/dev/null || true
      fi
      
      # Wait a moment and check if freed
      sleep 0.5
      if ! lsof -ti:$PORT >/dev/null 2>&1; then
        log "Freed port $PORT (PIDs: $(echo "$PID" | tr '\n' ' '))"
        PORTS_FREED=$((PORTS_FREED + 1))
      else
        PORTS_STILL_BUSY+=($PORT)
      fi
    else
      PORTS_FREED=$((PORTS_FREED + 1))
    fi
  done
  
  # If all ports are free, break early
  if [ ${#PORTS_STILL_BUSY[@]} -eq 0 ]; then
    success "All ports freed on attempt $ATTEMPT"
    break
  elif [ $ATTEMPT -eq $PORT_CLEANUP_ATTEMPTS ]; then
    warn "Could not free ports after $PORT_CLEANUP_ATTEMPTS attempts: ${PORTS_STILL_BUSY[*]}"
  fi
done

success "Port sweep complete in $(( $(date +%s) - P_START ))s ($PORTS_FREED/$TOTAL_PORTS ports freed)"

# 5. Verification and Final Cleanup
log "Verifying shutdown..."
FAILED=0
STUCK_PORTS=()

for PORT in "${PORTS[@]}"; do
  if lsof -ti:$PORT >/dev/null 2>&1; then
    warn "Port $PORT is still in use!"
    STUCK_PORTS+=($PORT)
    FAILED=1
  fi
done

# Additional Docker cleanup if containers are still running
if docker ps --filter "name=easy-flow" --filter "name=rpa-system" --filter "name=supabase" --format "{{.Names}}" 2>/dev/null | grep -q .; then
  warn "Some Docker containers are still running. Performing final cleanup..."
  
  docker ps --filter "name=easy-flow" --format "{{.ID}}" | xargs -r docker stop -t 5 2>/dev/null || true
  docker ps --filter "name=rpa-system" --format "{{.ID}}" | xargs -r docker stop -t 5 2>/dev/null || true
  docker ps --filter "name=supabase" --format "{{.ID}}" | xargs -r docker stop -t 5 2>/dev/null || true
  
  docker ps -a --filter "name=easy-flow" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
  docker ps -a --filter "name=rpa-system" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
  docker ps -a --filter "name=supabase" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
  
  success "Final Docker cleanup completed"
fi

# Cleanup dangling networks
DANGLING_NETWORKS=$(docker network ls --filter "name=easy-flow" --filter "name=rpa-system" --format "{{.ID}}" 2>/dev/null || true)
if [ -n "$DANGLING_NETWORKS" ]; then
  log "Removing project networks..."
  echo "$DANGLING_NETWORKS" | xargs -r docker network rm 2>/dev/null || true
fi

TOTAL_DUR=$(( $(date +%s) - TOTAL_START ))
if [ $FAILED -eq 1 ]; then
  warn "Some services could not be stopped completely."
  if [ ${#STUCK_PORTS[@]} -gt 0 ]; then
    warn "Ports still in use: ${STUCK_PORTS[*]}"
    warn "Manual cleanup may be required: lsof -ti:<port> | xargs kill -9"
  fi
  warn "Total stop duration: ${TOTAL_DUR}s (log: $LOG_FILE)"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Environment stopped successfully in ${TOTAL_DUR}s${NC}"
echo ""
log "Shutdown Summary:"
log "  - PM2 processes: stopped"
log "  - Supabase: stopped"
log "  - Docker containers: stopped"
log "  - Ports freed: $PORTS_FREED/$TOTAL_PORTS"
log "  - Total duration: ${TOTAL_DUR}s"
log "  - Log file: $LOG_FILE"
echo ""