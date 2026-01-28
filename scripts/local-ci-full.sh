#!/usr/bin/env bash
# Local CI gate (pre-push)
# Runs the same high-signal checks CI runs, locally, before code reaches GitHub.
#
# Set FAST_PUSH=true to skip this script from .husky/pre-push.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🧪 Local CI gate (full) starting..."

echo ""
echo "1) Heading hierarchy"
node scripts/validate-heading-hierarchy.js

echo ""
echo "2) Comprehensive code validation suite"
bash scripts/validate-all.sh

echo ""
echo "3) Comprehensive tests / builds"
sh scripts/test-all.sh

echo ""
echo "4) Dashboard accessibility + chaos simulation (requires build + local server)"

DASHBOARD_DIR="$ROOT_DIR/rpa-system/rpa-dashboard"
cd "$DASHBOARD_DIR"

if [ -f package-lock.json ]; then
  npm ci
else
  npm install --no-audit --no-fund
fi

npm run build

# Start server
npx serve -s build -l 3000 > /tmp/easyflow-local-ci-serve.log 2>&1 &
SERVE_PID=$!

cleanup() {
  kill "$SERVE_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "⏳ Waiting for http://localhost:3000 ..."
for i in {1..45}; do
  if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Server is ready"
    break
  fi
  sleep 2
done

if ! curl -fsS http://localhost:3000 >/dev/null 2>&1; then
  echo "❌ Server did not become ready. Last logs:"
  tail -200 /tmp/easyflow-local-ci-serve.log || true
  exit 1
fi

echo ""
echo "4.1) pa11y (WCAG)"
npx pa11y-ci --config .pa11yci.json

echo ""
echo "4.2) axe-core (WCAG)"
npx @axe-core/cli http://localhost:3000 --tags wcag2a,wcag2aa,wcag21aa --exit --save results/axe-report.json

echo ""
echo "4.3) Chaos Human Simulation (Playwright)"
cd "$ROOT_DIR"
node scripts/chaos-human-simulation.js

echo ""
echo "✅ Local CI gate passed."

