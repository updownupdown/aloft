#!/usr/bin/env bash
# Serve the game locally: http://localhost:8000 (open it in Chrome; phones on the same
# Wi-Fi can use http://<this-machine's-ip>:8000). Ctrl+C to stop.
cd "$(dirname "$0")/../web" || exit 1
PORT="${1:-8000}"
if command -v py >/dev/null 2>&1; then exec py -3 -m http.server "$PORT"; fi
exec python3 -m http.server "$PORT"
