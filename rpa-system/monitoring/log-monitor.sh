#!/bin/bash

# EasyFlow Log Monitoring Script
# Monitors application logs for errors, performance issues, and security events
# 
# Usage:
#   ./monitoring/log-monitor.sh --service backend --level error
#   ./monitoring/log-monitor.sh --service all --follow
#   ./monitoring/log-monitor.sh --service backend --grep "Failed to"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default values
SERVICE="all"
LOG_LEVEL="all"
FOLLOW=false
GREP_PATTERN=""
TAIL_LINES=50
OUTPUT_FORMAT="colored"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
PROJECT_NAME="easyflow-staging"

# Function to print colored output
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_header() { echo -e "${PURPLE}📊 $1${NC}"; }

# Function to print usage
usage() {
    echo "EasyFlow Log Monitoring Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --service <name>      Service to monitor: backend, automation, email_worker, all (default: all)"
    echo "  --level <level>       Log level: error, warn, info, debug, all (default: all)"
    echo "  --follow              Follow log output (like tail -f)"
    echo "  --grep <pattern>      Grep for specific pattern in logs"
    echo "  --tail <lines>        Number of lines to tail (default: 50)"
    echo "  --format <format>     Output format: colored, json, plain (default: colored)"
    echo "  --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Show last 50 lines from all services"
    echo "  $0 --service backend --follow         # Follow backend logs"
    echo "  $0 --level error --grep \"timeout\"     # Show errors containing 'timeout'"
    echo "  $0 --service automation --tail 100   # Show last 100 lines from automation"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --service)
            SERVICE="$2"
            shift 2
            ;;
        --level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        --follow)
            FOLLOW=true
            shift
            ;;
        --grep)
            GREP_PATTERN="$2"
            shift 2
            ;;
        --tail)
            TAIL_LINES="$2"
            shift 2
            ;;
        --format)
            OUTPUT_FORMAT="$2"
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

# Validate service name
if [[ ! "$SERVICE" =~ ^(backend|automation|email_worker|all)$ ]]; then
    print_error "Invalid service: $SERVICE. Must be backend, automation, email_worker, or all"
    exit 1
fi

# Validate log level
if [[ ! "$LOG_LEVEL" =~ ^(error|warn|info|debug|all)$ ]]; then
    print_error "Invalid log level: $LOG_LEVEL. Must be error, warn, info, debug, or all"
    exit 1
fi

# Validate output format
if [[ ! "$OUTPUT_FORMAT" =~ ^(colored|json|plain)$ ]]; then
    print_error "Invalid output format: $OUTPUT_FORMAT. Must be colored, json, or plain"
    exit 1
fi

print_header "EasyFlow Log Monitor"
echo "==================="
print_info "Service: $SERVICE"
print_info "Log Level: $LOG_LEVEL"
print_info "Follow: $([ "$FOLLOW" == true ] && echo "Yes" || echo "No")"
[[ -n "$GREP_PATTERN" ]] && print_info "Grep Pattern: $GREP_PATTERN"
print_info "Tail Lines: $TAIL_LINES"
print_info "Output Format: $OUTPUT_FORMAT"
echo ""

# Function to check if staging environment is running
check_staging_environment() {
    if ! docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" ps | grep -q "Up"; then
        print_error "Staging environment is not running"
        print_info "Start it with: ./deploy-staging.sh"
        exit 1
    fi
}

# Function to colorize log output
colorize_log() {
    if [[ "$OUTPUT_FORMAT" == "colored" ]]; then
        sed -E \
            -e "s/ERROR|FATAL/$(printf "${RED}")&$(printf "${NC}")/gi" \
            -e "s/WARN|WARNING/$(printf "${YELLOW}")&$(printf "${NC}")/gi" \
            -e "s/INFO/$(printf "${GREEN}")&$(printf "${NC}")/gi" \
            -e "s/DEBUG/$(printf "${BLUE}")&$(printf "${NC}")/gi" \
            -e "s/([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})/$(printf "${PURPLE}")\\1$(printf "${NC}")/g"
    else
        cat
    fi
}

# Function to filter by log level
filter_log_level() {
    if [[ "$LOG_LEVEL" == "all" ]]; then
        cat
    else
        case "$LOG_LEVEL" in
            error)
                grep -i "error\\|fatal"
                ;;
            warn)
                grep -i "warn\\|warning"
                ;;
            info)
                grep -i "info"
                ;;
            debug)
                grep -i "debug"
                ;;
        esac
    fi
}

# Function to apply grep pattern
apply_grep_pattern() {
    if [[ -n "$GREP_PATTERN" ]]; then
        grep -i "$GREP_PATTERN"
    else
        cat
    fi
}

# Function to format output
format_output() {
    case "$OUTPUT_FORMAT" in
        json)
            # Try to format as JSON if possible
            jq -R 'try fromjson catch .' 2>/dev/null || cat
            ;;
        plain)
            cat
            ;;
        colored)
            colorize_log
            ;;
    esac
}

# Function to get logs from a specific service
get_service_logs() {
    local service_name="$1"
    local follow_flag=""
    
    if [[ "$FOLLOW" == true ]]; then
        follow_flag="--follow"
    fi
    
    print_info "Getting logs from $service_name..."
    
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" logs \
        $follow_flag \
        --tail="$TAIL_LINES" \
        --timestamps \
        "$service_name" 2>/dev/null | \
        filter_log_level | \
        apply_grep_pattern | \
        format_output
}

# Function to get logs from all services
get_all_service_logs() {
    local follow_flag=""
    
    if [[ "$FOLLOW" == true ]]; then
        follow_flag="--follow"
    fi
    
    print_info "Getting logs from all services..."
    
    docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" logs \
        $follow_flag \
        --tail="$TAIL_LINES" \
        --timestamps 2>/dev/null | \
        filter_log_level | \
        apply_grep_pattern | \
        format_output
}

# Function to analyze logs for common issues
analyze_logs() {
    print_header "Log Analysis Summary"
    echo "==================="
    
    # Get logs without following
    local temp_logs=$(mktemp)
    
    if [[ "$SERVICE" == "all" ]]; then
        docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" logs --tail=1000 > "$temp_logs" 2>/dev/null
    else
        docker-compose $COMPOSE_FILES -p "$PROJECT_NAME" logs --tail=1000 "$SERVICE" > "$temp_logs" 2>/dev/null
    fi
    
    # Count log levels
    local error_count=$(grep -ci "error\\|fatal" "$temp_logs" || echo "0")
    local warning_count=$(grep -ci "warn\\|warning" "$temp_logs" || echo "0")
    local info_count=$(grep -ci "info" "$temp_logs" || echo "0")
    
    echo "📊 Log Level Summary:"
    echo "  • Errors: $error_count"
    echo "  • Warnings: $warning_count"
    echo "  • Info: $info_count"
    echo ""
    
    # Common error patterns
    echo "🔍 Common Issues:"
    
    local timeout_count=$(grep -ci "timeout" "$temp_logs" || echo "0")
    local connection_count=$(grep -ci "connection.*failed\\|connection.*refused\\|connection.*timeout" "$temp_logs" || echo "0")
    local auth_count=$(grep -ci "authentication.*failed\\|authorization.*failed\\|unauthorized" "$temp_logs" || echo "0")
    local database_count=$(grep -ci "database.*error\\|sql.*error\\|query.*failed" "$temp_logs" || echo "0")
    
    if [[ $timeout_count -gt 0 ]]; then
        echo "  • Timeouts: $timeout_count occurrences"
    fi
    
    if [[ $connection_count -gt 0 ]]; then
        echo "  • Connection issues: $connection_count occurrences"
    fi
    
    if [[ $auth_count -gt 0 ]]; then
        echo "  • Authentication failures: $auth_count occurrences"
    fi
    
    if [[ $database_count -gt 0 ]]; then
        echo "  • Database errors: $database_count occurrences"
    fi
    
    if [[ $timeout_count -eq 0 && $connection_count -eq 0 && $auth_count -eq 0 && $database_count -eq 0 ]]; then
        echo "  • No common issues detected ✅"
    fi
    
    echo ""
    
    # Recent error examples
    if [[ $error_count -gt 0 ]]; then
        echo "🚨 Recent Errors (last 5):"
        grep -i "error\\|fatal" "$temp_logs" | tail -5 | while IFS= read -r line; do
            echo "  • $(echo "$line" | cut -c1-100)..."
        done
        echo ""
    fi
    
    # Performance indicators
    echo "⚡ Performance Indicators:"
    local slow_query_count=$(grep -ci "slow.*query\\|query.*took\\|execution.*time" "$temp_logs" || echo "0")
    local memory_count=$(grep -ci "memory\\|out of memory\\|oom" "$temp_logs" || echo "0")
    
    if [[ $slow_query_count -gt 0 ]]; then
        echo "  • Slow queries detected: $slow_query_count"
    fi
    
    if [[ $memory_count -gt 0 ]]; then
        echo "  • Memory issues: $memory_count"
    fi
    
    if [[ $slow_query_count -eq 0 && $memory_count -eq 0 ]]; then
        echo "  • No performance issues detected ✅"
    fi
    
    # Cleanup
    rm -f "$temp_logs"
}

# Function to show real-time log statistics
show_log_stats() {
    if [[ "$FOLLOW" == true ]]; then
        print_header "Real-time Log Statistics"
        echo "========================"
        print_info "Press Ctrl+C to stop monitoring"
        echo ""
        
        # Initialize counters
        local error_count=0
        local warning_count=0
        local info_count=0
        local total_count=0
        local start_time=$(date +%s)
        
        # Monitor logs in real-time
        get_service_logs "$SERVICE" | while IFS= read -r line; do
            ((total_count++))
            
            if echo "$line" | grep -qi "error\\|fatal"; then
                ((error_count++))
            elif echo "$line" | grep -qi "warn\\|warning"; then
                ((warning_count++))
            elif echo "$line" | grep -qi "info"; then
                ((info_count++))
            fi
            
            echo "$line"
            
            # Show statistics every 50 lines
            if (( total_count % 50 == 0 )); then
                local current_time=$(date +%s)
                local duration=$((current_time - start_time))
                local rate=$(( total_count / (duration > 0 ? duration : 1) ))
                
                echo ""
                echo "📊 Statistics (${duration}s): Total: $total_count, Rate: ${rate}/s, Errors: $error_count, Warnings: $warning_count, Info: $info_count"
                echo ""
            fi
        done
    fi
}

# Main execution
main() {
    check_staging_environment
    
    if [[ "$FOLLOW" == true ]]; then
        # Show real-time monitoring
        show_log_stats
    else
        # Show log analysis first
        if [[ -z "$GREP_PATTERN" && "$LOG_LEVEL" == "all" ]]; then
            analyze_logs
        fi
        
        # Then show the requested logs
        if [[ "$SERVICE" == "all" ]]; then
            get_all_service_logs
        else
            get_service_logs "$SERVICE"
        fi
    fi
}

# Cleanup function
cleanup() {
    print_info "Log monitoring stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM

# Run main function
main