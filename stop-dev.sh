#!/bin/bash
# Stop Development Servers

echo "🛑 Stopping Easy-Flow Development Servers"

# Kill processes by PID if files exist
if [ -f /tmp/backend.pid ]; then
    kill $(cat /tmp/backend.pid) 2>/dev/null && echo "✓ Backend stopped"
    rm /tmp/backend.pid
fi

if [ -f /tmp/frontend.pid ]; then
    kill $(cat /tmp/frontend.pid) 2>/dev/null && echo "✓ Frontend stopped"  
    rm /tmp/frontend.pid
fi

# Fallback: kill by process name
pkill -f "node server.js" 2>/dev/null
pkill -f "react-app-rewired" 2>/dev/null

sleep 1
echo "✓ All servers stopped"
