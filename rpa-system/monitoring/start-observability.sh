#!/bin/bash
# Start the observability stack for local testing

echo "🚀 Starting EasyFlow Observability Stack..."
echo ""
echo "Services:"
echo "  • OpenTelemetry Collector: http://localhost:4318"
echo "  • Prometheus: http://localhost:9090"
echo "  • Grafana: http://localhost:3003 (admin/admin123)"
echo "  • Tempo: http://localhost:3200"
echo "  • Alertmanager: http://localhost:9093"
echo ""

docker compose -f docker-compose.monitoring.yml up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "✅ Observability stack started!"
echo ""
echo "📊 Access Grafana: http://localhost:3003"
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
echo "To stop: docker compose -f docker-compose.monitoring.yml down"
