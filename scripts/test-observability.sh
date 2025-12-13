#!/bin/bash
# Test Observability Stack Health

set -e

echo "🔍 Testing EasyFlow Observability Stack"
echo "========================================"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TEST_PASSED=0
TEST_FAILED=0

# Test function
test_endpoint() {
  local name=$1
  local url=$2
  local expected_content=$3
  
  echo -n "Testing $name... "
  
  if response=$(curl -sf "$url" 2>/dev/null); then
    if [ -z "$expected_content" ] || echo "$response" | grep -q "$expected_content"; then
      echo -e "${GREEN}✓ PASS${NC}"
      ((TEST_PASSED++))
      return 0
    else
      echo -e "${YELLOW}⚠ PARTIAL (endpoint responds but missing expected content)${NC}"
      echo "  Expected to find: $expected_content"
      ((TEST_FAILED++))
      return 1
    fi
  else
    echo -e "${RED}✗ FAIL (endpoint not reachable)${NC}"
    ((TEST_FAILED++))
    return 1
  fi
}

echo ""
echo "📊 Infrastructure Tests"
echo "----------------------"

# Prometheus
test_endpoint "Prometheus" "http://localhost:9090/-/healthy" ""
test_endpoint "Prometheus Targets" "http://localhost:9090/api/v1/targets" "\"health\":\"up\""

# Grafana
test_endpoint "Grafana" "http://localhost:3001/api/health" "ok"

# Loki
test_endpoint "Loki" "http://localhost:3100/ready" "ready"

# OTEL Collector
test_endpoint "OTEL Collector" "http://localhost:13133/" ""

echo ""
echo "🎯 Application Tests"
echo "--------------------"

# Backend
test_endpoint "Backend Health" "http://localhost:3030/health" ""
test_endpoint "Backend Metrics" "http://localhost:9091/metrics" "up 1"

# Frontend
test_endpoint "Frontend" "http://localhost:3000" ""

# Automation Worker
test_endpoint "Automation Worker" "http://localhost:7070/health" ""

echo ""
echo "📡 Telemetry Flow Tests"
echo "----------------------"

# Check if metrics are being collected
echo -n "Testing metrics collection... "
if metrics=$(curl -sf "http://localhost:9091/metrics"); then
  if echo "$metrics" | grep -q "http_requests_total"; then
    echo -e "${GREEN}✓ PASS (HTTP metrics found)${NC}"
    ((TEST_PASSED++))
  else
    echo -e "${YELLOW}⚠ PARTIAL (metrics endpoint works but no HTTP metrics yet)${NC}"
    ((TEST_FAILED++))
  fi
else
  echo -e "${RED}✗ FAIL${NC}"
  ((TEST_FAILED++))
fi

# Check if Prometheus is scraping backend
echo -n "Testing Prometheus scraping... "
if targets=$(curl -sf "http://localhost:9090/api/v1/targets"); then
  if echo "$targets" | grep -q "easyflow-backend"; then
    echo -e "${GREEN}✓ PASS (backend target configured)${NC}"
    ((TEST_PASSED++))
  else
    echo -e "${YELLOW}⚠ PARTIAL (targets endpoint works but backend not configured)${NC}"
    ((TEST_FAILED++))
  fi
else
  echo -e "${RED}✗ FAIL${NC}"
  ((TEST_FAILED++))
fi

# Check if logs are being collected
echo -n "Testing log collection... "
if [ -f "logs/backend.log" ] && [ -s "logs/backend.log" ]; then
  echo -e "${GREEN}✓ PASS (backend logs exist)${NC}"
  ((TEST_PASSED++))
else
  echo -e "${RED}✗ FAIL (no backend logs found)${NC}"
  ((TEST_FAILED++))
fi

# Check if Promtail is reading logs
echo -n "Testing Promtail... "
if docker ps | grep -q "easyflow-promtail"; then
  echo -e "${GREEN}✓ PASS (Promtail container running)${NC}"
  ((TEST_PASSED++))
else
  echo -e "${RED}✗ FAIL (Promtail not running)${NC}"
  ((TEST_FAILED++))
fi

# Check Kafka
echo -n "Testing Kafka... "
if docker exec easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
  echo -e "${GREEN}✓ PASS (Kafka responding)${NC}"
  ((TEST_PASSED++))
  
  # Check for automation-tasks topic
  echo -n "Testing Kafka topic (automation-tasks)... "
  if docker exec easy-flow-kafka-1 kafka-topics --bootstrap-server localhost:9092 --list 2>/dev/null | grep -q "automation-tasks"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((TEST_PASSED++))
  else
    echo -e "${RED}✗ FAIL (topic not created)${NC}"
    echo "  Run: ./scripts/init-kafka-topics.sh"
    ((TEST_FAILED++))
  fi
else
  echo -e "${RED}✗ FAIL${NC}"
  ((TEST_FAILED++))
fi

echo ""
echo "========================================"
echo "📈 Test Summary"
echo "  Passed: ${GREEN}${TEST_PASSED}${NC}"
echo "  Failed: ${RED}${TEST_FAILED}${NC}"
echo ""

if [ $TEST_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "You can now:"
  echo "  • View metrics: http://localhost:9090"
  echo "  • View dashboards: http://localhost:3001 (admin/admin)"
  echo "  • Query logs: http://localhost:3001/explore (select Loki datasource)"
  exit 0
else
  echo -e "${YELLOW}⚠ Some tests failed${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  • Check if all services are running: docker ps"
  echo "  • Check PM2 processes: pm2 status"
  echo "  • View service logs: pm2 logs"
  echo "  • Restart services: ./stop-dev.sh && ./start-dev.sh"
  exit 1
fi
