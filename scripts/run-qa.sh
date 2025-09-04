#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting test services (docker compose)..."
(cd rpa-system && docker compose -f docker-compose.test.yml up -d)
# give services time to start
sleep 8

echo "Installing backend deps..."
(cd rpa-system && npm ci)

echo "Running backend unit tests..."
(cd rpa-system && npm test)

echo "Running integration harnesses (non-fatal)..."
# allow failures but continue
(cd rpa-system && node backend/referral_integration.js) || true
(cd rpa-system && node backend/scripts/test_event_forwarder.js) || true

echo "Installing dashboard deps..."
(cd rpa-system/rpa-dashboard && npm ci)

echo "Running dashboard lint..."
(cd rpa-system/rpa-dashboard && npx eslint src --ext .js,.jsx) || true

echo "Running dashboard tests (CI mode)..."
(cd rpa-system/rpa-dashboard && CI=true npm test --silent -- --watchAll=false) || true

echo "Running Python automation tests..."
(cd rpa-system/automation && pip install -r requirements.txt && pytest -q) || true

echo "Collecting docker logs into ./artifacts/service-logs.txt"
mkdir -p artifacts
docker compose -f rpa-system/docker-compose.test.yml logs --no-color > artifacts/service-logs.txt || true

echo "QA run complete. Review artifacts/service-logs.txt and console output for failures."
