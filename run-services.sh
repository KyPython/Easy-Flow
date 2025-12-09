#!/bin/bash
# Simple service runner

echo "Starting backend..."
cd rpa-system/backend
NODE_ENV=development PORT=3030 DISABLE_TELEMETRY=true KAFKA_ENABLED=false \
  node server.js > ../../logs/backend.log 2>&1 &
echo $! > /tmp/backend.pid
cd ../..

sleep 3

echo "Starting frontend..."
cd rpa-system/rpa-dashboard  
npm start > ../../logs/frontend.log 2>&1 &
echo $! > /tmp/frontend.pid
cd ../..

echo ""
echo "Services started!"
echo "Backend PID: $(cat /tmp/backend.pid)"
echo "Frontend PID: $(cat /tmp/frontend.pid)"
echo ""
echo "Logs:"
echo "  Backend:  tail -f logs/backend.log"
echo "  Frontend: tail -f logs/frontend.log"
