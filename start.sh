#!/bin/bash
echo "Starting backend on port 3001..."
cd "$(dirname "$0")/backend" && node index.js &
BACKEND_PID=$!

echo "Starting frontend on port 3000..."
cd "$(dirname "$0")/frontend" && npm start &
FRONTEND_PID=$!

echo ""
echo "  Faculty portal: http://localhost:3000"
echo "  Admin portal:   http://localhost:3000 (click Admin tab)"
echo "  Admin password: admin123"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
