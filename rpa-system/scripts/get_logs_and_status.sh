#!/usr/bin/env bash
set -euo pipefail
# Quick helper to print service status and tail backend logs. Run from anywhere (uses absolute path assumption).
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "Project dir: $PROJECT_DIR"

echo "Docker compose ps:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps || true

echo "\nBackend last 200 lines:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend --tail 200 || true

echo "\nAutomation last 200 lines:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs automation --tail 200 || true
