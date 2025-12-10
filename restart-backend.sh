#!/bin/bash
# Quick restart script for Easy-Flow backend

echo "🔄 Restarting backend..."
cd /Users/ky/Easy-Flow/rpa-system/backend

# Kill any existing backend process
pkill -f "node server.js" || true

# Wait a moment
sleep 1

# Start the backend
echo "✅ Starting backend on port 3030..."
NODE_ENV=development PORT=3030 node server.js
