#!/bin/bash
# Double-click to start Ledgerlight. Close this window to stop it.
cd "$(dirname "$0")"
PORT=8765
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Ledgerlight is already running."
  open "http://localhost:$PORT/"
  exit 0
fi
trap 'kill $SERVER_PID 2>/dev/null; exit' INT TERM HUP EXIT
/usr/bin/env python3 server.py --port $PORT &
SERVER_PID=$!
wait $SERVER_PID
