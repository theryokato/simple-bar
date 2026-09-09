#!/bin/bash
# Get next meeting using icalBuddy (much faster than AppleScript, handles recurring events)
# Usage: next-meeting.sh [icalBuddyPath] [lookAheadHours]

# Configuration
MAX_IN_PROGRESS_MINUTES=15  # Stop showing "now" after meeting is 15 min in progress
LOOKAHEAD="${2:-12}"        # How many hours ahead to look for meetings (default: 12)
MAX_EVENTS=10               # Fetch multiple events to skip stale in-progress ones

# Calculate end time (icalBuddy doesn't support now+Xh syntax)
END_TIME=$(date -v+${LOOKAHEAD}H "+%Y-%m-%d %H:%M")

# Use custom path if provided, otherwise auto-detect
CUSTOM_PATH="$1"
if [ -n "$CUSTOM_PATH" ] && [ -x "$CUSTOM_PATH" ]; then
  ICALBUDDY="$CUSTOM_PATH"
else
  ICALBUDDY=$(which icalBuddy 2>/dev/null)
  if [ -z "$ICALBUDDY" ]; then
    if [ -x "/opt/homebrew/bin/icalBuddy" ]; then
      ICALBUDDY="/opt/homebrew/bin/icalBuddy"
    elif [ -x "/usr/local/bin/icalBuddy" ]; then
      ICALBUDDY="/usr/local/bin/icalBuddy"
    else
      echo ""
      exit 0
    fi
  fi
fi

now_epoch=$(date +%s)

# Fetch multiple events - each event bullet starts with <<<E>>>
# Using a unique prefix that won't appear in notes content
output=$("$ICALBUDDY" -n -nc -nrd -ea -eed -li "$MAX_EVENTS" \
  -b "<<<E>>>" -ss "" \
  -df "%Y-%m-%d" -tf "%H:%M" \
  -iep "title,datetime,notes" \
  eventsFrom:"now" to:"$END_TIME" 2>/dev/null)

if [ -z "$output" ]; then
  echo ""
  exit 0
fi

# Write events to temp file for processing
tmpfile=$(mktemp)
echo "$output" > "$tmpfile"

# Extract individual events by splitting on <<<E>>> prefix
event_num=0
while IFS= read -r line; do
  if [[ "$line" == "<<<E>>>"* ]]; then
    # Process previous event if we have one
    if [ "$event_num" -gt 0 ] && [ -n "$cur_title" ] && [ -n "$cur_start_time" ] && [ -n "$cur_iso_date" ]; then
      meeting_epoch=$(date -j -f "%Y-%m-%d %H:%M" "$cur_iso_date $cur_start_time" +%s 2>/dev/null)
      if [ -n "$meeting_epoch" ]; then
        minutes_until=$(( (meeting_epoch - now_epoch) / 60 ))
        if [ "$minutes_until" -ge "-$MAX_IN_PROGRESS_MINUTES" ]; then
          echo "${cur_title}|${cur_iso_date}T${cur_start_time}||${cur_notes}|${minutes_until}"
          rm -f "$tmpfile"
          exit 0
        fi
      fi
    fi

    # Start new event
    event_num=$((event_num + 1))
    cur_title="${line#<<<E>>>}"
    cur_title=$(echo "$cur_title" | sed 's/ (Calendar)$//')
    cur_iso_date=""
    cur_start_time=""
    cur_notes=""
    in_notes=0
  elif [[ "$line" =~ ^[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}" at "[0-9]{2}:[0-9]{2} ]]; then
    cur_iso_date=$(echo "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
    cur_start_time=$(echo "$line" | grep -oE 'at [0-9]{2}:[0-9]{2}' | head -1 | sed 's/at //')
    in_notes=0
  elif [[ "$line" == *"notes:"* ]]; then
    in_notes=1
    cur_notes="$line"
  elif [ "$in_notes" -eq 1 ]; then
    cur_notes="${cur_notes} $(echo "$line" | sed 's/|/¦/g')"
  fi
done < "$tmpfile"

# Process the last event
if [ "$event_num" -gt 0 ] && [ -n "$cur_title" ] && [ -n "$cur_start_time" ] && [ -n "$cur_iso_date" ]; then
  meeting_epoch=$(date -j -f "%Y-%m-%d %H:%M" "$cur_iso_date $cur_start_time" +%s 2>/dev/null)
  if [ -n "$meeting_epoch" ]; then
    minutes_until=$(( (meeting_epoch - now_epoch) / 60 ))
    if [ "$minutes_until" -ge "-$MAX_IN_PROGRESS_MINUTES" ]; then
      echo "${cur_title}|${cur_iso_date}T${cur_start_time}||${cur_notes}|${minutes_until}"
      rm -f "$tmpfile"
      exit 0
    fi
  fi
fi

rm -f "$tmpfile"
echo ""
