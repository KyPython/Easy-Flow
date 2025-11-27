#!/usr/bin/env bash
set -euo pipefail

# Robust helper to (re)start the dashboard dev server, capture a 10s Chrome trace,
# analyze and map it to original sources. Designed to be re-run if terminal
# disconnects. Run from repository root.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/rpa-system/rpa-dashboard"
DEV_LOG="/tmp/easyflow-dev.log"
DEV_PID_FILE="/tmp/easyflow-dev.pid"

echo "[run-dev-trace] root: $ROOT_DIR"

# Kill likely stuck processes
echo "[run-dev-trace] killing stuck dev/capture processes (if any)"
pkill -f "react-app-rewired" || true
pkill -f "node .*capture-trace" || true
pkill -f "puppeteer" || true
pkill -f "chrome" || true
sleep 1

cd "$DASHBOARD_DIR"

# (Re)install deps if node_modules missing or broken
if [ ! -d "node_modules" ]; then
  echo "[run-dev-trace] installing dependencies (npm ci)..."
  npm ci --prefer-offline --no-audit --no-fund || npm install
else
  echo "[run-dev-trace] node_modules exists — skipping install"
fi

# Start dev server in background
echo "[run-dev-trace] starting dev server (react-app-rewired start)"
# ensure previous log removed
rm -f "$DEV_LOG"
# Start dev server in background and save PID
npm run dev > "$DEV_LOG" 2>&1 &
DEV_PID=$!
echo $DEV_PID > "$DEV_PID_FILE"
echo "[run-dev-trace] started dev server PID $DEV_PID — log: $DEV_LOG"

# Wait for localhost:3000 to respond (timeout after 120s)
echo "[run-dev-trace] waiting for http://localhost:3000 to be ready (120s)"
READY=0
for i in $(seq 1 120); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
  if [ "$CODE" != "000" ]; then
    echo "[run-dev-trace] http code $CODE — server reachable"
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "[run-dev-trace] ERROR: dev server not reachable after 120s. Tail of dev log follows:"
  tail -n 200 "$DEV_LOG" || true
  echo "You can inspect the log or run the dev server manually. Exiting."
  exit 2
fi

# Verify simple page load using puppeteer-based simple-check (quicker)
echo "[run-dev-trace] running simple-check.js to validate page loads"
node "$ROOT_DIR/simple-check.js" || echo "simple-check.js reported an issue"

# Run the capture trace script (uses Puppeteer, produces diagnostics/<timestamp>-freeze)
echo "[run-dev-trace] running capture-trace.js (this records ~10s of tracing)"
# Increase node memory and allow the script to run; capture-trace has its own 30s goto timeout
node "$ROOT_DIR/capture-trace.js" http://localhost:3000 || echo "capture-trace.js exited non-zero"

# Find the latest diagnostics dir
LATEST=$(ls -td "$DASHBOARD_DIR/diagnostics"/*-freeze 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  echo "[run-dev-trace] No diagnostics directory found under $DASHBOARD_DIR/diagnostics"
  echo "Tail of dev log (last 200 lines):"
  tail -n 200 "$DEV_LOG" || true
  exit 3
fi

echo "[run-dev-trace] latest diagnostics: $LATEST"
ls -la "$LATEST"

TRACE_JSON="$LATEST/trace.json"
if [ -f "$TRACE_JSON" ]; then
  echo "[run-dev-trace] analyzing trace"
  node "$ROOT_DIR/tools/analyze-trace.js" "$TRACE_JSON" > "$LATEST/trace-summary.json" || true
  echo "[run-dev-trace] mapping trace frames to sources"
  node "$ROOT_DIR/tools/map-trace-to-sources.js" "$TRACE_JSON" > "$LATEST/mapping.txt" || true
  echo "--- trace-summary (head) ---"
  head -n 200 "$LATEST/trace-summary.json" || true
  echo "--- mapping (head) ---"
  head -n 200 "$LATEST/mapping.txt" || true
else
  echo "[run-dev-trace] trace.json not found in $LATEST — capture may have failed"
  tail -n 200 "$DEV_LOG" || true
  exit 4
fi

echo "[run-dev-trace] done. Diagnostics saved under: $LATEST"

echo "To stop the dev server later:"
echo "  kill \\$(cat $DEV_PID_FILE) || pkill -f react-app-rewired"

exit 0
