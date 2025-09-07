#!/bin/bash

# EasyFlow Comprehensive Testing Suite
# Runs load tests, security tests, and generates unified reports
# 
# Usage:
#   ./run-all-tests.sh --env staging
#   ./run-all-tests.sh --env production --type basic
#   ./run-all-tests.sh --url http://custom-url:3030

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
TARGET_URL=""
TEST_TYPE="all"
RESULTS_DIR="tests/results"
SKIP_LOAD=false
SKIP_SECURITY=false
GENERATE_UNIFIED_REPORT=true

# Function to print colored output
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_header() { echo -e "${PURPLE}🚀 $1${NC}"; }

# Function to print usage
usage() {
    echo "EasyFlow Comprehensive Testing Suite"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --env <env>           Environment: staging or production (default: staging)"
    echo "  --url <url>           Custom target URL (overrides environment URLs)"
    echo "  --type <type>         Test type: basic, full, or all (default: all)"
    echo "  --skip-load           Skip load testing"
    echo "  --skip-security       Skip security testing"
    echo "  --no-unified-report   Skip unified report generation"
    echo "  --results <dir>       Results directory (default: tests/results)"
    echo "  --help                Show this help message"
    echo ""
    echo "Environments:"
    echo "  staging               Use staging environment (http://localhost:3030)"
    echo "  production            Use production environment (requires URL)"
    echo ""
    echo "Test Types:"
    echo "  basic                 Basic load and security tests (15 minutes)"
    echo "  full                  Comprehensive testing (45+ minutes)"
    echo "  all                   All available tests (30+ minutes)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests on staging"
    echo "  $0 --env staging --type basic         # Basic tests on staging"
    echo "  $0 --url http://prod:3030 --type full # Full tests on custom URL"
    echo "  $0 --skip-load                        # Security tests only"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --url)
            TARGET_URL="$2"
            shift 2
            ;;
        --type)
            TEST_TYPE="$2"
            shift 2
            ;;
        --skip-load)
            SKIP_LOAD=true
            shift
            ;;
        --skip-security)
            SKIP_SECURITY=true
            shift
            ;;
        --no-unified-report)
            GENERATE_UNIFIED_REPORT=false
            shift
            ;;
        --results)
            RESULTS_DIR="$2"
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

# Set target URL based on environment if not provided
if [[ -z "$TARGET_URL" ]]; then
    case "$ENVIRONMENT" in
        staging)
            TARGET_URL="http://localhost:3030"
            ;;
        production)
            print_error "Production environment requires explicit --url parameter"
            exit 1
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT. Must be staging or production"
            exit 1
            ;;
    esac
fi

# Validate test type
if [[ ! "$TEST_TYPE" =~ ^(basic|full|all)$ ]]; then
    print_error "Invalid test type: $TEST_TYPE. Must be basic, full, or all"
    exit 1
fi

# Validate that at least one test type is enabled
if [[ "$SKIP_LOAD" == true && "$SKIP_SECURITY" == true ]]; then
    print_error "Cannot skip both load and security tests"
    exit 1
fi

print_header "EasyFlow Comprehensive Testing Suite"
echo "============================================"
print_info "Environment: $ENVIRONMENT"
print_info "Target URL: $TARGET_URL"
print_info "Test Type: $TEST_TYPE"
print_info "Results Directory: $RESULTS_DIR"
print_info "Load Tests: $([ "$SKIP_LOAD" == true ] && echo "SKIPPED" || echo "ENABLED")"
print_info "Security Tests: $([ "$SKIP_SECURITY" == true ] && echo "SKIPPED" || echo "ENABLED")"
echo ""

# Create main results directory
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUITE_RESULTS_DIR="$RESULTS_DIR/comprehensive_test_$TIMESTAMP"
mkdir -p "$SUITE_RESULTS_DIR"

# Function to check if target is reachable
check_target() {
    print_info "Checking target availability: $TARGET_URL"
    
    if curl -f -s --max-time 10 "$TARGET_URL/health" > /dev/null 2>&1; then
        print_success "Target is reachable and healthy"
        return 0
    else
        print_warning "Health endpoint not available, trying root..."
        if curl -f -s --max-time 10 "$TARGET_URL" > /dev/null 2>&1; then
            print_success "Target is reachable"
            return 0
        else
            print_error "Target is not reachable: $TARGET_URL"
            return 1
        fi
    fi
}

# Function to run load tests
run_load_tests() {
    if [[ "$SKIP_LOAD" == true ]]; then
        print_info "Skipping load tests as requested"
        return 0
    fi
    
    print_header "Running Load Tests"
    echo "=================="
    
    local load_type
    case "$TEST_TYPE" in
        basic) load_type="basic" ;;
        full) load_type="all" ;;
        all) load_type="all" ;;
    esac
    
    # Create load test results directory
    local load_results_dir="$SUITE_RESULTS_DIR/load"
    mkdir -p "$load_results_dir"
    
    print_info "Starting load tests with type: $load_type"
    
    if [[ -x "./run-load-tests.sh" ]]; then
        # Use our new flexible load test script
        if ./run-load-tests.sh --url "$TARGET_URL" --type "$load_type" --results "$load_results_dir"; then
            print_success "Load tests completed successfully"
            return 0
        else
            print_error "Load tests failed"
            return 1
        fi
    else
        print_warning "Load test script not found or not executable, trying legacy approach..."
        
        # Fallback to existing Docker-based approach
        if [[ "$ENVIRONMENT" == "staging" ]] && [[ -f "docker-compose.staging.yml" ]]; then
            if ./run-load-tests.sh run; then
                print_success "Load tests completed successfully"
                return 0
            else
                print_error "Load tests failed"
                return 1
            fi
        else
            print_error "Load testing not available for this configuration"
            return 1
        fi
    fi
}

# Function to run security tests  
run_security_tests() {
    if [[ "$SKIP_SECURITY" == true ]]; then
        print_info "Skipping security tests as requested"
        return 0
    fi
    
    print_header "Running Security Tests"
    echo "======================"
    
    local security_type
    case "$TEST_TYPE" in
        basic) security_type="basic" ;;
        full) security_type="full" ;;  
        all) security_type="full" ;;
    esac
    
    # Create security test results directory
    local security_results_dir="$SUITE_RESULTS_DIR/security"
    mkdir -p "$security_results_dir"
    
    print_info "Starting security tests with type: $security_type"
    
    if [[ -x "./run-security-tests.sh" ]]; then
        # Use our new flexible security test script
        if ./run-security-tests.sh --url "$TARGET_URL" --type "$security_type" --results "$security_results_dir"; then
            print_success "Security tests completed successfully"
            return 0
        else
            print_error "Security tests failed"
            return 1
        fi
    else
        print_warning "Security test script not found or not executable, trying legacy approach..."
        
        # Fallback to existing Docker-based approach  
        if [[ "$ENVIRONMENT" == "staging" ]] && [[ -f "docker-compose.staging.yml" ]]; then
            if ./run-security-tests.sh run; then
                print_success "Security tests completed successfully"
                return 0
            else
                print_error "Security tests failed"
                return 1
            fi
        else
            print_error "Security testing not available for this configuration"
            return 1
        fi
    fi
}

# Function to collect system information
collect_system_info() {
    print_info "Collecting system information..."
    
    local system_info_file="$SUITE_RESULTS_DIR/system_info.txt"
    
    {
        echo "EasyFlow Test Environment Information"
        echo "===================================="
        echo "Timestamp: $(date)"
        echo "Test Suite Version: 1.0"
        echo "Environment: $ENVIRONMENT"
        echo "Target URL: $TARGET_URL"
        echo "Test Type: $TEST_TYPE"
        echo ""
        
        echo "System Information:"
        echo "------------------"
        echo "OS: $(uname -a)"
        echo "CPU: $(nproc 2>/dev/null || echo "Unknown") cores"
        echo "Memory: $(free -h 2>/dev/null | grep Mem | awk '{print $2}' || echo "Unknown")"
        echo "Docker Version: $(docker --version 2>/dev/null || echo "Not available")"
        echo "Docker Compose Version: $(docker-compose --version 2>/dev/null || echo "Not available")"
        echo ""
        
        echo "Network Information:"
        echo "-------------------"
        echo "Target Reachability: $(curl -f -s --max-time 5 "$TARGET_URL/health" >/dev/null 2>&1 && echo "✅ Reachable" || echo "❌ Not reachable")"
        echo "Response Time: $(curl -o /dev/null -s -w "%{time_total}" --max-time 10 "$TARGET_URL/health" 2>/dev/null || echo "N/A")s"
        echo ""
        
        echo "Test Configuration:"
        echo "------------------"
        echo "Load Tests: $([ "$SKIP_LOAD" == true ] && echo "Disabled" || echo "Enabled")"
        echo "Security Tests: $([ "$SKIP_SECURITY" == true ] && echo "Disabled" || echo "Enabled")"
        echo "Results Directory: $SUITE_RESULTS_DIR"
        
    } > "$system_info_file"
    
    print_success "System information collected: $system_info_file"
}

# Function to generate unified test report
generate_unified_report() {
    if [[ "$GENERATE_UNIFIED_REPORT" != true ]]; then
        print_info "Skipping unified report generation as requested"
        return 0
    fi
    
    print_header "Generating Unified Test Report"
    echo "=============================="
    
    local report_file="$SUITE_RESULTS_DIR/comprehensive_test_report.md"
    local html_report_file="$SUITE_RESULTS_DIR/comprehensive_test_report.html"
    
    # Generate Markdown report
    {
        echo "# EasyFlow Comprehensive Test Report"
        echo ""
        echo "**Generated:** $(date)"  
        echo "**Environment:** $ENVIRONMENT"
        echo "**Target URL:** $TARGET_URL"
        echo "**Test Type:** $TEST_TYPE"
        echo "**Suite ID:** comprehensive_test_$TIMESTAMP"
        echo ""
        
        echo "## Executive Summary"
        echo ""
        
        local load_status="❌ Skipped"
        local security_status="❌ Skipped"
        
        if [[ "$SKIP_LOAD" != true && -d "$SUITE_RESULTS_DIR/load" ]]; then
            load_status="$(find "$SUITE_RESULTS_DIR/load" -name "*.json" -o -name "*.html" | wc -l | awk '{if($1>0) print "✅ Completed"; else print "❌ Failed"}')"
        fi
        
        if [[ "$SKIP_SECURITY" != true && -d "$SUITE_RESULTS_DIR/security" ]]; then
            security_status="$(find "$SUITE_RESULTS_DIR/security" -name "*.txt" -o -name "*.json" -o -name "*.html" | wc -l | awk '{if($1>0) print "✅ Completed"; else print "❌ Failed"}')"
        fi
        
        echo "| Test Category | Status | Duration |"
        echo "|---------------|--------|----------|"
        echo "| Load Testing | $load_status | Variable |"
        echo "| Security Testing | $security_status | Variable |"
        echo ""
        
        echo "## Test Results"
        echo ""
        
        # Load Test Results Section
        if [[ "$SKIP_LOAD" != true ]]; then
            echo "### 🚀 Load Testing Results"
            echo ""
            
            if [[ -d "$SUITE_RESULTS_DIR/load" ]]; then
                echo "**Results Location:** \`$SUITE_RESULTS_DIR/load/\`"
                echo ""
                
                # List load test files
                find "$SUITE_RESULTS_DIR/load" -type f \( -name "*.json" -o -name "*.html" -o -name "*.txt" \) | while read -r file; do
                    echo "- [$(basename "$file")](./${file#$SUITE_RESULTS_DIR/})"
                done
                echo ""
                
                # Try to extract key metrics if available
                if find "$SUITE_RESULTS_DIR/load" -name "*.json" | head -1 | xargs test -f; then
                    echo "**Key Metrics:** *(extracted from JSON results)*"
                    echo "- See detailed reports for comprehensive metrics"
                    echo ""
                fi
            else
                echo "❌ Load testing results not available"
                echo ""
            fi
        fi
        
        # Security Test Results Section
        if [[ "$SKIP_SECURITY" != true ]]; then
            echo "### 🔒 Security Testing Results"
            echo ""
            
            if [[ -d "$SUITE_RESULTS_DIR/security" ]]; then
                echo "**Results Location:** \`$SUITE_RESULTS_DIR/security/\`"
                echo ""
                
                # List security test files
                find "$SUITE_RESULTS_DIR/security" -type f \( -name "*.txt" -o -name "*.json" -o -name "*.html" \) | while read -r file; do
                    echo "- [$(basename "$file")](./${file#$SUITE_RESULTS_DIR/})"
                done
                echo ""
                
                # Count security issues if available
                local issue_count=0
                if [[ -f "$SUITE_RESULTS_DIR/security/basic-security-results.txt" ]]; then
                    issue_count=$(grep -c "❌\|⚠️" "$SUITE_RESULTS_DIR/security/basic-security-results.txt" 2>/dev/null || echo "0")
                    echo "**Security Issues Found:** $issue_count"
                    echo ""
                fi
            else
                echo "❌ Security testing results not available"  
                echo ""
            fi
        fi
        
        echo "## System Information"
        echo ""
        echo "**Test Environment:**"
        if [[ -f "$SUITE_RESULTS_DIR/system_info.txt" ]]; then
            sed 's/^/    /' "$SUITE_RESULTS_DIR/system_info.txt"
        else
            echo "    System information not available"
        fi
        echo ""
        
        echo "## Recommendations"
        echo ""
        echo "### Immediate Actions"
        if [[ "$SKIP_LOAD" != true ]]; then
            echo "- Review load test results for performance bottlenecks"
            echo "- Ensure response times meet SLA requirements"
        fi
        if [[ "$SKIP_SECURITY" != true ]]; then
            echo "- Address any high-priority security vulnerabilities"
            echo "- Implement missing security headers and protections"
        fi
        echo ""
        
        echo "### Long-term Improvements"
        echo "- Integrate automated testing into CI/CD pipeline"
        echo "- Set up continuous monitoring and alerting"
        echo "- Regular security audits and penetration testing"
        echo "- Performance optimization based on load test findings"
        echo ""
        
        echo "## Next Steps"
        echo ""
        echo "1. **Review Individual Reports:** Examine detailed results in each category"
        echo "2. **Prioritize Issues:** Focus on high-impact performance and security issues"
        echo "3. **Implement Fixes:** Address identified problems systematically"
        echo "4. **Retest:** Run tests again after implementing fixes"
        echo "5. **Automate:** Integrate testing into regular development workflow"
        echo ""
        
        echo "---"
        echo "*Report generated by EasyFlow Comprehensive Testing Suite*"
        
    } > "$report_file"
    
    # Generate HTML report (simplified version)
    {
        echo "<!DOCTYPE html>"
        echo "<html><head><title>EasyFlow Test Report</title>"
        echo "<style>"
        echo "body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }"
        echo "h1 { color: #333; border-bottom: 2px solid #007bff; }"
        echo "h2 { color: #007bff; margin-top: 30px; }"
        echo "table { border-collapse: collapse; width: 100%; }"
        echo "th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }"
        echo "th { background-color: #f8f9fa; }"
        echo "code { background: #f8f9fa; padding: 2px 4px; border-radius: 3px; }"
        echo ".success { color: #28a745; } .error { color: #dc3545; } .warning { color: #ffc107; }"
        echo "</style>"
        echo "</head><body>"
        
        # Convert markdown to basic HTML
        markdown_to_html < "$report_file" || {
            echo "<h1>EasyFlow Comprehensive Test Report</h1>"
            echo "<p>Generated: $(date)</p>"
            echo "<pre>"
            cat "$report_file"
            echo "</pre>"
        }
        
        echo "</body></html>"
        
    } > "$html_report_file"
    
    print_success "Unified report generated:"
    print_info "  📄 Markdown: $report_file"
    print_info "  🌐 HTML: $html_report_file"
}

# Simple markdown to HTML converter function
markdown_to_html() {
    sed -e 's/^# \(.*\)/<h1>\1<\/h1>/' \
        -e 's/^## \(.*\)/<h2>\1<\/h2>/' \
        -e 's/^### \(.*\)/<h3>\1<\/h3>/' \
        -e 's/^\*\*\([^*]*\)\*\*/<strong>\1<\/strong>/g' \
        -e 's/^\* \(.*\)/<li>\1<\/li>/' \
        -e 's/^$/\<br\>/'
}

# Function to display final summary
show_final_summary() {
    print_header "Test Suite Completed!"
    echo "====================="
    echo ""
    
    # Calculate overall status
    local overall_status="✅ SUCCESS"
    local exit_code=0
    
    if [[ "$SKIP_LOAD" != true && ! -d "$SUITE_RESULTS_DIR/load" ]]; then
        overall_status="❌ FAILED"
        exit_code=1
    fi
    
    if [[ "$SKIP_SECURITY" != true && ! -d "$SUITE_RESULTS_DIR/security" ]]; then
        overall_status="❌ FAILED"  
        exit_code=1
    fi
    
    print_info "Overall Status: $overall_status"
    print_info "Test Duration: Complete"
    print_info "Environment: $ENVIRONMENT"
    print_info "Target: $TARGET_URL"
    echo ""
    
    print_info "📁 All Results Location: $SUITE_RESULTS_DIR"
    echo ""
    
    if [[ "$GENERATE_UNIFIED_REPORT" == true ]]; then
        print_info "📊 Unified Reports:"
        print_info "  • Markdown: $SUITE_RESULTS_DIR/comprehensive_test_report.md"
        print_info "  • HTML: $SUITE_RESULTS_DIR/comprehensive_test_report.html"
        echo ""
    fi
    
    print_info "🔍 Individual Test Results:"
    [[ "$SKIP_LOAD" != true ]] && print_info "  • Load Testing: $SUITE_RESULTS_DIR/load/"
    [[ "$SKIP_SECURITY" != true ]] && print_info "  • Security Testing: $SUITE_RESULTS_DIR/security/"
    print_info "  • System Info: $SUITE_RESULTS_DIR/system_info.txt"
    echo ""
    
    if [[ $exit_code -eq 0 ]]; then
        print_success "All tests completed successfully! 🎉"
    else
        print_warning "Some tests failed. Review the results for details."
    fi
    
    # Try to open the HTML report
    if [[ "$GENERATE_UNIFIED_REPORT" == true && -f "$SUITE_RESULTS_DIR/comprehensive_test_report.html" ]]; then
        if command -v open &> /dev/null; then
            print_info "Opening unified report in browser..."
            open "$SUITE_RESULTS_DIR/comprehensive_test_report.html"
        elif command -v xdg-open &> /dev/null; then
            print_info "Opening unified report in browser..."
            xdg-open "$SUITE_RESULTS_DIR/comprehensive_test_report.html"
        fi
    fi
    
    return $exit_code
}

# Main execution
main() {
    local exit_code=0
    local start_time=$(date +%s)
    
    print_header "Starting Comprehensive Test Suite"
    echo "Test Suite ID: comprehensive_test_$TIMESTAMP"
    echo "Start Time: $(date)"
    echo ""
    
    # Check target availability
    if ! check_target; then
        print_error "Cannot proceed with unreachable target"
        exit 1
    fi
    
    # Collect system information
    collect_system_info
    echo ""
    
    # Run load tests
    if ! run_load_tests; then
        exit_code=1
    fi
    echo ""
    
    # Run security tests  
    if ! run_security_tests; then
        exit_code=1
    fi
    echo ""
    
    # Generate unified report
    generate_unified_report
    echo ""
    
    # Calculate and display duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_formatted=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    
    echo "Total Test Duration: $duration_formatted"
    echo ""
    
    # Show final summary
    show_final_summary
    
    exit $exit_code
}

# Cleanup function
cleanup() {
    print_warning "Test suite interrupted"
    exit 1
}

# Set trap for cleanup
trap cleanup INT TERM

# Run main function
main