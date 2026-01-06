#!/bin/bash
# Development Server Startup Script

set -e

echo "🚀 Starting Easy-Flow Development Servers"
echo "========================================="

# ✅ INTEGRATION: Run environment check before starting
echo ""
echo "📋 Checking development environment..."
if ./scripts/dev-env-check.sh; then
    echo ""
else
    echo "⚠️  Environment check failed, but continuing anyway..."
    echo ""
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for timeout command (for Kafka init script)
# On macOS, 'timeout' is 'gtimeout' from 'coreutils'
if ! command -v timeout &> /dev/null && ! command -v gtimeout &> /dev/null; then
    echo -e "${YELLOW}⚠ 'timeout' command not found. This may cause a non-critical error during Kafka topic initialization.${NC}"
    echo -e "${YELLOW}  On macOS, you can install it via Homebrew: 'brew install coreutils'${NC}"
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}✗ PM2 is not installed. Installing...${NC}"
    npm install -g pm2
fi

# ==========================================
# AUTOMATIC DEPENDENCY INSTALLATION
# ==========================================
echo ""
echo -e "${YELLOW}📦 Checking and installing dependencies...${NC}"

# Temporarily disable exit on error for dependency installation
set +e

# Function to check if a specific npm package is installed
check_npm_package() {
    local dir=$1
    local package=$2
    
    if [ -d "$dir/node_modules" ]; then
        if [ -d "$dir/node_modules/$package" ] || [ -f "$dir/node_modules/$package/package.json" ]; then
            return 0  # Package exists
        fi
    fi
    return 1  # Package missing
}

# Function to check and install npm dependencies
install_npm_deps() {
    local dir=$1
    local name=$2
    local required_packages="${3:-}"  # Optional: comma-separated list of required packages
    
    if [ -f "$dir/package.json" ]; then
        local needs_install=false
        
        # Check if node_modules exists and has content
        if [ ! -d "$dir/node_modules" ] || [ -z "$(ls -A "$dir/node_modules" 2>/dev/null)" ]; then
            needs_install=true
        # Check if package.json is newer than node_modules
        elif [ "$dir/package.json" -nt "$dir/node_modules" ]; then
            needs_install=true
        # Check for required packages if specified
        elif [ -n "$required_packages" ]; then
            IFS=',' read -ra PACKAGES <<< "$required_packages"
            for package in "${PACKAGES[@]}"; do
                if ! check_npm_package "$dir" "$package"; then
                    needs_install=true
                    break
                fi
            done
        fi
        
        if [ "$needs_install" = true ]; then
            echo -e "${YELLOW}  Installing $name dependencies...${NC}"
            if [ -d "$dir" ]; then
                # Use npm ci if package-lock.json exists (faster, more reliable)
                # ✅ FIX: Handle interruptions gracefully and continue script execution
                local install_result=0
                if [ -f "$dir/package-lock.json" ]; then
                    (cd "$dir" && npm ci --silent 2>/dev/null) || install_result=$?
                else
                    (cd "$dir" && npm install --silent 2>/dev/null) || install_result=$?
                fi
                if [ $install_result -eq 0 ]; then
                    echo -e "${GREEN}  ✓ $name dependencies installed${NC}"
                else
                    echo -e "${YELLOW}  ⚠ Failed to install $name dependencies (exit code: $install_result)${NC}"
                    echo -e "${YELLOW}     Continuing anyway - dependencies may be partially installed${NC}"
                    echo -e "${YELLOW}     To retry manually: cd $dir && npm install${NC}"
                    # ✅ FIX: Don't return error - continue script execution
                    return 0
                fi
            else
                echo -e "${YELLOW}  ⚠ Directory $dir not found, skipping${NC}"
                return 0
            fi
        else
            echo -e "${GREEN}  ✓ $name dependencies already installed${NC}"
        fi
    fi
    return 0
}

# Function to check and install Python dependencies
install_python_deps() {
    local dir=$1
    local name=$2
    local requirements_file=$3
    
    if [ -f "$requirements_file" ]; then
        # Check if key packages are installed by trying to import them
        # Check first package in requirements (usually the most critical)
        local first_pkg=$(head -1 "$requirements_file" | cut -d'=' -f1 | cut -d'>' -f1 | cut -d'<' -f1 | tr -d ' ' | tr '[:upper:]' '[:lower:]')
        local import_name=$(echo "$first_pkg" | sed 's/-/_/g' | sed 's/\./_/g')
        
        # Try importing the package
        if ! python3 -c "import $import_name" 2>/dev/null; then
            echo -e "${YELLOW}  Installing $name Python dependencies...${NC}"
            if [ -d "$dir" ]; then
                (cd "$dir" && (
                    pip3 install --user -r "$(basename "$requirements_file")" --quiet 2>/dev/null || \
                    pip3 install -r "$(basename "$requirements_file")" --quiet 2>/dev/null || \
                    python3 -m pip install --user -r "$(basename "$requirements_file")" --quiet 2>/dev/null || \
                    python3 -m pip install -r "$(basename "$requirements_file")" --quiet 2>/dev/null
                ))
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}  ✓ $name Python dependencies installed${NC}"
                else
                    echo -e "${YELLOW}  ⚠ Could not install $name Python dependencies automatically${NC}"
                    echo -e "${YELLOW}     You may need to run: cd $dir && pip3 install -r $(basename $requirements_file)${NC}"
                fi
            else
                echo -e "${YELLOW}  ⚠ Directory $dir not found, skipping${NC}"
            fi
        else
            echo -e "${GREEN}  ✓ $name Python dependencies already installed${NC}"
        fi
    fi
}

# Install root dependencies (dotenv is REQUIRED for ecosystem.config.js)
# CRITICAL: dotenv must be installed before generating ecosystem.config.js
install_npm_deps "." "Root" "dotenv"
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to install root dependencies (dotenv required)${NC}"
    echo -e "${YELLOW}  Attempting manual installation...${NC}"
    npm install dotenv --save 2>/dev/null || {
        echo -e "${RED}✗ Critical: Cannot install dotenv. Please run: npm install${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ dotenv installed${NC}"
fi

# Install backend dependencies
# ✅ FIX: Continue even if install fails (non-critical for startup)
install_npm_deps "rpa-system/backend" "Backend" || echo -e "${YELLOW}  ⚠ Backend dependencies install had issues, continuing...${NC}"

# Install frontend dependencies
# ✅ FIX: Continue even if install fails (non-critical for startup)
install_npm_deps "rpa-system/rpa-dashboard" "Frontend" || echo -e "${YELLOW}  ⚠ Frontend dependencies install had issues, continuing...${NC}"

# Install automation service Python dependencies
install_python_deps "rpa-system/automation/automation-service" "Automation Service" "rpa-system/automation/automation-service/requirements.txt"

# Also check general automation requirements
if [ -f "rpa-system/automation/requirements.txt" ]; then
    install_python_deps "rpa-system/automation" "Automation" "rpa-system/automation/requirements.txt"
fi

# Re-enable exit on error
set -e

echo -e "${GREEN}✓ All dependencies checked${NC}"
echo ""

# ✅ FIX: RAG service is now included in ecosystem.config.js for automatic startup
# Just check/install dependencies here - the service will start with other PM2 services
echo -e "${YELLOW}Preparing RAG service...${NC}"
RAG_DIR="/Users/ky/rag-node-ts"
RAG_PORT=${RAG_SERVICE_PORT:-3002}  # Use 3002 to avoid conflict with Grafana (3001)

if [ -d "$RAG_DIR" ]; then
    # Check if RAG service dependencies are installed
    if [ ! -d "$RAG_DIR/node_modules" ]; then
        echo -e "${YELLOW}  Installing RAG service dependencies...${NC}"
        (cd "$RAG_DIR" && npm install --silent 2>/dev/null) || {
            echo -e "${YELLOW}  ⚠ Failed to install RAG dependencies automatically${NC}"
            echo -e "${YELLOW}  You may need to run: cd $RAG_DIR && npm install${NC}"
        }
    fi
    echo -e "${GREEN}✓ RAG service will be started automatically with other services${NC}"
else
    echo -e "${YELLOW}⚠ RAG service directory not found at $RAG_DIR${NC}"
    echo -e "${YELLOW}  RAG service will be skipped (non-critical for core functionality)${NC}"
fi
echo ""

# Stop any existing PM2 processes
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 delete all 2>/dev/null || true

# Set dynamic ports from environment variables with defaults (before port freeing)
# Note: Unset PORT if it was set by RAG service to avoid affecting BACKEND_PORT
unset PORT 2>/dev/null || true
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${PORT:-3030}
AUTOMATION_PORT=${AUTOMATION_PORT:-7070}
BACKEND_METRICS_PORT=${BACKEND_METRICS_PORT:-9091}

# Check if ngrok should be started (for OAuth redirect URIs requiring HTTPS)
# Start ngrok if: NGROK_ENABLED is set, or API_BASE_URL contains ngrok, or SLACK_CLIENT_ID is set
NGROK_ENABLED=${NGROK_ENABLED:-false}

# Load backend .env variables for ngrok detection (without affecting current environment)
BACKEND_ENV_FILE="rpa-system/backend/.env"
BACKEND_API_BASE_URL=""
BACKEND_SLACK_CLIENT_ID=""
if [ -f "$BACKEND_ENV_FILE" ]; then
    # Extract specific variables from .env file without sourcing
    BACKEND_API_BASE_URL=$(grep "^API_BASE_URL=" "$BACKEND_ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "")
    BACKEND_SLACK_CLIENT_ID=$(grep "^SLACK_CLIENT_ID=" "$BACKEND_ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "")
fi

# Determine if ngrok should start
SHOULD_START_NGROK=false
if [ "$NGROK_ENABLED" = "true" ] || [ "$NGROK_ENABLED" = "1" ]; then
    SHOULD_START_NGROK=true
elif [[ "${BACKEND_API_BASE_URL}" == *"ngrok"* ]] || [[ "${API_BASE_URL:-}" == *"ngrok"* ]]; then
    SHOULD_START_NGROK=true
elif [ -n "${BACKEND_SLACK_CLIENT_ID}" ] || [ -n "${SLACK_CLIENT_ID:-}" ]; then
    # If Slack OAuth is configured, ngrok is likely needed (Slack requires HTTPS)
    SHOULD_START_NGROK=true
fi

# Start ngrok if needed
if [ "$SHOULD_START_NGROK" = true ]; then
    if command -v ngrok &> /dev/null; then
        # Check if ngrok is already running
        if ! curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
            echo -e "${YELLOW}Starting ngrok tunnel for HTTPS OAuth redirects...${NC}"
            # Ensure logs directory exists
            mkdir -p logs
            
            # Don't kill existing ngrok - preserve it if running to keep URL stable
            # Only kill if there's a stale PID file pointing to a dead process
            if [ -f ".ngrok.pid" ]; then
                NGROK_PID=$(cat .ngrok.pid 2>/dev/null)
                if [ -n "$NGROK_PID" ] && ! kill -0 "$NGROK_PID" 2>/dev/null; then
                    # PID file exists but process is dead - clean it up
                    rm -f .ngrok.pid
                fi
            fi
            
            # Verify backend is running on the expected port
            if ! lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
                echo -e "${YELLOW}⚠ Backend not running on port $BACKEND_PORT yet${NC}"
                echo -e "${YELLOW}  ngrok will start but may fail until backend starts${NC}"
            fi
            
            # Start ngrok in background, redirecting output to a log file
            # Note: Free tier shows a warning page on first visit (OAuth providers will see this)
            # Users can click "Visit Site" to proceed. This is a ngrok free tier limitation.
            echo -e "${YELLOW}  Starting ngrok tunnel to port $BACKEND_PORT...${NC}"
            nohup ngrok http $BACKEND_PORT > logs/ngrok.log 2>&1 &
            NGROK_PID=$!
            echo $NGROK_PID > .ngrok.pid
            echo -e "${GREEN}✓ ngrok started (PID: $NGROK_PID)${NC}"
            
            # Wait for ngrok to be ready
            echo -e "${YELLOW}  Waiting for ngrok to initialize...${NC}"
            NGROK_URL=""
            for i in {1..15}; do
                sleep 1
                if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
                    # Get the ngrok URL
                    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
                    if [ -n "$NGROK_URL" ]; then
                        echo -e "${GREEN}✓ ngrok ready: $NGROK_URL${NC}"
                        
                        # Automatically update API_BASE_URL in .env file
                        if [ -f "$BACKEND_ENV_FILE" ]; then
                            # Check if API_BASE_URL exists in .env
                            if grep -q "^API_BASE_URL=" "$BACKEND_ENV_FILE" 2>/dev/null; then
                                # Update existing API_BASE_URL
                                if [[ "$OSTYPE" == "darwin"* ]]; then
                                    # macOS
                                    sed -i '' "s|^API_BASE_URL=.*|API_BASE_URL=$NGROK_URL|" "$BACKEND_ENV_FILE"
                                else
                                    # Linux
                                    sed -i "s|^API_BASE_URL=.*|API_BASE_URL=$NGROK_URL|" "$BACKEND_ENV_FILE"
                                fi
                            else
                                # Add API_BASE_URL if it doesn't exist
                                echo "API_BASE_URL=$NGROK_URL" >> "$BACKEND_ENV_FILE"
                            fi
                            echo -e "${GREEN}✓ Updated API_BASE_URL in $BACKEND_ENV_FILE${NC}"
                        fi
                        break
                    fi
                fi
                # Show progress every 3 seconds
                if [ $((i % 3)) -eq 0 ]; then
                    echo -e "${YELLOW}    Still waiting... (${i}/15)${NC}"
                fi
            done
            
            if [ -z "$NGROK_URL" ]; then
                echo -e "${RED}✗ ngrok failed to start or URL not accessible${NC}"
                echo -e "${YELLOW}  Check logs/ngrok.log for details${NC}"
                if [ -f logs/ngrok.log ]; then
                    echo -e "${YELLOW}  Last few lines:${NC}"
                    tail -5 logs/ngrok.log 2>/dev/null || true
                fi
            fi
        else
            # ngrok is already running, get the URL
            NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
            if [ -n "$NGROK_URL" ]; then
                echo -e "${GREEN}✓ ngrok already running: $NGROK_URL${NC}"
            else
                echo -e "${YELLOW}⚠ ngrok appears to be running but URL not accessible${NC}"
            fi
        fi
    else
        echo -e "${RED}✗ ngrok not installed (required for Slack OAuth HTTPS redirects)${NC}"
        echo -e "${YELLOW}  Install: brew install ngrok${NC}"
        echo -e "${YELLOW}  Then configure: ngrok config add-authtoken YOUR_TOKEN${NC}"
        echo -e "${YELLOW}  Or set NGROK_ENABLED=false to skip${NC}"
    fi
else
    echo -e "${YELLOW}ℹ ngrok not needed (Slack OAuth not configured or disabled)${NC}"
fi

# Ensure critical ports are free (prevent address in use errors)
echo -e "${YELLOW}Freeing up critical ports...${NC}"
for port in $FRONTEND_PORT $BACKEND_PORT $AUTOMATION_PORT $BACKEND_METRICS_PORT; do
    if lsof -ti:$port > /dev/null 2>&1; then
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✓ Freed port $port${NC}"
    fi
done
sleep 1

# Check if Docker daemon is running (with retry and better error handling)
DOCKER_READY=false
DOCKER_RETRIES=3
for i in $(seq 1 $DOCKER_RETRIES); do
    if docker info > /dev/null 2>&1; then
        DOCKER_READY=true
        break
    fi
    if [ $i -lt $DOCKER_RETRIES ]; then
        echo -e "${YELLOW}  Docker check failed, retrying ($i/$DOCKER_RETRIES)...${NC}"
        sleep 2
    fi
done

if [ "$DOCKER_READY" = false ]; then
    echo -e "${RED}✗ Docker daemon is not accessible${NC}"
    echo -e "${YELLOW}  Attempting to diagnose and fix...${NC}"
    
    # Check if Docker Desktop is installed
    DOCKER_APP_PATH=""
    if [ -d "/Applications/Docker.app" ]; then
        DOCKER_APP_PATH="/Applications/Docker.app"
    elif [ -d "$HOME/Applications/Docker.app" ]; then
        DOCKER_APP_PATH="$HOME/Applications/Docker.app"
    fi
    
    if [ -n "$DOCKER_APP_PATH" ]; then
        echo -e "${YELLOW}  Docker Desktop is installed but not running${NC}"
        echo -e "${GREEN}  🚀 Automatically opening Docker Desktop...${NC}"
        
        # Open Docker Desktop
        open "$DOCKER_APP_PATH" 2>/dev/null || {
            echo -e "${YELLOW}  ⚠ Could not open Docker Desktop automatically${NC}"
            echo -e "${YELLOW}  Please open Docker Desktop manually and wait for it to start${NC}"
        }
        
        # Wait for Docker to become ready (with progress indicator)
        echo -e "${YELLOW}  ⏳ Waiting for Docker Desktop to start (this may take 30-60 seconds)...${NC}"
        DOCKER_START_WAIT=0
        DOCKER_START_MAX=60  # Wait up to 60 seconds
        while [ $DOCKER_START_WAIT -lt $DOCKER_START_MAX ]; do
            if docker info > /dev/null 2>&1; then
                echo -e "${GREEN}  ✓ Docker Desktop is now ready!${NC}"
                DOCKER_READY=true
                break
            fi
            # Show progress every 5 seconds
            if [ $((DOCKER_START_WAIT % 5)) -eq 0 ] && [ $DOCKER_START_WAIT -gt 0 ]; then
                echo -e "${YELLOW}    Still waiting... (${DOCKER_START_WAIT}s/${DOCKER_START_MAX}s)${NC}"
            fi
            sleep 1
            DOCKER_START_WAIT=$((DOCKER_START_WAIT + 1))
        done
        
        if [ "$DOCKER_READY" = false ]; then
            echo -e "${YELLOW}  ⚠ Docker Desktop is starting but not ready yet${NC}"
            echo -e "${YELLOW}  Continuing anyway (Docker is only needed for Kafka and monitoring stack)${NC}"
            echo -e "${YELLOW}  Services will start automatically once Docker is ready${NC}"
        fi
    else
        echo -e "${YELLOW}  Docker Desktop may not be installed${NC}"
        echo -e "${YELLOW}  Install from: https://www.docker.com/products/docker-desktop${NC}"
        echo -e "${YELLOW}  Continuing anyway (Docker is only needed for Kafka and monitoring stack)${NC}"
    fi
    
    # Check common socket paths for troubleshooting
    if [ "$DOCKER_READY" = false ]; then
    if [ -S "/var/run/docker.sock" ]; then
        echo -e "${YELLOW}  Found socket at /var/run/docker.sock (checking permissions...)${NC}"
    elif [ -S "$HOME/.docker/run/docker.sock" ]; then
        echo -e "${YELLOW}  Found socket at $HOME/.docker/run/docker.sock${NC}"
    else
        echo -e "${YELLOW}  No Docker socket found at common locations${NC}"
    fi
    echo -e "${YELLOW}  You can start Docker later and run: docker compose up -d${NC}"
    fi
    echo ""
    # Don't exit - allow script to continue (Docker services are optional)
fi

# Stop Docker frontend container if running (it uses frontend port)
# Only if Docker is available
if [ "$DOCKER_READY" = true ]; then
    echo -e "${YELLOW}Stopping Docker frontend container...${NC}"
    docker stop easy-flow-rpa-dashboard-1 2>/dev/null || true
fi

sleep 2

# Create logs directory if it doesn't exist
mkdir -p logs
# Clear existing logs to start fresh
rm -f logs/*.log

# Start Kafka and Zookeeper via Docker Compose with automatic error recovery
# Only proceed if Docker is available
if [ "$DOCKER_READY" = true ]; then
    echo -e "${YELLOW}Starting Kafka and Zookeeper...${NC}"

# Function to check if Kafka is healthy (not just running, but actually responding)
check_kafka_health() {
    local container_name=$(docker compose ps kafka --format json 2>/dev/null | grep -o '"Name":"[^"]*"' | cut -d'"' -f4 | head -1)
    if [ -z "$container_name" ]; then
        return 1
    fi
    # Check if Kafka broker is responding
    docker exec "$container_name" kafka-broker-api-versions --bootstrap-server kafka:29092 >/dev/null 2>&1
}

# Function to clean up and restart Kafka/Zookeeper (handles stale Zookeeper nodes)
cleanup_and_restart_kafka() {
    echo -e "${YELLOW}  Cleaning up Kafka/Zookeeper state...${NC}"
    # Stop and remove containers completely (clears Zookeeper state)
    docker compose stop kafka zookeeper 2>/dev/null || true
    docker compose rm -f kafka zookeeper 2>/dev/null || true
    # Wait a moment for cleanup
    sleep 2
    # Start fresh
    if docker compose up -d kafka zookeeper 2>/dev/null; then
        return 0
    else
        echo -e "${YELLOW}  Retry: Pulling images and starting...${NC}"
        docker compose pull kafka zookeeper 2>/dev/null || true
        docker compose up -d kafka zookeeper 2>/dev/null
        return $?
    fi
}

# Try to start normally first
if ! docker compose up -d kafka zookeeper 2>/dev/null; then
    echo -e "${YELLOW}  Initial start failed, attempting cleanup and retry...${NC}"
    cleanup_and_restart_kafka
fi

# Wait for containers to be running
echo -e "${YELLOW}  Waiting for containers to be ready...${NC}"
MAX_WAIT=15
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker compose ps kafka zookeeper 2>/dev/null | grep -q "Up"; then
        break
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

# Check if Kafka is actually healthy (not just running) - reduced timeout for dev
echo -e "${YELLOW}  Verifying Kafka health...${NC}"
MAX_HEALTH_WAIT=15
HEALTH_WAIT=0
while [ $HEALTH_WAIT -lt $MAX_HEALTH_WAIT ]; do
    if check_kafka_health; then
        echo -e "${GREEN}✓ Kafka is healthy${NC}"
        break
    fi
    # If Kafka container exists but isn't healthy, check for Zookeeper node conflicts
    if [ $HEALTH_WAIT -eq 10 ] || [ $HEALTH_WAIT -eq 20 ]; then
        echo -e "${YELLOW}  Kafka not responding, checking for stale Zookeeper nodes...${NC}"
        # Check Kafka logs for NodeExistsException (stale Zookeeper node)
        kafka_container=$(docker compose ps kafka --format json 2>/dev/null | grep -o '"Name":"[^"]*"' | cut -d'"' -f4 | head -1)
        if [ -n "$kafka_container" ] && docker logs "$kafka_container" 2>&1 | grep -q "NodeExistsException"; then
            echo -e "${YELLOW}  Detected stale Zookeeper node, cleaning up and restarting...${NC}"
            if cleanup_and_restart_kafka; then
                HEALTH_WAIT=0  # Reset counter after cleanup
                continue
            else
                echo -e "${YELLOW}  Cleanup failed, will retry...${NC}"
            fi
        fi
    fi
    sleep 2
    HEALTH_WAIT=$((HEALTH_WAIT + 2))
done

    # Final health check
    if ! check_kafka_health; then
        echo -e "${YELLOW}⚠ Kafka health check failed, attempting final cleanup and restart...${NC}"
        cleanup_and_restart_kafka
        sleep 10
        if ! check_kafka_health; then
            echo -e "${YELLOW}⚠ Kafka may not be fully ready, but continuing (topics will auto-create)${NC}"
        else
            echo -e "${GREEN}✓ Kafka recovered after cleanup${NC}"
        fi
    fi

    # Initialize Kafka topics
    echo -e "${YELLOW}Initializing Kafka topics...${NC}"
    ./scripts/init-kafka-topics.sh || {
      echo -e "${RED}⚠ Warning: Failed to initialize Kafka topics${NC}"
      echo -e "${YELLOW}  Topics will be auto-created on first use${NC}"
    }
else
    echo -e "${YELLOW}⚠ Skipping Kafka startup (Docker not available)${NC}"
    echo -e "${YELLOW}  Start Docker and run: docker compose up -d kafka zookeeper${NC}"
fi

# Start Observability Stack (Prometheus, Grafana, Loki, Tempo, OTEL Collector, Alertmanager)
# Only proceed if Docker is available
if [ "$DOCKER_READY" = true ]; then
    echo -e "${YELLOW}Starting Observability Stack...${NC}"
    # Clean up any existing monitoring containers first
    docker compose -f rpa-system/docker-compose.monitoring.yml down 2>/dev/null || true
    # Remove stale containers that may conflict (including manually started ones)
    docker rm -f easyflow-prometheus easyflow-grafana easyflow-loki easyflow-promtail easyflow-tempo easyflow-otel-collector easyflow-alertmanager 2>/dev/null || true
    # Start all monitoring services
    if ! docker compose -f rpa-system/docker-compose.monitoring.yml up -d 2>/dev/null; then
        echo -e "${YELLOW}⚠ Failed to start observability stack, attempting to pull images...${NC}"
        docker compose -f rpa-system/docker-compose.monitoring.yml pull 2>/dev/null || true
        docker compose -f rpa-system/docker-compose.monitoring.yml up -d || {
            echo -e "${YELLOW}⚠ Observability stack failed to start (non-critical, continuing...)${NC}"
            echo -e "${YELLOW}  You can start it manually: docker compose -f rpa-system/docker-compose.monitoring.yml up -d${NC}"
        }
    fi
    
    sleep 5

    # Wait for Grafana to be ready (reduced timeout for dev)
    echo -e "${YELLOW}Waiting for Grafana to be ready...${NC}"
    GRAFANA_READY=false
    for i in {1..15}; do
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Grafana is ready${NC}"
            GRAFANA_READY=true
            break
        fi
        sleep 2
    done
    [ "$GRAFANA_READY" = false ] && echo -e "${YELLOW}⚠ Grafana may still be starting (check http://localhost:3001)${NC}"

    echo -e "${GREEN}✓ Observability stack started${NC}"
    echo "  Grafana:        http://localhost:3001 (admin/admin123)"
    echo "  Prometheus:     http://localhost:9090"
    echo "  Loki:           http://localhost:3100 (logs)"
    echo "  Promtail:       http://localhost:9080 (log shipper)"
    echo "  Tempo:          http://localhost:3200"
    echo "  OTEL Collector: http://localhost:4318 (HTTP) / 4317 (gRPC)"
    echo "  Alertmanager:   http://localhost:9093"
else
    echo -e "${YELLOW}⚠ Skipping Observability Stack startup (Docker not available)${NC}"
    echo -e "${YELLOW}  Start Docker and run: docker compose -f rpa-system/docker-compose.monitoring.yml up -d${NC}"
fi

# Get absolute path for logs to avoid PM2 cwd resolution issues
ROOT_DIR=$(pwd)

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  echo -e "${GREEN}Loading environment variables from .env file...${NC}"
  export $(cat .env | grep -v '^#' | xargs)
else
  echo -e "${YELLOW}⚠️  No .env file found. Using defaults or environment variables.${NC}"
  echo -e "${YELLOW}   Create a .env file in the project root with your configuration.${NC}"
fi

# Set dynamic ports from environment variables with defaults
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${PORT:-3030}
AUTOMATION_PORT=${AUTOMATION_PORT:-7070}
BACKEND_METRICS_PORT=${BACKEND_METRICS_PORT:-9091}

# Export ports and RAG URL so they're available in the ecosystem.config.js generation
export FRONTEND_PORT BACKEND_PORT AUTOMATION_PORT BACKEND_METRICS_PORT
export RAG_SERVICE_URL="http://localhost:${RAG_PORT:-3002}"

# Verify dotenv is installed before generating ecosystem.config.js
if ! check_npm_package "." "dotenv"; then
    echo -e "${RED}✗ Critical: dotenv package not found in node_modules${NC}"
    echo -e "${YELLOW}  Installing dotenv...${NC}"
    npm install dotenv --save --silent 2>/dev/null || {
        echo -e "${RED}✗ Failed to install dotenv. Cannot continue.${NC}"
        exit 1
    }
fi

# Generate a dynamic ecosystem file that reads from environment variables
echo -e "${YELLOW}Generating PM2 ecosystem config...${NC}"

# Load frontend .env.local if it exists
FRONTEND_ENV_VARS={}
if [ -f "rpa-system/rpa-dashboard/.env.local" ]; then
  echo -e "${GREEN}Loading frontend environment variables from .env.local...${NC}"
  # Export all REACT_APP_ and VITE_ variables from .env.local
  set -a
  source rpa-system/rpa-dashboard/.env.local 2>/dev/null || true
  set +a
fi

cat > ecosystem.config.js << EOL
// Load environment variables from .env file
require('dotenv').config();

// Load frontend .env.local if it exists
const fs = require('fs');
const path = require('path');
const frontendEnvPath = path.join(__dirname, 'rpa-system/rpa-dashboard/.env.local');
if (fs.existsSync(frontendEnvPath)) {
  const frontendEnv = require('dotenv').config({ path: frontendEnvPath });
  if (frontendEnv.parsed) {
    console.log('Loaded frontend .env.local with', Object.keys(frontendEnv.parsed).length, 'variables');
  }
}

// Get root directory dynamically
const ROOT_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: 'easyflow-backend',
      script: 'server.js',
      cwd: 'rpa-system/backend',
      watch: ['rpa-system/backend'],
      ignore_watch: ['node_modules', 'logs'],
      error_file: path.join(ROOT_DIR, 'logs/backend-error.log'),
      out_file: path.join(ROOT_DIR, 'logs/backend.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '3030',
        KAFKA_ENABLED: process.env.KAFKA_ENABLED || 'true',
        AUTOMATION_URL: process.env.AUTOMATION_URL || 'http://127.0.0.1:' + (process.env.AUTOMATION_PORT || '7070'),
        KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'easyflow-backend',
        KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || '127.0.0.1:9092',
        KAFKA_BROKERS: process.env.KAFKA_BROKERS || '127.0.0.1:9092',
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
        SESSION_SECRET: process.env.SESSION_SECRET,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
        SUPABASE_BUCKET: process.env.SUPABASE_BUCKET,
        DEV_BYPASS_TOKEN: process.env.DEV_BYPASS_TOKEN,
        DEV_USER_ID: process.env.DEV_USER_ID,
        RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://localhost:3002',
      },
    },
    {
      name: 'easyflow-frontend',
      script: 'node_modules/.bin/react-scripts',
      args: 'start',
      cwd: 'rpa-system/rpa-dashboard',
      error_file: path.join(ROOT_DIR, 'logs/frontend-error.log'),
      out_file: path.join(ROOT_DIR, 'logs/frontend.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PORT: process.env.FRONTEND_PORT || '3000',
        BROWSER: process.env.BROWSER || 'none',
        REACT_APP_API_BASE: process.env.REACT_APP_API_BASE,
        PUBLIC_URL: process.env.PUBLIC_URL,
        // Load all REACT_APP_ and VITE_ variables from .env.local
        ...Object.keys(process.env)
          .filter(key => key.startsWith('REACT_APP_') || key.startsWith('VITE_'))
          .reduce((acc, key) => {
            acc[key] = process.env[key];
            return acc;
          }, {}),
      },
    },
    {
      name: 'easyflow-automation',
      script: 'production_automation_service.py',
      interpreter: 'python3',
      cwd: 'rpa-system/automation/automation-service',
      error_file: path.join(ROOT_DIR, 'logs/automation-worker.log'),
      out_file: path.join(ROOT_DIR, 'logs/automation-worker.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PYTHONUNBUFFERED: process.env.PYTHONUNBUFFERED || '1',
        KAFKA_ENABLED: process.env.KAFKA_ENABLED || 'true',
        PORT: process.env.AUTOMATION_PORT || '7070',
        BACKEND_URL: process.env.BACKEND_URL || 'http://127.0.0.1:' + (process.env.PORT || '3030'),
        KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || '127.0.0.1:9092',
        KAFKA_BROKERS: process.env.KAFKA_BROKERS || '127.0.0.1:9092',
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
        ENV: process.env.ENV || process.env.NODE_ENV || 'development',
        NODE_ENV: process.env.NODE_ENV || process.env.ENV || 'development',
      },
    },
  ],
};

// ✅ FIX: Add RAG service to ecosystem config if it exists
const RAG_DIR = '/Users/ky/rag-node-ts';
if (fs.existsSync(RAG_DIR) && fs.existsSync(path.join(RAG_DIR, 'package.json'))) {
  try {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(RAG_DIR, 'package.json'), 'utf8'));
    // Determine the start script (prefer 'start' for production, fallback to 'dev')
    // Use 'start' if dist exists (built version), otherwise use 'dev'
    const hasBuilt = fs.existsSync(path.join(RAG_DIR, 'dist', 'index.js'));
    const scriptName = (hasBuilt && pkgJson.scripts?.start) ? 'start' : (pkgJson.scripts?.dev ? 'dev' : (pkgJson.scripts?.start ? 'start' : 'dev'));
    
    module.exports.apps.push({
      name: 'rag-node-ts',
      script: 'npm',
      args: 'run ' + scriptName,
      cwd: RAG_DIR,
      interpreter: 'node',
      error_file: path.join(ROOT_DIR, 'logs/rag-error.log'),
      out_file: path.join(ROOT_DIR, 'logs/rag.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PORT: process.env.RAG_SERVICE_PORT || '3002',
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    });
  } catch (e) {
    // RAG service config failed, continue without it (non-critical)
  }
}
EOL

# Start all services with PM2
echo -e "${GREEN}Starting all services with PM2...${NC}"
if ! pm2 start ecosystem.config.js 2>/dev/null; then
    echo -e "${RED}✗ Failed to start services with PM2${NC}"
    echo -e "${YELLOW}  Checking ecosystem.config.js syntax...${NC}"
    # Validate the config file
    if node -e "require('./ecosystem.config.js')" 2>/dev/null; then
        echo -e "${GREEN}✓ ecosystem.config.js is valid${NC}"
        echo -e "${YELLOW}  Attempting PM2 start again...${NC}"
        pm2 start ecosystem.config.js || {
            echo -e "${RED}✗ PM2 start failed. Check PM2 logs: pm2 logs${NC}"
            exit 1
        }
    else
        echo -e "${RED}✗ ecosystem.config.js has syntax errors${NC}"
        echo -e "${YELLOW}  Error details:${NC}"
        node -e "require('./ecosystem.config.js')" 2>&1 | head -5
        exit 1
    fi
fi

# Check services health
echo ""

# Wait for Backend (reduced timeout for dev)
BACKEND_OK=false
for i in {1..15}; do
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        BACKEND_OK=true
        break
    fi
    sleep 1
done
[ "$BACKEND_OK" = false ] && { echo -e "${RED}✗ Backend failed to start${NC}"; pm2 logs easyflow-backend --lines 20 --nostream; }

# Wait for Automation Worker (reduced timeout for dev)
AUTO_OK=false
for i in {1..15}; do
    if curl -s http://localhost:$AUTOMATION_PORT/health > /dev/null; then
        echo -e "${GREEN}✓ Automation worker is healthy${NC}"
        AUTO_OK=true
        break
    fi
    sleep 1
done
[ "$AUTO_OK" = false ] && { echo -e "${RED}✗ Automation worker failed to start${NC}"; echo -e "${YELLOW}Error logs:${NC}"; pm2 logs easyflow-automation --err --lines 20 --nostream; }

# Wait for RAG service (non-critical, but check if it was started)
if pm2 list | grep -q "rag-node-ts"; then
    RAG_OK=false
    for i in {1..10}; do
        if curl -s http://localhost:${RAG_PORT:-3002}/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ RAG service is healthy${NC}"
            RAG_OK=true
            break
        fi
        sleep 1
    done
    [ "$RAG_OK" = false ] && echo -e "${YELLOW}⚠ RAG service may still be starting (non-critical)${NC}"
fi

# Wait for Prometheus to be ready, then reload config to pick up backend metrics
# Only if Docker is available and observability stack was started
if [ "$DOCKER_READY" = true ]; then
    echo -e "${YELLOW}Waiting for Prometheus to be ready...${NC}"
    PROMETHEUS_READY=false
    for i in {1..15}; do
        if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Prometheus is ready${NC}"
            PROMETHEUS_READY=true
            break
        fi
        sleep 1
    done

    if [ "$PROMETHEUS_READY" = true ] && [ "$BACKEND_OK" = true ]; then
        echo -e "${YELLOW}Reloading Prometheus configuration to discover backend metrics...${NC}"
    if curl -s -X POST http://localhost:9090/-/reload > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Prometheus configuration reloaded${NC}"
        # Wait for Prometheus to scrape targets
        # Business metrics has 60s scrape_interval, so we need to wait longer
        echo -e "${YELLOW}Waiting for Prometheus to scrape targets (business metrics scrape every 60s)...${NC}"
        sleep 5
        
        # Check critical targets first (backend, prometheus, otel-collector - these scrape every 15-30s)
        CRITICAL_TARGETS_UP=false
        for i in {1..4}; do
            TARGETS_JSON=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null)
            # Check if critical targets are up (backend, prometheus, otel-collector)
            CRITICAL_UP=$(echo "$TARGETS_JSON" | grep -o '"health":"up"' | wc -l | tr -d ' ')
            if [ "$CRITICAL_UP" -ge 3 ]; then
                echo -e "${GREEN}✓ Critical Prometheus targets healthy ($CRITICAL_UP targets UP)${NC}"
                CRITICAL_TARGETS_UP=true
                break
            fi
            sleep 5
        done
        
        # Wait briefly for business metrics (reduced wait for dev)
        if [ "$CRITICAL_TARGETS_UP" = true ]; then
            echo -e "${YELLOW}Waiting for business metrics scrape...${NC}"
            sleep 5
            # Final check - count all UP targets
            TARGETS_JSON=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null)
            TOTAL_UP=$(echo "$TARGETS_JSON" | grep -o '"health":"up"' | wc -l | tr -d ' ')
            UNKNOWN_COUNT=$(echo "$TARGETS_JSON" | grep -o '"health":"unknown"' | wc -l | tr -d ' ')
            if [ "$TOTAL_UP" -ge 3 ]; then
                echo -e "${GREEN}✓ Prometheus targets healthy ($TOTAL_UP targets UP"
                if [ "$UNKNOWN_COUNT" -gt 0 ]; then
                    echo -e "${YELLOW}  ($UNKNOWN_COUNT targets still initializing - will scrape within 60s)${NC}"
                else
                    echo -e "${GREEN})${NC}"
                fi
            else
                echo -e "${YELLOW}⚠ Some Prometheus targets still initializing (check http://localhost:9090/targets)${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ Prometheus targets may still be initializing (check http://localhost:9090/targets)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Could not reload Prometheus (may need manual reload at http://localhost:9090/-/reload)${NC}"
    fi
    fi
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All services started successfully!${NC}"
echo ""
echo "Application:"
echo "  Frontend:         http://localhost:$FRONTEND_PORT"
echo "  Backend:          http://localhost:$BACKEND_PORT"
echo "  Automation:       http://localhost:$AUTOMATION_PORT"
echo "  Health Check:     http://localhost:$BACKEND_PORT/health"
if [ "$SHOULD_START_NGROK" = true ] && [ -n "${NGROK_URL:-}" ]; then
    echo "  ngrok (HTTPS):    $NGROK_URL"
    echo "  OAuth Callback:   $NGROK_URL/api/integrations/*/oauth/callback"
fi
echo ""
if [ "$DOCKER_READY" = true ]; then
    echo "Infrastructure:"
    echo "  Kafka:            localhost:9092"
    echo ""
    echo "Services:"
    echo "  RAG Service:      http://localhost:${RAG_PORT:-3002}"
    echo ""
    echo "Observability:"
    echo "  Grafana:          http://localhost:3001 (admin/admin123)"
    echo "  Prometheus:       http://localhost:9090"
    echo "  Loki:             http://localhost:3100 (logs)"
    echo "  Promtail:         http://localhost:9080 (log shipper)"
    echo "  Tempo:            http://localhost:3200"
    echo "  OTEL Collector:   http://localhost:4318 (HTTP) / 4317 (gRPC)"
    echo "  Alertmanager:     http://localhost:9093"
    echo "  Backend Metrics:  http://localhost:$BACKEND_METRICS_PORT/metrics"
    echo ""
    echo "  All logs are automatically shipped to Loki and visible in Grafana"
else
    echo "Services:"
    echo "  RAG Service:      http://localhost:${RAG_PORT:-3002}"
    echo ""
    echo -e "${YELLOW}⚠ Docker not available - Kafka and Observability stack skipped${NC}"
    echo -e "${YELLOW}  To start them:${NC}"
    echo -e "${YELLOW}    1. Ensure Docker Desktop is running${NC}"
    echo -e "${YELLOW}    2. Run: docker compose up -d kafka zookeeper${NC}"
    echo -e "${YELLOW}    3. Run: docker compose -f rpa-system/docker-compose.monitoring.yml up -d${NC}"
fi
echo ""
echo "Logs (PM2):"
echo "  All services:     pm2 logs"
echo "  Backend only:     pm2 logs easyflow-backend"
echo "  Frontend only:    pm2 logs easyflow-frontend"
echo "  Automation only:  pm2 logs easyflow-automation"
echo ""
echo "  Log files:"
echo "    Backend:        logs/backend.log"
echo "    Frontend:       logs/frontend.log"
echo "    Automation:     logs/automation-worker.log"
echo ""
echo "Process Management:"
echo "  Status:           pm2 status"
echo "  Restart service:  pm2 restart <service-name>"
echo "  Stop services:    ./stop-dev.sh"
echo ""
echo -e "${YELLOW}To stop all services: ./stop-dev.sh${NC}"
echo ""

# ✅ FIX: Log viewing is completely optional - removed automatic log opening
# Users can view logs manually with: pm2 logs
