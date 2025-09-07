#!/bin/bash

# Load Testing Framework for EasyFlow API
# Tests API performance under various load conditions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3030}"
AUTOMATION_URL="${AUTOMATION_URL:-http://localhost:7001}"
RESULTS_DIR="load-test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Test configuration
LIGHT_LOAD_USERS=10
MEDIUM_LOAD_USERS=50
HEAVY_LOAD_USERS=100
TEST_DURATION=30s
RAMP_UP_TIME=10s

echo -e "${BLUE}=====================================
🔧 EasyFlow Load Testing Framework
=====================================${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}[INFO]${NC} Checking prerequisites..."
    
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}[WARN]${NC} jq not found, JSON parsing will be limited"
    fi
    
    if ! command -v ab &> /dev/null; then
        echo -e "${YELLOW}[WARN]${NC} Apache Bench (ab) not found, advanced load testing disabled"
        echo -e "${YELLOW}[INFO]${NC} Install with: brew install apache-bench (macOS) or apt-get install apache2-utils (Ubuntu)"
    fi
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    echo -e "${GREEN}[INFO]${NC} Created results directory: $RESULTS_DIR"
}

# Test API availability
test_api_availability() {
    echo -e "\n${BLUE}[INFO]${NC} Testing API availability..."
    
    # Test backend
    echo -e "${BLUE}[INFO]${NC} Testing backend at $BACKEND_URL"
    if curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}[PASS]${NC} Backend API is available"
    else
        echo -e "${RED}[FAIL]${NC} Backend API is not available at $BACKEND_URL"
        echo -e "${YELLOW}[INFO]${NC} Make sure backend is running with: cd rpa-system/backend && npm start"
        return 1
    fi
    
    # Test automation service
    echo -e "${BLUE}[INFO]${NC} Testing automation service at $AUTOMATION_URL"
    if curl -s -f "$AUTOMATION_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}[PASS]${NC} Automation service is available"
    else
        echo -e "${YELLOW}[WARN]${NC} Automation service is not available at $AUTOMATION_URL"
        echo -e "${YELLOW}[INFO]${NC} Some tests will be skipped"
    fi
}

# Basic load test using curl
basic_load_test() {
    local endpoint="$1"
    local requests="$2"
    local concurrent="$3"
    local test_name="$4"
    
    echo -e "\n${BLUE}[INFO]${NC} Running basic load test: $test_name"
    echo -e "${BLUE}[INFO]${NC} Endpoint: $endpoint"
    echo -e "${BLUE}[INFO]${NC} Requests: $requests, Concurrent: $concurrent"
    
    local start_time=$(date +%s)
    local success_count=0
    local error_count=0
    local total_time=0
    
    # Run requests in background
    for ((i=1; i<=requests; i++)); do
        {
            local req_start=$(date +%s.%N)
            if curl -s -f "$endpoint" > /dev/null 2>&1; then
                local req_end=$(date +%s.%N)
                local req_time=$(echo "$req_end - $req_start" | bc -l 2>/dev/null || echo "0")
                echo "SUCCESS:$req_time" >> "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.tmp"
            else
                echo "ERROR" >> "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.tmp"
            fi
        } &
        
        # Limit concurrent processes
        if ((i % concurrent == 0)); then
            wait
        fi
    done
    
    wait # Wait for all background processes
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    # Process results
    if [[ -f "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.tmp" ]]; then
        success_count=$(grep -c "SUCCESS" "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.tmp" 2>/dev/null || echo "0")
        error_count=$(grep -c "ERROR" "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.tmp" 2>/dev/null || echo "0")
        
        # Calculate average response time
        if command -v bc &> /dev/null; then
            local avg_time=$(grep "SUCCESS" "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.tmp" | cut -d: -f2 | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
        else
            avg_time="N/A"
        fi
        
        # Clean up temp file
        rm -f "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.tmp"
    fi
    
    # Report results
    echo -e "${GREEN}[RESULTS]${NC} $test_name Load Test Results:"
    echo -e "  Total Duration: ${total_duration}s"
    echo -e "  Successful Requests: $success_count"
    echo -e "  Failed Requests: $error_count"
    if [[ "$requests" -gt 0 ]]; then
        echo -e "  Success Rate: $(((success_count * 100) / requests))%"
    else
        echo -e "  Success Rate: N/A (no requests)"
    fi
    if [[ "$total_duration" -gt 0 ]]; then
        echo -e "  Requests/Second: $((requests / total_duration))"
    else
        echo -e "  Requests/Second: N/A (duration too short)"
    fi
    if [[ "$avg_time" != "N/A" ]]; then
        echo -e "  Average Response Time: ${avg_time}s"
    fi
    
    # Save detailed results
    cat > "$RESULTS_DIR/basic_load_${test_name}_${TIMESTAMP}.txt" << EOF
Basic Load Test Results: $test_name
Timestamp: $(date)
Endpoint: $endpoint
Requests: $requests
Concurrent: $concurrent
Total Duration: ${total_duration}s
Successful Requests: $success_count
Failed Requests: $error_count
Success Rate: $(((success_count * 100) / requests))%
Requests/Second: $(if [[ "$total_duration" -gt 0 ]]; then echo "$((requests / total_duration))"; else echo "N/A"; fi)
Average Response Time: $avg_time
EOF
}

# Apache Bench load test (if available)
apache_bench_test() {
    if ! command -v ab &> /dev/null; then
        echo -e "${YELLOW}[SKIP]${NC} Apache Bench not available, skipping advanced load tests"
        return
    fi
    
    local endpoint="$1"
    local requests="$2"
    local concurrent="$3"
    local test_name="$4"
    
    echo -e "\n${BLUE}[INFO]${NC} Running Apache Bench test: $test_name"
    echo -e "${BLUE}[INFO]${NC} Endpoint: $endpoint"
    echo -e "${BLUE}[INFO]${NC} Requests: $requests, Concurrent: $concurrent"
    
    local output_file="$RESULTS_DIR/ab_${test_name}_${TIMESTAMP}.txt"
    
    if ab -n "$requests" -c "$concurrent" -g "$RESULTS_DIR/ab_${test_name}_${TIMESTAMP}.gnuplot" "$endpoint" > "$output_file" 2>&1; then
        echo -e "${GREEN}[PASS]${NC} Apache Bench test completed"
        
        # Extract key metrics
        local rps=$(grep "Requests per second:" "$output_file" | awk '{print $4}')
        local mean_time=$(grep "Time per request:" "$output_file" | head -1 | awk '{print $4}')
        local failed=$(grep "Failed requests:" "$output_file" | awk '{print $3}')
        
        echo -e "${GREEN}[RESULTS]${NC} Apache Bench Results for $test_name:"
        echo -e "  Requests per second: $rps"
        echo -e "  Mean response time: ${mean_time}ms"
        echo -e "  Failed requests: $failed"
    else
        echo -e "${RED}[FAIL]${NC} Apache Bench test failed"
    fi
}

# Database load test
database_load_test() {
    echo -e "\n${BLUE}[INFO]${NC} Testing database performance under load..."
    
    # Test database health endpoint under load
    basic_load_test "$BACKEND_URL/api/health/databases" 50 10 "database_health"
    
    if command -v ab &> /dev/null; then
        apache_bench_test "$BACKEND_URL/api/health/databases" 100 20 "database_health"
    fi
}

# API endpoints load test
api_endpoints_load_test() {
    echo -e "\n${BLUE}[INFO]${NC} Testing API endpoints under load..."
    
    # Test health endpoint
    basic_load_test "$BACKEND_URL/health" 100 15 "health_endpoint"
    
    # Test user preferences endpoint (should return 401, but tests performance)
    basic_load_test "$BACKEND_URL/api/user/preferences" 50 10 "user_preferences"
    
    if command -v ab &> /dev/null; then
        apache_bench_test "$BACKEND_URL/health" 200 25 "health_endpoint"
    fi
}

# Stress test - gradually increase load
stress_test() {
    echo -e "\n${BLUE}[INFO]${NC} Running stress test with increasing load..."
    
    local loads=(10 25 50 75 100)
    local endpoint="$BACKEND_URL/health"
    
    for load in "${loads[@]}"; do
        echo -e "\n${BLUE}[INFO]${NC} Testing with $load concurrent requests..."
        basic_load_test "$endpoint" $((load * 2)) "$load" "stress_${load}"
        
        # Brief pause between tests
        sleep 2
    done
}

# Memory and performance monitoring
monitor_performance() {
    echo -e "\n${BLUE}[INFO]${NC} Monitoring system performance during tests..."
    
    # Check if system monitoring tools are available
    if command -v top &> /dev/null; then
        echo -e "${BLUE}[INFO]${NC} System load monitoring available"
        # Get current load
        local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        echo -e "${BLUE}[INFO]${NC} Current system load: $load"
    fi
    
    if command -v free &> /dev/null; then
        echo -e "${BLUE}[INFO]${NC} Memory usage monitoring available"
        local memory=$(free -h | awk '/^Mem:/ {print $3 "/" $2}')
        echo -e "${BLUE}[INFO]${NC} Memory usage: $memory"
    elif command -v vm_stat &> /dev/null; then
        echo -e "${BLUE}[INFO]${NC} macOS memory monitoring available"
        local memory_info=$(vm_stat | head -4)
        echo -e "${BLUE}[INFO]${NC} Memory info available"
    fi
}

# Generate performance report
generate_report() {
    echo -e "\n${BLUE}[INFO]${NC} Generating performance report..."
    
    local report_file="$RESULTS_DIR/load_test_report_${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# EasyFlow Load Test Report

**Test Date:** $(date)
**Backend URL:** $BACKEND_URL
**Automation URL:** $AUTOMATION_URL

## Test Summary

This report contains the results of load testing performed on the EasyFlow API system.

## Test Results

### Files Generated
EOF
    
    # List all result files
    for file in "$RESULTS_DIR"/*"$TIMESTAMP"*; do
        if [[ -f "$file" ]]; then
            echo "- $(basename "$file")" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## Recommendations

Based on the load test results:

1. **Performance Optimization**: Review any endpoints with high response times
2. **Scaling**: Consider horizontal scaling if error rates are high under load
3. **Database Optimization**: Monitor database performance under concurrent loads
4. **Caching**: Implement caching for frequently accessed endpoints
5. **Load Balancing**: Consider load balancing for production deployment

## Next Steps

1. Review individual test result files for detailed metrics
2. Compare results with performance requirements
3. Optimize identified bottlenecks
4. Re-run tests after optimizations
5. Set up monitoring in production environment

EOF
    
    echo -e "${GREEN}[SUCCESS]${NC} Report generated: $report_file"
}

# Main execution
main() {
    check_prerequisites
    
    if ! test_api_availability; then
        echo -e "${RED}[ERROR]${NC} API availability test failed. Please start the services and try again."
        exit 1
    fi
    
    monitor_performance
    database_load_test
    api_endpoints_load_test
    stress_test
    generate_report
    
    echo -e "\n${GREEN}=====================================
🎉 Load Testing Complete!
=====================================${NC}"
    echo -e "${GREEN}[SUCCESS]${NC} All load tests completed successfully"
    echo -e "${BLUE}[INFO]${NC} Results saved in: $RESULTS_DIR"
    echo -e "${BLUE}[INFO]${NC} Review the generated report for detailed analysis"
    
    # Final recommendations
    echo -e "\n${YELLOW}[RECOMMENDATIONS]${NC}"
    echo -e "1. Review response times and error rates"
    echo -e "2. Monitor system resources during peak loads"
    echo -e "3. Consider implementing rate limiting for production"
    echo -e "4. Set up application performance monitoring (APM)"
    echo -e "5. Plan capacity based on expected production load"
}

# Run main function
main "$@"
TARGET_URL="http://backend:3030"
RESULTS_DIR="tests/results/load"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}🧪 EasyFlow Load Testing Suite${NC}"
echo "================================"

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to run a specific load test
run_load_test() {
    local test_name="$1"
    local test_file="$2"
    local options="$3"
    
    echo -e "${YELLOW}🚀 Running $test_name...${NC}"
    
    # Run the test with results output
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" run --rm \
        -v "$(pwd)/$RESULTS_DIR:/results" \
        -e "TARGET_URL=$TARGET_URL" \
        --profile testing k6-load-tester run \
        --out json="/results/${test_name}_${TIMESTAMP}.json" \
        --out csv="/results/${test_name}_${TIMESTAMP}.csv" \
        $options \
        "/scripts/$test_file"
    
    echo -e "${GREEN}✅ $test_name completed${NC}"
}

# Function to generate load test report
generate_report() {
    echo -e "${BLUE}📊 Generating load test report...${NC}"
    
    local report_file="$RESULTS_DIR/load_test_report_${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# EasyFlow Load Test Report

**Test Date:** $(date)
**Target URL:** $TARGET_URL
**Test Duration:** Various (see individual tests)

## Test Summary

EOF

    # Add summary for each test if JSON files exist
    for json_file in "$RESULTS_DIR"/*_${TIMESTAMP}.json; do
        if [[ -f "$json_file" ]]; then
            test_name=$(basename "$json_file" "_${TIMESTAMP}.json")
            echo "### $test_name" >> "$report_file"
            echo "" >> "$report_file"
            
            # Extract key metrics if jq is available
            if command -v jq >/dev/null 2>&1; then
                echo "- **Total Requests:** $(jq '.metrics.http_reqs.count // "N/A"' "$json_file")" >> "$report_file"
                echo "- **Failed Requests:** $(jq '.metrics.http_req_failed.count // "N/A"' "$json_file")" >> "$report_file"
                echo "- **Average Response Time:** $(jq '.metrics.http_req_duration.avg // "N/A"' "$json_file")ms" >> "$report_file"
                echo "- **95th Percentile:** $(jq '.metrics.http_req_duration.p95 // "N/A"' "$json_file")ms" >> "$report_file"
                echo "" >> "$report_file"
            fi
        fi
    done
    
    echo -e "${GREEN}📋 Report generated: $report_file${NC}"
}

# Function to check if staging environment is running
check_staging_environment() {
    echo -e "${BLUE}🔍 Checking staging environment...${NC}"
    
    if ! docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" ps | grep -q "Up"; then
        echo -e "${RED}❌ Staging environment is not running${NC}"
        echo -e "${YELLOW}💡 Run './deploy-staging.sh' first${NC}"
        exit 1
    fi
    
    # Wait for services to be ready
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    sleep 10
    
    # Check backend health
    if ! docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" exec -T backend curl -f http://localhost:3030/health >/dev/null 2>&1; then
        echo -e "${RED}❌ Backend is not healthy${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Staging environment is ready${NC}"
}

# Function to display test summary
show_summary() {
    echo -e "\n${GREEN}🎉 Load Testing Completed!${NC}"
    echo "========================="
    echo
    echo -e "${BLUE}📊 Results Location:${NC}"
    echo "  • JSON Results: $RESULTS_DIR/*_${TIMESTAMP}.json"
    echo "  • CSV Results:  $RESULTS_DIR/*_${TIMESTAMP}.csv"
    echo "  • Report:       $RESULTS_DIR/load_test_report_${TIMESTAMP}.md"
    echo
    echo -e "${BLUE}📈 View Results:${NC}"
    echo "  • Grafana:      http://localhost:3001 (admin/staging_admin_2024)"
    echo "  • Prometheus:   http://localhost:9090"
    echo
    echo -e "${YELLOW}💡 Tips:${NC}"
    echo "  • Check Grafana dashboards for real-time metrics"
    echo "  • Review CSV files for detailed request data"
    echo "  • Use JSON files for automated analysis"
}

# Main execution flow
main() {
    echo -e "${BLUE}Starting load tests at $(date)${NC}\n"
    
    check_staging_environment
    
    # Run different types of load tests
    echo -e "${BLUE}🎯 Running load test scenarios...${NC}\n"
    
    # Basic load test (warm up)
    run_load_test "basic_load_test" "basic-load-test.js" "--vus 5 --duration 30s"
    
    # Stress test
    echo -e "${YELLOW}📈 Creating stress test...${NC}"
    cat > "tests/load/stress-test.js" << 'EOF'
import { basicLoadTest } from './basic-load-test.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default basicLoadTest;
EOF

    # Spike test  
    echo -e "${YELLOW}⚡ Creating spike test...${NC}"
    cat > "tests/load/spike-test.js" << 'EOF'
import { basicLoadTest } from './basic-load-test.js';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '10s', target: 100 },  // Spike
    { duration: '30s', target: 5 },
    { duration: '10s', target: 200 },  // Bigger spike
    { duration: '30s', target: 5 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default basicLoadTest;
EOF

    sleep 5
    
    # Run comprehensive tests
    run_load_test "stress_test" "stress-test.js" ""
    
    sleep 10
    
    run_load_test "spike_test" "spike-test.js" ""
    
    # Generate comprehensive report
    generate_report
    show_summary
    
    echo -e "\n${GREEN}✅ All load tests completed successfully at $(date)${NC}"
}

# Handle script interruption
cleanup() {
    echo -e "\n${RED}🛑 Load testing interrupted${NC}"
    exit 1
}

trap cleanup INT TERM

# Parse command line arguments  
case "${1:-run}" in
    "run")
        main
        ;;
    "basic")
        check_staging_environment
        run_load_test "basic_load_test" "basic-load-test.js" "--vus 10 --duration 60s"
        ;;
    "stress") 
        check_staging_environment
        run_load_test "stress_test" "stress-test.js" ""
        ;;
    "clean")
        echo -e "${YELLOW}🧹 Cleaning old test results...${NC}"
        rm -rf "$RESULTS_DIR"/*
        echo -e "${GREEN}✅ Results cleaned${NC}"
        ;;
    *)
        echo "Usage: $0 {run|basic|stress|clean}"
        echo "  run    - Run all load tests"
        echo "  basic  - Run basic load test only"
        echo "  stress - Run stress test only" 
        echo "  clean  - Clean old test results"
        exit 1
        ;;
esac