#!/usr/bin/env bash
# Builds a debug APK and installs it on a connected phone via adb.
# Pass a device serial as $1 if multiple devices/connections are active
# (e.g. a phone connected both by USB and wireless debugging shows twice).
set -euo pipefail
cd "$(dirname "$0")/.."
source "$(dirname "$0")/_env.sh"

mkdir -p export/android
godot --headless --export-debug "Android" export/android/aloft-debug.apk

echo "Checking for connected devices..."
adb devices

SERIAL="${1:-}"
if [ -z "$SERIAL" ]; then
	DEVICE_COUNT=$(adb devices | grep -w "device" | wc -l)
	if [ "$DEVICE_COUNT" -eq 1 ]; then
		SERIAL=$(adb devices | grep -w "device" | awk '{print $1}')
	elif [ "$DEVICE_COUNT" -gt 1 ]; then
		echo "Multiple devices connected. Re-run with the target serial, e.g.:"
		echo "  tools/build-android.sh <serial>"
		exit 1
	else
		echo "No devices found. Connect your phone via USB, or for wireless debugging:"
		echo "  adb pair <ip>:<pairing_port> <pairing_code>   (first time only)"
		echo "  adb connect <ip>:<connect_port>"
		exit 1
	fi
fi

echo "Installing on ${SERIAL}..."
adb -s "$SERIAL" install -r export/android/aloft-debug.apk

echo "Done. Launch 'Aloft' on your phone."
