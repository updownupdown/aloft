#!/usr/bin/env bash
# Runs the game on desktop using the Godot editor's runtime.
set -euo pipefail
cd "$(dirname "$0")/.."
source "$(dirname "$0")/_env.sh"

godot --path .
