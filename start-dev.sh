#!/bin/bash

# EasyFlow Self-Healing Start Script
# Handles dependencies, Docker, ports, ngrok, and service orchestration

set -e # Exit on error
set -o pipefail

# Verbose mode
VERBOSE=false
for arg in "$@"; do
  case "$arg" in
    -v|--verbose) VERBOSE=true ;;
  esac
done
[ "$VERBOSE" = true ] && set -x
[ "$VERBOSE" = true ] && trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

# Configuration
PROJECT_ROOT=$(pwd)
RPA_SYSTEM_DIR="$PROJECT_ROOT/rpa-system"
BACKEND_DIR="$RPA_SYSTEM_DIR/backend"
FRONTEND_DIR="$RPA_SYSTEM_DIR/rpa-dashboard"

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

log() { echo -e "${BLUE}[EasyFlow]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Ensure running from root
if [ ! -d "$RPA_SYSTEM_DIR" ]; then
    error "Please run this script from the project root (Easy-Flow)"
    exit 1
fi

log "Starting self-healing initialization sequence..."

# Timestamp for traceability
echo ""
echo "<current_datetime>$(date -Is)</current_datetime>"
echo ""

# ==============================================================================
# 1. Helper Functions
# ==============================================================================

ensure_docker_running() {
    if ! docker info > /dev/null 2>&1; then
        warn "Docker is not running or unresponsive. Attempting to start..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open -a Docker
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo systemctl start docker
        fi
        
        # Wait for Docker with timeout
        local MAX_RETRIES=30
        local COUNT=0
        while ! docker info > /dev/null 2>&1; do
            sleep 2
            echo -n "."
            COUNT=$((COUNT+1))
            if [ $COUNT -ge $MAX_RETRIES ]; then
                error "Docker failed to start. Please start it manually."
                return 1
            fi
        done
        echo ""
        success "Docker daemon started"
    else
        success "Docker is running"
    fi
}

# Initial check
ensure_docker_running

# ==============================================================================
# 2. Port Freeing & Cleanup
# ==============================================================================
log "Checking for stuck ports..."
PORTS_TO_CHECK=(3000 3030 5432 6379 9092 2181 9090 3001)

for PORT in "${PORTS_TO_CHECK[@]}"; do
    PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        warn "Port $PORT is in use. Killing PIDs: $(echo "$PID" | tr '\n' ' ')"
        echo "$PID" | xargs kill -9 2>/dev/null || true
    fi
done
success "Ports cleared"

# ==============================================================================
# 3. Dependency Checks & Auto-Install
# ==============================================================================
log "Checking dependencies..."

check_and_install() {
    local DIR=$1
    local NAME=$2
    if [ ! -d "$DIR/node_modules" ]; then
        warn "$NAME dependencies missing. Installing..."
        (cd "$DIR" && npm install)
    else
        success "$NAME dependencies found"
    fi
}

check_and_install "$BACKEND_DIR" "Backend"
check_and_install "$FRONTEND_DIR" "Frontend"

# Self-heal: Update noisy dependency in frontend to reduce log spam
log "Updating frontend tooling to reduce log noise..."
(cd "$FRONTEND_DIR" && npm i baseline-browser-mapping@latest -D)

# Check for dotenv existence (backend)
if [ ! -f "$BACKEND_DIR/.env" ] || [ ! -s "$BACKEND_DIR/.env" ]; then
    error "Backend .env file missing at $BACKEND_DIR/.env"
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
        warn "Created .env from example"
    else
        exit 1
    fi
fi

# ==============================================================================
# 4. Kafka/Zookeeper Cleanup & Infrastructure Start
# ==============================================================================
log "Resetting Kafka/Zookeeper state..."

COMPOSE_FILES=()
if [ -f "$CORE_DOCKER_COMPOSE_FILE" ]; then
    COMPOSE_FILES+=(-f "$CORE_DOCKER_COMPOSE_FILE")
fi
if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    COMPOSE_FILES+=(-f "$DOCKER_COMPOSE_FILE")
fi

if [ ${#COMPOSE_FILES[@]} -gt 0 ]; then
    # Remove volumes to ensure clean state for Kafka/Zookeeper
    ensure_docker_running # Verify docker again before command
    docker compose "${COMPOSE_FILES[@]}" down -v --remove-orphans 2>/dev/null || true
    
    log "Starting infrastructure containers..."
    
    # Retry loop for infrastructure start
    MAX_ATTEMPTS=3
    ATTEMPT=1
    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        if docker compose "${COMPOSE_FILES[@]}" up -d postgres redis zookeeper kafka automation-worker; then
            success "Infrastructure started successfully"
            [ "$VERBOSE" = true ] && docker compose "${COMPOSE_FILES[@]}" logs -f --tail=50 postgres redis zookeeper kafka automation-worker &
            break
        else
            warn "Failed to start infrastructure (Attempt $ATTEMPT/$MAX_ATTEMPTS)"
            warn "Docker daemon might have been disrupted. Re-verifying Docker status..."
            ensure_docker_running
            sleep 3
            ATTEMPT=$((ATTEMPT+1))
        fi
    done
    
    if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then error "Failed to start infrastructure after retries."; exit 1; fi
else
    warn "No Docker compose files found. Skipping infrastructure start."
fi

# ==============================================================================
# 5. ngrok Auto-start & API_BASE_URL Update
# ==============================================================================
if command -v ngrok &> /dev/null; then
    log "Starting ngrok tunnel..."
    pkill ngrok || true
    if [ "$VERBOSE" = true ]; then
    ngrok http 3030 --log=stdout &
else
    ngrok http 3030 --log=stdout > /dev/null 2>&1 &
fi
    sleep 3
    
    # Extract URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$NGROK_URL" ]; then
        success "ngrok active at $NGROK_URL"
        
        # Update Backend .env (OS-specific sed)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|API_BASE_URL=.*|API_BASE_URL=$NGROK_URL|g" "$BACKEND_DIR/.env"
        else
            sed -i "s|API_BASE_URL=.*|API_BASE_URL=$NGROK_URL|g" "$BACKEND_DIR/.env"
        fi
        success "Updated API_BASE_URL in backend/.env"
    else
        warn "Could not retrieve ngrok URL"
    fi
else
    warn "ngrok not installed. Skipping tunnel."
fi

# ==============================================================================
# 6. Service Startup (PM2 or npm)
# ==============================================================================
log "Starting services..."

if command -v pm2 &> /dev/null; then
    log "Using PM2 process manager"
    pm2 delete all 2>/dev/null || true
    
    # Start Backend
    cd "$BACKEND_DIR"
    pm2 start app.js --name "easyflow-backend" --watch --ignore-watch="node_modules logs"
    
    # Start Frontend
    cd "$FRONTEND_DIR"
    pm2 start npm --name "easyflow-frontend" -- start
    
    cd "$PROJECT_ROOT"
    pm2 save
    [ "$VERBOSE" = true ] && pm2 logs --timestamp --lines 50 &
    success "Services started with PM2"
else
    warn "PM2 not found. Starting with npm concurrently..."
    trap 'kill $(jobs -p)' SIGINT
    
    (cd "$BACKEND_DIR" && npm run dev) &
    (cd "$FRONTEND_DIR" && npm start) &
fi

# ==============================================================================
# 7. Health Checks
# ==============================================================================
log "Performing health checks and self-healing verification..."

check_health() {
    local NAME=$1
    local URL=$2
    local PATTERN=$3
    local TIMEOUT=5

    # Silent check
    for i in $(seq 1 $TIMEOUT); do
        local RESPONSE=$(curl -s --max-time 2 "$URL" || true)
        if [ -n "$RESPONSE" ]; then
            if [ -z "$PATTERN" ] || echo "$RESPONSE" | grep -q "$PATTERN"; then
                return 0
            fi
        fi
        sleep 1
    done
    return 1
}

# Retry loop for overall environment health
MAX_GLOBAL_RETRIES=10
GLOBAL_ATTEMPT=1
ALL_SERVICES_UP=false

while [ $GLOBAL_ATTEMPT -le $MAX_GLOBAL_RETRIES ]; do
    log "Verification attempt $GLOBAL_ATTEMPT/$MAX_GLOBAL_RETRIES..."
    CURRENT_PASS=true

    # 1. Backend Check
    if check_health "Backend" "http://localhost:3030/health" "healthy"; then
        success "Backend is healthy"
    else
        warn "Backend is unresponsive. Attempting self-heal..."
        if command -v pm2 &> /dev/null; then pm2 restart easyflow-backend; fi
        CURRENT_PASS=false
    fi

    # 2. Frontend Check
    if check_health "Frontend" "http://localhost:3000"; then
        success "Frontend is healthy"
    else
        warn "Frontend is unresponsive. Attempting self-heal..."
        if command -v pm2 &> /dev/null; then pm2 restart easyflow-frontend; fi
        CURRENT_PASS=false
    fi

    # 3. Grafana Check
    if check_health "Grafana" "http://localhost:3001/api/health" "database"; then
        success "Grafana is healthy"
    else
        warn "Grafana is unresponsive. Restarting service..."
        docker compose "${COMPOSE_FILES[@]}" restart grafana 2>/dev/null || true
        CURRENT_PASS=false
    fi
    
    # 4. Prometheus Check
    if check_health "Prometheus" "http://localhost:9090/-/healthy" "Prometheus"; then
        success "Prometheus is healthy"
    else
        warn "Prometheus is unresponsive. Restarting service..."
        docker compose "${COMPOSE_FILES[@]}" restart prometheus 2>/dev/null || true
        CURRENT_PASS=false
    fi

    if [ "$CURRENT_PASS" = "true" ]; then
        ALL_SERVICES_UP=true
        break
    fi

    if [ $GLOBAL_ATTEMPT -lt $MAX_GLOBAL_RETRIES ]; then
        log "Waiting 10s for services to recover..."
        sleep 10
    fi
    GLOBAL_ATTEMPT=$((GLOBAL_ATTEMPT+1))
done

if [ "$ALL_SERVICES_UP" = "true" ]; then
    success "EasyFlow environment is fully up and running! 🚀"
else
    error "Environment failed to stabilize after self-healing attempts."
    error "Please check logs: pm2 logs or docker compose logs"
    exit 1
fi

echo ""
echo "================================================================================"
echo "   EASYFLOW ENVIRONMENT STATUS"
echo "================================================================================"
echo -e "   ${GREEN}Frontend:${NC}      http://localhost:3000"
echo -e "   ${GREEN}Backend:${NC}       http://localhost:3030"
echo -e "   ${GREEN}Grafana:${NC}       http://localhost:3001 (User: admin, Pass: admin123)"
echo -e "   ${GREEN}Prometheus:${NC}    http://localhost:9090"
echo -e "   ${GREEN}AlertManager:${NC}  http://localhost:9093"
echo "================================================================================"
echo -e "   To view streaming logs, run one of the following:"
echo -e "   ${BLUE}App Logs:${NC}      pm2 logs --no-daemon"
echo -e "   ${BLUE}Infra Logs:${NC}    (cd rpa-system && docker compose -f docker-compose.yml -f docker-compose.monitoring.yml logs -f)"
echo -e "   ${BLUE}Stop:${NC}          ./stop-dev.sh"
echo "================================================================================"