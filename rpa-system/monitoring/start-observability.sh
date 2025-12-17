#!/bin/bash
# Start the observability stack for local testing

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/rpa-system/docker-compose.monitoring.yml"

echo "🚀 Starting EasyFlow Observability Stack..."
echo ""
echo "Services:"
echo "  • OpenTelemetry Collector: http://localhost:4318"
echo "  • Prometheus: http://localhost:9090"
echo "  • Grafana: http://localhost:3001 (admin/admin123)"
echo "  • Tempo: http://localhost:3200"
echo "  • Loki: http://localhost:3100"
echo "  • Alertmanager: http://localhost:9093"
echo "  • Node Exporter: http://localhost:9100"
echo "  • cAdvisor: http://localhost:8080"
echo ""

cd "$PROJECT_ROOT/rpa-system" || exit 1
docker compose -f docker-compose.monitoring.yml up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "✅ Observability stack started!"
echo ""
echo "📊 Access Grafana: http://localhost:3001"
echo "   Login: admin / admin123"
echo ""
echo "🔍 View traces in Grafana:"
echo "   1. Go to Explore"
echo "   2. Select 'Tempo' data source"
echo "   3. Query: {service.name=\"rpa-system-backend\"}"
echo ""
echo "📈 View metrics in Grafana:"
echo "   1. Go to Explore"
echo "   2. Select 'Prometheus' data source"
echo "   3. Query: workflow_execution_total"
echo ""
echo "📋 View logs in Grafana:"
echo "   1. Go to Explore"
echo "   2. Select 'Loki' data source"
echo "   3. Query: {job=\"easyflow-services\"}"
echo ""
echo "To stop: ./rpa-system/monitoring/stop-observability.sh"
