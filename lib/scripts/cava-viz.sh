#!/bin/sh
# Ensures a persistent cava process is streaming frames to a state file, then
# prints the latest frame. Used by the simple-bar audio visualization widget.
# The streamer is started as a detached child of Übersicht so that reading a
# frame stays cheap: no CoreAudio tap is created or destroyed per read.
#
# Usage: cava-viz.sh [cava binary] [cava config path]

CAVA_BIN="${1:-/opt/homebrew/bin/cava}"
CAVA_CONFIG="${2:-./simple-bar/lib/scripts/cava.conf}"
FRAME_FILE="${TMPDIR:-/tmp}/simple-bar-cava-frame"

# Only spawn when running inside Übersicht's process tree. Cava's macOS
# audio-capture permission is attributed to its ancestor app: an Übersicht
# child inherits its grant silently, anything else triggers a permission
# prompt. Non-Übersicht callers must never spawn cava.
_ubersicht_child() {
  pid=$$
  while [ -n "$pid" ] && [ "$pid" != "1" ] && [ "$pid" != "0" ]; do
    case "$(ps -o comm= -p "$pid" 2>/dev/null)" in
      *bersicht*) return 0 ;;
    esac
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  done
  return 1
}

if ! _ubersicht_child; then
  [ -f "$FRAME_FILE" ] && cat "$FRAME_FILE"
  exit 0
fi

if ! pgrep -f "$CAVA_BIN -p $CAVA_CONFIG" > /dev/null 2>&1; then
  nohup sh -c \
    '"$1" -p "$2" 2> /dev/null | while IFS= read -r frame; do printf "%s\n" "$frame" > "$3"; done' \
    cava-viz "$CAVA_BIN" "$CAVA_CONFIG" "$FRAME_FILE" > /dev/null 2>&1 &
fi

[ -f "$FRAME_FILE" ] && cat "$FRAME_FILE"
