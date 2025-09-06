#!/bin/bash

# EasyFlow Health Check and Monitoring Script
# Comprehensive health monitoring for all EasyFlow services
# 
# Usage:
#   ./monitoring/health-check.sh --check all
#   ./monitoring/health-check.sh --check backend --alert
#   ./monitoring/health-check.sh --monitor --interval 30

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
CHECK_TYPE="all"
ENABLE_ALERTS=false
MONITOR_MODE=false
CHECK_INTERVAL=60
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
PROJECT_NAME="easyflow-staging"
ALERT_WEBHOOK=""
REPORT_FILE=""

# Function to print colored output
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_header() { echo -e "${PURPLE}🏥 $1${NC}"; }

# Function to print usage
usage() {
    echo "EasyFlow Health Check and Monitoring Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --check <type>        What to check: all, backend, automation, database, redis (default: all)"
    echo "  --monitor             Enable continuous monitoring mode"
    echo "  --interval <seconds>  Check interval for monitoring mode (default: 60)"
    echo "  --alert               Enable alerting (requires webhook configuration)"
    echo "  --webhook <url>       Webhook URL for alerts"
    echo "  --report <file>       Save health report to file"
    echo "  --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Basic health check"
    echo "  $0 --check backend --alert            # Check backend with alerts"
    echo "  $0 --monitor --interval 30            # Monitor every 30 seconds"
    echo "  $0 --report health-report.json        # Save report to file"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --check)
            CHECK_TYPE="$2"
            shift 2
            ;;
        --monitor)
            MONITOR_MODE=true
            shift
            ;;
        --interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        --alert)
            ENABLE_ALERTS=true
            shift
            ;;
        --webhook)
            ALERT_WEBHOOK="$2"
            shift 2
            ;;
        --report)
            REPORT_FILE="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate check type
if [[ ! "$CHECK_TYPE" =~ ^(all|backend|automation|database|redis)$ ]]; then
    print_error "Invalid check type: $CHECK_TYPE"
    exit 1
fi

# Initialize results array
declare -A health_results

# Function to send alert
send_alert() {
    local service="$1"
    local status="$2"
    local message="$3"
    
    if [[ "$ENABLE_ALERTS" == true && -n "$ALERT_WEBHOOK" ]]; then
        local payload=$(cat <<EOF
{
    "service": "$service",
    "status": "$status",
    "message": "$message",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "staging"
}
EOF
)
        
        curl -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "$payload" \
            --max-time 10 \
            --silent \
            --show-error || print_warning "Failed to send alert for $service"
    fi
}

# Function to check if containers are running
check_container_health() {
    local service="$1"
    local container_name="easyflow-${service}"
    
    print_info "Checking $service container health..."
    
    # Check if container exists and is running
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        health_results["${service}_container"]="healthy"
        print_success "$service container is running"
        
        # Check container health if health check is configured
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")
        
        if [[ "$health_status" == "healthy" ]]; then
            health_results["${service}_health_check"]="healthy"
            print_success "$service health check passed"
        elif [[ "$health_status" == "unhealthy" ]]; then
            health_results["${service}_health_check"]="unhealthy"
            print_error "$service health check failed"
            send_alert "$service" "unhealthy" "Container health check failed"
        else
            health_results["${service}_health_check"]="no_healthcheck"
            print_warning "$service has no health check configured"
        fi
        
        return 0
    else
        health_results["${service}_container"]="down"
        print_error "$service container is not running"
        send_alert "$service" "down" "Container is not running"
        return 1
    fi
}

# Function to check HTTP endpoint health
check_http_endpoint() {
    local service="$1"
    local url="$2"
    local expected_status="$3"
    
    print_info "Checking $service HTTP endpoint..."
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$url" || echo "0")
    
    if [[ "$response_code" == "$expected_status" ]]; then
        health_results["${service}_http"]="healthy"
        health_results["${service}_response_time"]="$response_time"
        print_success "$service HTTP endpoint is healthy (${response_code}, ${response_time}s)"
        
        # Alert if response time is too high
        if (( $(echo "$response_time > 2.0" | bc -l) )); then
            print_warning "$service response time is high: ${response_time}s"
            send_alert "$service" "slow" "Response time is high: ${response_time}s"
        fi
        
        return 0
    else
        health_results["${service}_http"]="unhealthy"
        health_results["${service}_response_code"]="$response_code"
        print_error "$service HTTP endpoint is unhealthy (${response_code})"
        send_alert "$service" "http_error" "HTTP endpoint returned $response_code"
        return 1
    fi
}

# Function to check backend service
check_backend() {
    print_header "Backend Service Health Check"
    
    local backend_healthy=true
    
    # Check container
    check_container_health "backend" || backend_healthy=false
    
    # Check HTTP endpoints
    check_http_endpoint "backend-health" "http://localhost:3030/health" "200" || backend_healthy=false
    check_http_endpoint "backend-metrics" "http://localhost:3030/metrics" "200" || backend_healthy=false
    
    # Check database connectivity (if endpoint exists)
    if curl -s --max-time 5 "http://localhost:3030/api/health/db" >/dev/null 2>&1; then
        check_http_endpoint "backend-database" "http://localhost:3030/api/health/db" "200" || backend_healthy=false
    fi
    
    if [[ "$backend_healthy" == true ]]; then
        health_results["backend_overall"]="healthy"
        print_success "Backend service is healthy"
    else
        health_results["backend_overall"]="unhealthy"
        print_error "Backend service has issues"
    fi
    
    echo ""
}

# Function to check automation service
check_automation() {
    print_header "Automation Service Health Check"
    
    local automation_healthy=true
    
    # Check container
    check_container_health "automation" || automation_healthy=false
    
    # Check HTTP endpoint if available
    if curl -s --max-time 5 "http://localhost:7001/health" >/dev/null 2>&1; then
        check_http_endpoint "automation-health" "http://localhost:7001/health" "200" || automation_healthy=false
    else
        print_info "Automation service health endpoint not available"
    fi
    
    if [[ "$automation_healthy" == true ]]; then
        health_results["automation_overall"]="healthy"
        print_success "Automation service is healthy"
    else
        health_results["automation_overall"]="unhealthy"
        print_error "Automation service has issues"
    fi
    
    echo ""
}

# Function to check Redis
check_redis() {
    print_header "Redis Health Check"
    
    local redis_healthy=true
    
    # Check container
    check_container_health "redis" || redis_healthy=false
    
    # Check Redis connectivity
    if docker exec easyflow-redis redis-cli ping >/dev/null 2>&1; then
        health_results["redis_connectivity"]="healthy"
        print_success "Redis is responding to ping"
        
        # Check Redis info
        local memory_used=$(docker exec easyflow-redis redis-cli info memory | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r')
        local connected_clients=$(docker exec easyflow-redis redis-cli info clients | grep "connected_clients:" | cut -d: -f2 | tr -d '\r')
        
        health_results["redis_memory"]="$memory_used"
        health_results["redis_clients"]="$connected_clients"
        
        print_info "Redis memory usage: $memory_used"
        print_info "Redis connected clients: $connected_clients"
    else
        health_results["redis_connectivity"]="unhealthy"
        print_error "Redis is not responding"
        send_alert "redis" "connectivity" "Redis is not responding to ping"
        redis_healthy=false
    fi
    
    if [[ "$redis_healthy" == true ]]; then
        health_results["redis_overall"]="healthy"
        print_success "Redis is healthy"
    else
        health_results["redis_overall"]="unhealthy"
        print_error "Redis has issues"
    fi
    
    echo ""
}

# Function to check database
check_database() {
    print_header "Database Health Check"
    
    # For this staging environment, we're using Supabase
    # We can check database connectivity through the backend
    
    if curl -s --max-time 10 "http://localhost:3030/health" | grep -q "ok"; then
        health_results["database_connectivity"]="healthy"
        print_success "Database connectivity (via backend) is healthy"
    else
        health_results["database_connectivity"]="unhealthy"
        print_error "Database connectivity issues detected"
        send_alert "database" "connectivity" "Database connectivity issues"
    fi
    
    echo ""
}

# Function to check system resources
check_system_resources() {
    print_header "System Resources Check"
    
    # Check available disk space
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    health_results["system_disk_usage"]="$disk_usage"
    
    if [[ "$disk_usage" -lt 90 ]]; then
        print_success "Disk usage is acceptable: ${disk_usage}%"
    else
        print_warning "Disk usage is high: ${disk_usage}%"
        send_alert "system" "disk_full" "Disk usage is at ${disk_usage}%"
    fi
    
    # Check available memory
    if command -v free >/dev/null 2>&1; then
        local memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
        health_results["system_memory_usage"]="$memory_usage"
        
        if [[ "$memory_usage" -lt 90 ]]; then
            print_success "Memory usage is acceptable: ${memory_usage}%"
        else
            print_warning "Memory usage is high: ${memory_usage}%"
            send_alert "system" "memory_high" "Memory usage is at ${memory_usage}%"
        fi
    fi
    
    # Check Docker daemon
    if docker info >/dev/null 2>&1; then
        health_results["docker_daemon"]="healthy"
        print_success "Docker daemon is running"
    else
        health_results["docker_daemon"]="unhealthy"
        print_error "Docker daemon is not available"
        send_alert "docker" "daemon_down" "Docker daemon is not available"
    fi
    
    echo ""
}

# Function to generate health report
generate_health_report() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local overall_health="healthy"
    
    # Check if any service is unhealthy
    for key in "${!health_results[@]}"; do
        if [[ "${health_results[$key]}" == "unhealthy" || "${health_results[$key]}" == "down" ]]; then
            overall_health="unhealthy"
            break
        fi
    done
    
    local report=$(cat <<EOF
{
    "timestamp": "$timestamp",
    "overall_health": "$overall_health",
    "environment": "staging",
    "checks_performed": "$CHECK_TYPE",
    "results": {
EOF

    # Add health results to JSON
    local first=true
    for key in "${!health_results[@]}"; do
        if [[ "$first" == false ]]; then
            report+=","
        fi
        report+="\n        \"$key\": \"${health_results[$key]}\""
        first=false
    done
    
    report+="\n    }"
    report+="\n}"
    
    if [[ -n "$REPORT_FILE" ]]; then
        echo -e "$report" > "$REPORT_FILE"
        print_success "Health report saved to $REPORT_FILE"
    fi
    
    echo -e "$report"
}

# Function to display health summary
display_health_summary() {
    print_header "Health Check Summary"
    echo "==================="
    
    local healthy_count=0
    local unhealthy_count=0
    local total_checks=0
    
    for key in "${!health_results[@]}"; do
        if [[ "$key" =~ _overall$ || "$key" =~ _connectivity$ || "$key" =~ _http$ ]]; then
            ((total_checks++))
            if [[ "${health_results[$key]}" == "healthy" ]]; then
                ((healthy_count++))
            else
                ((unhealthy_count++))
            fi
        fi
    done
    
    echo "📊 Health Statistics:"
    echo "  • Total Checks: $total_checks"
    echo "  • Healthy: $healthy_count"
    echo "  • Unhealthy: $unhealthy_count"
    
    if [[ "$unhealthy_count" -eq 0 ]]; then
        print_success "All services are healthy! 🎉"
    else
        print_warning "$unhealthy_count services need attention"
    fi
    
    echo ""
    
    # Display service status
    echo "🏥 Service Status:"
    for service in backend automation redis database; do
        local overall_key="${service}_overall"
        if [[ -n "${health_results[$overall_key]:-}" ]]; then
            local status="${health_results[$overall_key]}"
            if [[ "$status" == "healthy" ]]; then
                echo "  • $service: ✅ Healthy"
            else
                echo "  • $service: ❌ Unhealthy"
            fi
        fi
    done
    
    echo ""
    
    # Show recommendations
    if [[ "$unhealthy_count" -gt 0 ]]; then
        echo "💡 Recommendations:"
        echo "  • Check container logs for failing services"
        echo "  • Verify network connectivity"
        echo "  • Review system resource usage"
        echo "  • Consider restarting unhealthy services"
        echo ""
    fi
}

# Function to run monitoring mode
monitoring_mode() {
    print_header "EasyFlow Health Monitoring"
    print_info "Monitoring every $CHECK_INTERVAL seconds. Press Ctrl+C to stop."
    echo ""
    
    local check_count=0
    
    while true; do
        ((check_count++))
        
        echo "🔄 Health Check #$check_count at $(date)"
        echo "=================================="
        
        # Clear previous results
        health_results=()
        
        # Run health checks
        run_health_checks
        
        # Display summary
        display_health_summary
        
        echo "⏳ Next check in $CHECK_INTERVAL seconds..."
        echo ""
        
        sleep "$CHECK_INTERVAL"
    done
}

# Function to run health checks based on check type
run_health_checks() {
    case "$CHECK_TYPE" in
        all)
            check_backend
            check_automation
            check_redis
            check_database
            check_system_resources
            ;;
        backend)
            check_backend
            ;;
        automation)
            check_automation
            ;;
        redis)
            check_redis
            ;;
        database)
            check_database
            ;;
    esac
}

# Main execution function
main() {
    print_header "EasyFlow Health Monitor"
    print_info "Check Type: $CHECK_TYPE"
    print_info "Monitor Mode: $([ "$MONITOR_MODE" == true ] && echo "Enabled" || echo "Disabled")"
    print_info "Alerts: $([ "$ENABLE_ALERTS" == true ] && echo "Enabled" || echo "Disabled")"
    echo ""
    
    if [[ "$MONITOR_MODE" == true ]]; then
        monitoring_mode
    else
        run_health_checks
        display_health_summary
        generate_health_report
    fi
}

# Cleanup function
cleanup() {
    print_info "Health monitoring stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM

# Run main function
main