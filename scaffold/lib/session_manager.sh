#!/usr/bin/env bash
# Session Manager for BMALPH
# Handles Claude CLI session continuity, expiration, and lifecycle tracking.

SESSION_FILE="$STATE_DIR/.claude_session_id"
SESSION_HISTORY_FILE="$STATE_DIR/.session_history"
SESSION_EXPIRY_HOURS="${BMALPH_SESSION_EXPIRY_HOURS:-24}"

# Initialize session tracking
init_session() {
  if [[ ! -f "$SESSION_HISTORY_FILE" ]]; then
    echo '[]' > "$SESSION_HISTORY_FILE"
  fi
}

# Get current session ID (empty string if none or expired)
get_session_id() {
  if [[ ! -f "$SESSION_FILE" ]]; then
    echo ""
    return
  fi

  # Check age
  local age_hours=0
  if command -v stat &>/dev/null; then
    local file_time
    local now
    now=$(date +%s)

    # Cross-platform stat
    if [[ "$(uname)" == "Darwin" ]]; then
      file_time=$(stat -f %m "$SESSION_FILE" 2>/dev/null || echo "$now")
    else
      file_time=$(stat -c %Y "$SESSION_FILE" 2>/dev/null || echo "$now")
    fi

    age_hours=$(( (now - file_time) / 3600 ))
  fi

  if [[ $age_hours -ge $SESSION_EXPIRY_HOURS ]]; then
    log_info "Session expired (${age_hours}h old), starting fresh"
    rm -f "$SESSION_FILE"
    echo ""
    return
  fi

  cat "$SESSION_FILE" 2>/dev/null || echo ""
}

# Save session ID from Claude output
save_session_id() {
  local session_id=$1
  if [[ -n "$session_id" && "$session_id" != "null" ]]; then
    echo "$session_id" > "$SESSION_FILE"
  fi
}

# Extract session ID from JSON output file
extract_session_from_output() {
  local output_file=$1

  if [[ ! -f "$output_file" ]]; then
    return
  fi

  local session_id
  session_id=$(python3 -c "
import json
try:
    with open('$output_file') as f:
        data = json.load(f)
    if isinstance(data, list):
        for item in data:
            if item.get('type') == 'result' and 'sessionId' in item:
                print(item['sessionId'])
                break
            elif item.get('type') == 'system' and 'session_id' in item:
                print(item['session_id'])
                break
    elif isinstance(data, dict):
        sid = data.get('sessionId', data.get('session_id', data.get('metadata', {}).get('session_id', '')))
        if sid:
            print(sid)
except:
    pass
" 2>/dev/null)

  if [[ -n "$session_id" ]]; then
    save_session_id "$session_id"
  fi
}

# Reset session (called on phase transitions, circuit breaker events, etc.)
reset_session() {
  local reason="${1:-manual}"
  rm -f "$SESSION_FILE"
  rm -f "$RESPONSE_ANALYSIS_FILE"
  log_session_event "reset" "$reason"
}

# Log session lifecycle event
log_session_event() {
  local event=$1
  local reason=$2

  if [[ ! -f "$SESSION_HISTORY_FILE" ]]; then
    echo '[]' > "$SESSION_HISTORY_FILE"
  fi

  python3 << PYEOF 2>/dev/null || true
import json
from datetime import datetime, timezone

history_file = "$SESSION_HISTORY_FILE"
try:
    with open(history_file) as f:
        history = json.load(f)
except:
    history = []

history.append({
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "event": "$event",
    "reason": "$reason"
})

# Keep last 50
history = history[-50:]

with open(history_file, 'w') as f:
    json.dump(history, f, indent=2)
PYEOF
}
