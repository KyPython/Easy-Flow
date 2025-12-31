#!/bin/bash

# EasyFlow - Accessibility Testing Script
# Runs accessibility tests locally using pa11y and axe-core

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DASHBOARD_DIR="$PROJECT_ROOT/rpa-system/rpa-dashboard"

echo "🔍 EasyFlow - Accessibility Testing"
echo ""

# Check if dashboard directory exists
if [[ ! -d "$DASHBOARD_DIR" ]]; then
  echo "❌ Dashboard directory not found: $DASHBOARD_DIR"
  exit 1
fi

cd "$DASHBOARD_DIR"

# Check if dependencies are installed
if [[ ! -d "node_modules" ]]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Build the frontend
echo "🏗️  Building frontend..."
npm run build

# Start local server
echo "🚀 Starting local server..."
npx serve -s build -l 3000 > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
for i in {1..30}; do
  if curl -f http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Server failed to start"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  sleep 2
done

# Create results directory
mkdir -p results

# Run pa11y tests
echo ""
echo "🔍 Running pa11y accessibility tests..."
if npx pa11y-ci --config .pa11yci.json; then
  echo "✅ pa11y tests passed!"
else
  echo "❌ pa11y tests failed"
  PA11Y_FAILED=true
fi

# Run axe-core tests
echo ""
echo "🔍 Running axe-core accessibility tests..."
if npx @axe-core/cli http://localhost:3000 --tags wcag2a,wcag2aa,wcag21aa --save results/axe-report.json; then
  echo "✅ axe-core tests passed!"
else
  echo "❌ axe-core tests failed"
  AXE_FAILED=true
fi

# Stop server
echo ""
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null || true

# Summary
echo ""
echo "📊 Accessibility Test Summary"
echo "=============================="
if [[ -z "$PA11Y_FAILED" ]]; then
  echo "✅ pa11y: PASSED"
else
  echo "❌ pa11y: FAILED"
fi
if [[ -z "$AXE_FAILED" ]]; then
  echo "✅ axe-core: PASSED"
else
  echo "❌ axe-core: FAILED"
fi

if [[ -f "results/axe-report.json" ]]; then
  echo ""
  echo "📄 Results saved to: results/axe-report.json"
fi

# Exit with error if any tests failed
if [[ -n "$PA11Y_FAILED" ]] || [[ -n "$AXE_FAILED" ]]; then
  exit 1
fi

echo ""
echo "✅ All accessibility tests passed!"

