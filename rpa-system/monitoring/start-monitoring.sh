#!/bin/bash

# EasyFlow Monitoring Stack Startup Script
# This script starts the complete monitoring infrastructure

set -e

echo "🚀 Starting EasyFlow Monitoring Stack..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install it and try again."
    exit 1
fi

# Create necessary directories
print_status "Creating monitoring directories..."
mkdir -p grafana/{dashboards,provisioning/{datasources,dashboards}}

# Create Grafana provisioning configuration
cat > grafana/provisioning/datasources/datasources.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
EOF

cat > grafana/provisioning/dashboards/dashboards.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/dashboards
EOF

# Start monitoring stack
print_status "Starting monitoring services..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 30

# Check service health
check_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:$port" > /dev/null 2>&1; then
            print_status "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    print_warning "$service_name might not be ready (port $port not responding)"
    return 1
}

print_status "Checking service health..."
check_service "Prometheus" 9090
check_service "Grafana" 3001
check_service "Alertmanager" 9093
check_service "Node Exporter" 9100
check_service "cAdvisor" 8080
check_service "Loki" 3100

# Import Grafana dashboards
print_status "Setting up Grafana dashboards..."

# Wait a bit more for Grafana to be fully ready
sleep 10

# Copy dashboard files to the mounted volume
if [ -f "./grafana/dashboards/easyflow-overview.json" ]; then
    print_status "EasyFlow overview dashboard found, importing..."
fi

if [ -f "./grafana/dashboards/system-monitoring.json" ]; then
    print_status "System monitoring dashboard found, importing..."
fi

if [ -f "./grafana/dashboards/load-testing.json" ]; then
    print_status "Load testing dashboard found, importing..."
fi

echo ""
echo "🎉 Monitoring stack started successfully!"
echo ""
echo "Access URLs:"
echo "  📊 Grafana:        http://localhost:3001 (admin/admin123)"
echo "  📈 Prometheus:     http://localhost:9090"
echo "  🚨 Alertmanager:   http://localhost:9093"
echo "  💻 Node Exporter:  http://localhost:9100"
echo "  🐳 cAdvisor:       http://localhost:8080"
echo "  📋 Loki:          http://localhost:3100"
echo ""
echo "To stop the monitoring stack:"
echo "  docker-compose -f docker-compose.monitoring.yml down"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.monitoring.yml logs -f"
echo ""

# Optional: Run a quick connectivity test
if command -v ./health-check.sh &> /dev/null; then
    print_status "Running health check..."
    ./health-check.sh --monitoring-only
fi

print_status "Monitoring setup complete! 🚀"