#!/bin/bash
# Stop the observability stack

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/rpa-system/docker-compose.monitoring.yml"

echo "🛑 Stopping EasyFlow Observability Stack..."
echo ""

cd "$PROJECT_ROOT/rpa-system" || exit 1
docker compose -f docker-compose.monitoring.yml down

echo ""
echo "✅ Observability stack stopped!"
echo ""
echo "To start again: ./rpa-system/monitoring/start-observability.sh"

