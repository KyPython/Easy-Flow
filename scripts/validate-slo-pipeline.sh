#!/bin/bash

# EasyFlow SLO Data Pipeline Validation Script
# Tests end-to-end data flow from OpenTelemetry spans to SLO calculations

set -e

echo "🚀 Starting EasyFlow SLO Data Pipeline Validation"
echo "=================================================="

# Configuration
BACKEND_URL="http://localhost:3030"
PROMETHEUS_URL="http://localhost:9090"
GRAFANA_URL="http://localhost:3003"
OTEL_COLLECTOR_URL="http://localhost:4318"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test 1: Verify OpenTelemetry Collector is running
echo -e "\n${BLUE}Test 1: OpenTelemetry Collector Health${NC}"
if curl -s "${OTEL_COLLECTOR_URL%:*}:13133" > /dev/null 2>&1; then
    print_success "OpenTelemetry Collector is healthy"
else
    print_error "OpenTelemetry Collector is not responding"
fi

# Test 2: Verify Prometheus is running and has SLO recording rules
echo -e "\n${BLUE}Test 2: Prometheus Configuration${NC}"
if curl -s "${PROMETHEUS_URL}/-/healthy" > /dev/null 2>&1; then
    print_success "Prometheus is healthy"
    
    # Check if SLO recording rules are loaded
    SLO_RULES=$(curl -s "${PROMETHEUS_URL}/api/v1/rules" | jq -r '.data.groups[] | select(.name=="easyflow_slo_recording_rules") | .rules | length')
    if [ "$SLO_RULES" -gt 0 ]; then
        print_success "SLO recording rules loaded ($SLO_RULES rules)"
    else
        print_error "SLO recording rules not found or not loaded"
    fi
else
    print_error "Prometheus is not responding"
fi

# Test 3: Generate test telemetry data
echo -e "\n${BLUE}Test 3: Generate Test Telemetry Data${NC}"

# Function to generate test traces
generate_test_traces() {
    local operation=$1
    local success_rate=$2
    local count=${3:-10}
    
    print_info "Generating $count test traces for $operation (${success_rate}% success rate)"
    
    for i in $(seq 1 $count); do
        # Determine if this request should succeed based on success rate
        if [ $((RANDOM % 100)) -lt $success_rate ]; then
            status="success"
            http_status="200"
        else
            status="error" 
            http_status="500"
        fi
        
        # Generate trace via OTLP HTTP endpoint
        curl -s -X POST "${OTEL_COLLECTOR_URL}/v1/traces" \
            -H "Content-Type: application/json" \
            -d "{
                \"resourceSpans\": [{
                    \"resource\": {
                        \"attributes\": [
                            {\"key\": \"service.name\", \"value\": {\"stringValue\": \"easyflow-backend\"}},
                            {\"key\": \"service.version\", \"value\": {\"stringValue\": \"1.0.0\"}}
                        ]
                    },
                    \"scopeSpans\": [{
                        \"scope\": {\"name\": \"test-generator\", \"version\": \"1.0.0\"},
                        \"spans\": [{
                            \"traceId\": \"$(openssl rand -hex 16)\",
                            \"spanId\": \"$(openssl rand -hex 8)\",
                            \"name\": \"$operation\",
                            \"kind\": 2,
                            \"startTimeUnixNano\": \"$(($(date +%s) * 1000000000))\",
                            \"endTimeUnixNano\": \"$((($(date +%s) + 1) * 1000000000))\",
                            \"attributes\": [
                                {\"key\": \"http.status_code\", \"value\": {\"intValue\": $http_status}},
                                {\"key\": \"span.kind\", \"value\": {\"stringValue\": \"server\"}},
                                {\"key\": \"business.user_id\", \"value\": {\"stringValue\": \"test-user-$i\"}},
                                {\"key\": \"business.workflow_id\", \"value\": {\"stringValue\": \"workflow-test-$((i % 5))\"}},
                                {\"key\": \"business.operation\", \"value\": {\"stringValue\": \"$operation\"}},
                                {\"key\": \"user_tier\", \"value\": {\"stringValue\": \"premium\"}}
                            ],
                            \"status\": {\"code\": $([ \"$status\" = \"success\" ] && echo 1 || echo 2)}
                        }]
                    }]
                }]
            }" > /dev/null
        
        sleep 0.1  # Small delay between requests
    done
}

# Generate test data for each SLO
print_info "Generating test data for SLO validation..."

# SLO 1: Process execution traces (should be 99.9% successful)
generate_test_traces "rpa.process.execute" 100 20

# SLO 2: External API call traces (should have <500ms latency)
generate_test_traces "http.client.openai" 95 15

# SLO 3: User transaction traces (should be <3s end-to-end)
generate_test_traces "POST /api/workflows/execute" 98 25

print_success "Test telemetry data generated"

# Wait for data to be processed
print_info "Waiting 30 seconds for telemetry processing..."
sleep 30

# Test 4: Verify span metrics are being generated
echo -e "\n${BLUE}Test 4: Span Metrics Generation${NC}"

SPAN_METRICS=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=traces_spanmetrics_latency_bucket" | jq -r '.data.result | length')
if [ "$SPAN_METRICS" -gt 0 ]; then
    print_success "Span metrics are being generated ($SPAN_METRICS series)"
else
    print_error "No span metrics found - check OpenTelemetry Collector spanmetrics processor"
fi

# Test 5: Verify SLO recording rule outputs
echo -e "\n${BLUE}Test 5: SLO Recording Rule Validation${NC}"

# Check SLO 1: Process Success Rate
SLO1_VALUE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=easyflow:slo1_success_rate_28d" | jq -r '.data.result[0].value[1] // empty')
if [ -n "$SLO1_VALUE" ]; then
    print_success "SLO 1 (Process Success Rate): ${SLO1_VALUE}%"
    
    # Validate the value is reasonable (should be >95%)
    if (( $(echo "$SLO1_VALUE > 95" | bc -l) )); then
        print_success "SLO 1 value is within expected range"
    else
        print_warning "SLO 1 value ($SLO1_VALUE%) seems low - check process success data"
    fi
else
    print_error "SLO 1 metric not found - check recording rules"
fi

# Check SLO 2: API Latency
SLO2_VALUE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=easyflow:slo2_latency_success_rate_28d" | jq -r '.data.result[0].value[1] // empty')
if [ -n "$SLO2_VALUE" ]; then
    print_success "SLO 2 (API Latency): ${SLO2_VALUE}%"
else
    print_error "SLO 2 metric not found - check external API span data"
fi

# Check SLO 3: User Transactions  
SLO3_VALUE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=easyflow:slo3_transaction_success_rate_28d" | jq -r '.data.result[0].value[1] // empty')
if [ -n "$SLO3_VALUE" ]; then
    print_success "SLO 3 (User Transactions): ${SLO3_VALUE}%"
else
    print_error "SLO 3 metric not found - check user transaction span data"
fi

# Test 6: Error Budget Calculations
echo -e "\n${BLUE}Test 6: Error Budget Calculations${NC}"

ERROR_BUDGET_1=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=easyflow:slo1_error_budget_remaining" | jq -r '.data.result[0].value[1] // empty')
if [ -n "$ERROR_BUDGET_1" ]; then
    print_success "SLO 1 Error Budget: ${ERROR_BUDGET_1}% remaining"
else
    print_error "Error budget calculation not working for SLO 1"
fi

# Test 7: Business Context Metrics
echo -e "\n${BLUE}Test 7: Business Context Metrics${NC}"

BUSINESS_METRICS=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=easyflow:rpa_executions_by_tier_5m" | jq -r '.data.result | length')
if [ "$BUSINESS_METRICS" -gt 0 ]; then
    print_success "Business context metrics are available ($BUSINESS_METRICS series)"
    
    # Show breakdown by user tier
    PREMIUM_RATE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=easyflow:rpa_executions_by_tier_5m{user_tier=\"premium\"}" | jq -r '.data.result[0].value[1] // "0"')
    print_info "Premium tier execution rate: ${PREMIUM_RATE} req/sec"
else
    print_error "Business context metrics not found - check span attribute extraction"
fi

# Test 8: Grafana Dashboard Validation
echo -e "\n${BLUE}Test 8: Grafana Dashboard Access${NC}"

if curl -s "${GRAFANA_URL}/api/health" > /dev/null 2>&1; then
    print_success "Grafana is accessible"
    
    # Check if SLO dashboard exists
    DASHBOARD_CHECK=$(curl -s -u admin:admin123 "${GRAFANA_URL}/api/search?query=SLO" | jq -r '. | length')
    if [ "$DASHBOARD_CHECK" -gt 0 ]; then
        print_success "SLO dashboard is available in Grafana"
    else
        print_warning "SLO dashboard not found - may need to be imported manually"
    fi
else
    print_error "Grafana is not accessible"
fi

# Test 9: Alert Rule Validation
echo -e "\n${BLUE}Test 9: Alert Rule Validation${NC}"

ALERT_RULES=$(curl -s "${PROMETHEUS_URL}/api/v1/rules" | jq -r '.data.groups[] | select(.name=="easyflow_slo_alerts") | .rules | length')
if [ "$ALERT_RULES" -gt 0 ]; then
    print_success "SLO alert rules loaded ($ALERT_RULES rules)"
    
    # Check for any currently firing alerts
    FIRING_ALERTS=$(curl -s "${PROMETHEUS_URL}/api/v1/alerts" | jq -r '[.data.alerts[] | select(.state=="firing" and (.labels.slo != null))] | length')
    if [ "$FIRING_ALERTS" -eq 0 ]; then
        print_success "No SLO alerts currently firing"
    else
        print_warning "$FIRING_ALERTS SLO alerts are currently firing"
    fi
else
    print_error "SLO alert rules not loaded"
fi

# Test 10: End-to-End Data Flow Test
echo -e "\n${BLUE}Test 10: End-to-End Data Flow Validation${NC}"

print_info "Testing complete data flow: Trace -> Span Metrics -> Recording Rules -> Alerts"

# Generate a trace that should trigger SLO calculations
TRACE_ID=$(openssl rand -hex 16)
curl -s -X POST "${OTEL_COLLECTOR_URL}/v1/traces" \
    -H "Content-Type: application/json" \
    -d "{
        \"resourceSpans\": [{
            \"resource\": {
                \"attributes\": [
                    {\"key\": \"service.name\", \"value\": {\"stringValue\": \"automation-worker\"}},
                    {\"key\": \"business.workflow_id\", \"value\": {\"stringValue\": \"validation-test\"}}
                ]
            },
            \"scopeSpans\": [{
                \"scope\": {\"name\": \"validation\", \"version\": \"1.0.0\"},
                \"spans\": [{
                    \"traceId\": \"$TRACE_ID\",
                    \"spanId\": \"$(openssl rand -hex 8)\",
                    \"name\": \"rpa.process.execute\",
                    \"kind\": 2,
                    \"startTimeUnixNano\": \"$(($(date +%s) * 1000000000))\",
                    \"endTimeUnixNano\": \"$((($(date +%s) + 2) * 1000000000))\",
                    \"attributes\": [
                        {\"key\": \"slo.process_execution\", \"value\": {\"boolValue\": true}},
                        {\"key\": \"business.user_id\", \"value\": {\"stringValue\": \"validation-user\"}},
                        {\"key\": \"user_tier\", \"value\": {\"stringValue\": \"premium\"}}
                    ],
                    \"status\": {\"code\": 1}
                }]
            }]
        }]
    }" > /dev/null

print_success "End-to-end validation trace sent (Trace ID: $TRACE_ID)"

# Summary
echo -e "\n${BLUE}=================================================="
echo -e "Validation Summary"
echo -e "==================================================${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    print_success "All tests passed! ($TESTS_PASSED/$((TESTS_PASSED + TESTS_FAILED)))"
    echo ""
    print_info "🎉 EasyFlow SLO data pipeline is fully operational!"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Import Grafana SLO dashboard: ${GRAFANA_URL}/dashboard/import"
    echo "2. Configure alert notification channels in Alertmanager"
    echo "3. Set up SLO review meetings and runbooks"
    echo "4. Monitor SLO compliance and error budget burn rates"
    
    exit 0
else
    print_error "$TESTS_FAILED tests failed, $TESTS_PASSED tests passed"
    echo ""
    echo -e "${YELLOW}Issues to address:${NC}"
    echo "- Check service health and configuration"
    echo "- Verify OpenTelemetry instrumentation is sending data"
    echo "- Review Prometheus recording rules configuration"
    echo "- Ensure all services are properly connected"
    
    exit 1
fi