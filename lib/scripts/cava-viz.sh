#!/bin/sh
# Ensures a persistent cava process is streaming frames to a state file, then
# prints the latest frame. Used by the simple-bar audio visualization widget.
# The streamer is started as a detached child of Übersicht so that reading a
# frame stays cheap: no CoreAudio tap is created or destroyed per read.
#
# Performance note: this runs 5 times per second. The fast path below (a
# stat + date + cat, ~15ms) is taken whenever the frame file is fresh, which
# proves the streamer is alive without walking the process tree or running a
# full pgrep scan. The expensive checks only run when the streamer is dead.
#
# Usage: cava-viz.sh [cava binary] [cava config path]

CAVA_BIN="${1:-/opt/homebrew/bin/cava}"
CAVA_CONFIG="${2:-./simple-bar/lib/scripts/cava.conf}"
FRAME_FILE="${TMPDIR:-/tmp}/simple-bar-cava-frame"

# Fast path: a frame written within the last 2s proves the streamer is alive.
now=$(date +%s)
mtime=$(stat -f %m "$FRAME_FILE" 2>/dev/null)
if [ -n "$mtime" ] && [ $((now - mtime)) -lt 2 ]; then
  cat "$FRAME_FILE"
  exit 0
fi

# Slow path (streamer dead or first run). Cava's macOS audio-capture
# permission is attributed to its ancestor app: an Übersicht child inherits
# its grant silently, anything else triggers a permission prompt.
# Non-Übersicht callers must never spawn cava.
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
