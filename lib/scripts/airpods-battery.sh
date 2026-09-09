#!/bin/sh
# Prints the battery levels of connected Bluetooth headphones as "L|R|Case"
# (percentages without the % sign), e.g. "39|23|85". Prints an empty line
# when no headphones are connected.
# Usage: airpods-battery.sh

system_profiler SPBluetoothDataType -json 2>/dev/null | python3 -c '
import json, sys

try:
    data = json.load(sys.stdin)
    devices = data["SPBluetoothDataType"][0].get("device_connected", [])
except Exception:
    print("")
    raise SystemExit

for group in devices:
    for name, info in group.items():
        if info.get("device_minorType") not in ("Headphones", "Earphones"):
            continue
        left = str(info.get("device_batteryLevelLeft", "")).replace("%", "")
        right = str(info.get("device_batteryLevelRight", "")).replace("%", "")
        case = str(info.get("device_batteryLevelCase", "")).replace("%", "")
        print(left + "|" + right + "|" + case)
        raise SystemExit

print("")
'
