#!/bin/bash

# Kafka-based Microservices Monitoring Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if containers are running
check_container_health() {
    local container_name=$1
    local service_name=$2
    
    if docker ps --format "table {{.Names}}" | grep -q "^$container_name$"; then
        print_success "$service_name is running"
        return 0
    else
        print_error "$service_name is not running"
        return 1
    fi
}

# Check HTTP endpoint health
check_endpoint_health() {
    local url=$1
    local service_name=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        print_success "$service_name endpoint is healthy"
        return 0
    else
        print_error "$service_name endpoint is unhealthy"
        return 1
    fi
}

# Get container stats
get_container_stats() {
    local container_name=$1
    echo "$(docker stats --no-stream --format "CPU: {{.CPUPerc}} | Memory: {{.MemUsage}}" $container_name 2>/dev/null || echo "N/A")"
}

# Main monitoring function
monitor_services() {
    print_header "Kafka-based Automation Services Monitor"
    
    echo ""
    print_header "Container Status"
    
    # Check infrastructure services
    check_container_health "zookeeper" "Zookeeper"
    check_container_health "kafka" "Kafka Broker"
    check_container_health "kafka-ui" "Kafka UI"
    
    # Check automation workers
    check_container_health "automation-worker-1" "Automation Worker 1"
    check_container_health "automation-worker-2" "Automation Worker 2"  
    check_container_health "automation-worker-3" "Automation Worker 3"
    
    # Check other services
    check_container_health "automation-backend" "Backend Service"
    check_container_health "automation-nginx" "Nginx Load Balancer"
    
    echo ""
    print_header "Health Endpoint Checks"
    
    # Check health endpoints
    check_endpoint_health "http://localhost:8080" "Kafka UI"
    check_endpoint_health "http://localhost/health" "Nginx Load Balancer"
    check_endpoint_health "http://localhost/worker-1/health" "Worker 1"
    check_endpoint_health "http://localhost/worker-2/health" "Worker 2"
    check_endpoint_health "http://localhost/worker-3/health" "Worker 3"
    
    echo ""
    print_header "Kafka Topic Information"
    
    # Check Kafka topics
    if docker exec kafka kafka-topics --list --bootstrap-server localhost:9092 &> /dev/null; then
        print_success "Kafka topics:"
        docker exec kafka kafka-topics --list --bootstrap-server localhost:9092 | while read topic; do
            echo "  • $topic"
        done
        
        echo ""
        print_status "Topic details:"
        docker exec kafka kafka-topics --describe --topic automation-tasks --bootstrap-server localhost:9092 2>/dev/null | head -2 | tail -1
        docker exec kafka kafka-topics --describe --topic automation-results --bootstrap-server localhost:9092 2>/dev/null | head -2 | tail -1
    else
        print_error "Could not connect to Kafka"
    fi
    
    echo ""
    print_header "Resource Usage"
    
    # Show resource usage for key containers
    containers=("kafka" "automation-worker-1" "automation-worker-2" "automation-worker-3" "automation-nginx")
    
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "^$container$"; then
            stats=$(get_container_stats "$container")
            echo "• $container: $stats"
        fi
    done
    
    echo ""
    print_header "Recent Activity"
    
    # Show recent logs from workers
    echo "Recent automation worker activity:"
    docker-compose -f docker-compose.kafka.yml logs --tail=5 automation-worker-1 automation-worker-2 automation-worker-3 2>/dev/null | grep -E "(Processing task|Task.*completed|Task.*failed)" | tail -10 || echo "No recent activity"
    
    echo ""
    print_header "Quick Access URLs"
    
    echo "• Kafka UI (Monitoring):     http://localhost:8080"
    echo "• Load Balancer (Nginx):     http://localhost"
    echo "• Backend API:               http://localhost/api"
    echo "• Worker Health Checks:      http://localhost/worker-{1,2,3}/health"
    echo "• Worker Status:             http://localhost/worker-{1,2,3}/status"
    echo "• Worker Metrics:            http://localhost/worker-{1,2,3}/metrics"
    echo ""
}

# Continuous monitoring mode
continuous_monitor() {
    while true; do
        clear
        monitor_services
        echo ""
        print_status "Refreshing in 30 seconds... (Press Ctrl+C to exit)"
        sleep 30
    done
}

# Performance test function
run_performance_test() {
    print_header "Running Performance Test"
    
    # Send test tasks to Kafka
    print_status "Sending test automation tasks..."
    
    for i in {1..5}; do
        task_data="{\"task_id\":\"test-$i\",\"task_type\":\"web_automation\",\"url\":\"https://httpbin.org/status/200\",\"actions\":[{\"type\":\"wait\",\"value\":\"2\"}]}"
        
        curl -s -X POST "http://localhost/api/trigger-automation" \
             -H "Content-Type: application/json" \
             -d "$task_data" > /dev/null
        
        echo "Sent test task $i"
        sleep 1
    done
    
    print_success "Test tasks sent. Check Kafka UI for processing status."
}

# Show usage information
show_usage() {
    echo "Kafka-based Automation Services Monitor"
    echo ""
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  (no args)    Run single monitoring check"
    echo "  -c, --continuous    Run continuous monitoring (updates every 30s)"
    echo "  -t, --test          Run performance test"
    echo "  -h, --help          Show this help message"
    echo ""
}

# Main script logic
case "${1:-}" in
    -c|--continuous)
        continuous_monitor
        ;;
    -t|--test)
        run_performance_test
        ;;
    -h|--help)
        show_usage
        ;;
    "")
        monitor_services
        ;;
    *)
        echo "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac
