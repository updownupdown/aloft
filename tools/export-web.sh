#!/usr/bin/env bash
# Exports the Web (single-threaded) build and serves it on localhost for Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."
source "$(dirname "$0")/_env.sh"

PORT="${1:-8060}"

mkdir -p export/web
godot --headless --export-debug "Web" export/web/index.html

echo "Serving export/web on http://localhost:${PORT} (Ctrl+C to stop)"
py -3 -m http.server "${PORT}" --directory export/web
