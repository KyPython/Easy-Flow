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

# Function to check and install npm dependencies
install_npm_deps() {
    local dir=$1
    local name=$2
    
    if [ -f "$dir/package.json" ]; then
        if [ ! -d "$dir/node_modules" ] || [ "$dir/package.json" -nt "$dir/node_modules" ]; then
            echo -e "${YELLOW}  Installing $name dependencies...${NC}"
            if [ -d "$dir" ]; then
                (cd "$dir" && npm install --silent 2>/dev/null)
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}  ✓ $name dependencies installed${NC}"
                else
                    echo -e "${RED}  ✗ Failed to install $name dependencies${NC}"
                    echo -e "${YELLOW}     You may need to run: cd $dir && npm install${NC}"
                fi
            else
                echo -e "${YELLOW}  ⚠ Directory $dir not found, skipping${NC}"
            fi
        else
            echo -e "${GREEN}  ✓ $name dependencies already installed${NC}"
        fi
    fi
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

# Install root dependencies (dotenv, husky, etc.)
install_npm_deps "." "Root"

# Install backend dependencies
install_npm_deps "rpa-system/backend" "Backend"

# Install frontend dependencies
install_npm_deps "rpa-system/rpa-dashboard" "Frontend"

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

# Stop any existing PM2 processes
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 delete all 2>/dev/null || true

# Set dynamic ports from environment variables with defaults (before port freeing)
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${PORT:-3030}
AUTOMATION_PORT=${AUTOMATION_PORT:-7070}
BACKEND_METRICS_PORT=${BACKEND_METRICS_PORT:-9091}

# Ensure critical ports are free (prevent address in use errors)
echo -e "${YELLOW}Freeing up critical ports...${NC}"
for port in $FRONTEND_PORT $BACKEND_PORT $AUTOMATION_PORT $BACKEND_METRICS_PORT; do
    if lsof -ti:$port > /dev/null 2>&1; then
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✓ Freed port $port${NC}"
    fi
done
sleep 1

# Stop Docker frontend container if running (it uses frontend port)
echo -e "${YELLOW}Stopping Docker frontend container...${NC}"
docker stop easy-flow-rpa-dashboard-1 2>/dev/null || true

sleep 2

# Create logs directory if it doesn't exist
mkdir -p logs
# Clear existing logs to start fresh
rm -f logs/*.log

# Start Kafka and Zookeeper via Docker Compose
echo -e "${YELLOW}Starting Kafka and Zookeeper...${NC}"
docker compose up -d kafka zookeeper
sleep 5

# Initialize Kafka topics
echo -e "${YELLOW}Initializing Kafka topics...${NC}"
./scripts/init-kafka-topics.sh || {
  echo -e "${RED}⚠ Warning: Failed to initialize Kafka topics${NC}"
  echo -e "${YELLOW}  Topics will be auto-created on first use${NC}"
}

# Start Observability Stack (Prometheus, Grafana, Loki, Tempo, OTEL Collector, Alertmanager)
echo -e "${YELLOW}Starting Observability Stack...${NC}"
# Clean up any existing monitoring containers first
docker compose -f rpa-system/docker-compose.monitoring.yml down 2>/dev/null || true
# Remove stale containers that may conflict (including manually started ones)
docker rm -f easyflow-prometheus easyflow-grafana easyflow-loki easyflow-promtail easyflow-tempo easyflow-otel-collector easyflow-alertmanager 2>/dev/null || true
# Start all monitoring services
docker compose -f rpa-system/docker-compose.monitoring.yml up -d
sleep 5

# Wait for Grafana to be ready (it may restart due to datasource provisioning)
echo -e "${YELLOW}Waiting for Grafana to be ready...${NC}"
GRAFANA_READY=false
for i in {1..30}; do
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

# Export ports so they're available in the ecosystem.config.js generation
export FRONTEND_PORT BACKEND_PORT AUTOMATION_PORT BACKEND_METRICS_PORT

# Generate a dynamic ecosystem file that reads from environment variables
echo -e "${YELLOW}Generating PM2 ecosystem config...${NC}"
cat > ecosystem.config.js << EOL
// Load environment variables from .env file
require('dotenv').config();

// Get root directory dynamically
const path = require('path');
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
      },
    },
  ],
};
EOL

# Start all services with PM2
echo -e "${GREEN}Starting all services with PM2...${NC}"
pm2 start ecosystem.config.js

# Check services health
echo ""

# Wait for Backend (up to 30s)
BACKEND_OK=false
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        BACKEND_OK=true
        break
    fi
    sleep 1
done
[ "$BACKEND_OK" = false ] && { echo -e "${RED}✗ Backend failed to start${NC}"; pm2 logs easyflow-backend --lines 20 --nostream; }

# Wait for Automation Worker (up to 30s)
AUTO_OK=false
for i in {1..30}; do
    if curl -s http://localhost:$AUTOMATION_PORT/health > /dev/null; then
        echo -e "${GREEN}✓ Automation worker is healthy${NC}"
        AUTO_OK=true
        break
    fi
    sleep 1
done
[ "$AUTO_OK" = false ] && { echo -e "${RED}✗ Automation worker failed to start${NC}"; echo -e "${YELLOW}Error logs:${NC}"; pm2 logs easyflow-automation --err --lines 20 --nostream; }

# Wait for Prometheus to be ready, then reload config to pick up backend metrics
echo -e "${YELLOW}Waiting for Prometheus to be ready...${NC}"
PROMETHEUS_READY=false
for i in {1..30}; do
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
        for i in {1..8}; do
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
        
        # Wait a bit more for business metrics (scrapes every 60s)
        if [ "$CRITICAL_TARGETS_UP" = true ]; then
            echo -e "${YELLOW}Waiting for business metrics scrape (may take up to 60s)...${NC}"
            sleep 10
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

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All services started successfully!${NC}"
echo ""
echo "Application:"
echo "  Frontend:         http://localhost:$FRONTEND_PORT"
echo "  Backend:          http://localhost:$BACKEND_PORT"
echo "  Automation:       http://localhost:$AUTOMATION_PORT"
echo "  Health Check:     http://localhost:$BACKEND_PORT/health"
echo ""
echo "Infrastructure:"
echo "  Kafka:            localhost:9092"
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

# Wait for user input
read -p "Press Enter to view PM2 logs (Ctrl+C to exit)..."
pm2 logs
