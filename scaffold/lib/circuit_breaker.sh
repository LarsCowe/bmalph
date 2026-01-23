#!/usr/bin/env bash
# Circuit Breaker for BMALPH
# Prevents runaway loops by detecting stagnation within a phase.
# Resets automatically on phase transitions.

# Circuit Breaker States
CB_STATE_CLOSED="CLOSED"
CB_STATE_HALF_OPEN="HALF_OPEN"
CB_STATE_OPEN="OPEN"

# Configuration (overridable via env)
CB_NO_PROGRESS_THRESHOLD="${BMALPH_CB_NO_PROGRESS_THRESHOLD:-3}"
CB_SAME_ERROR_THRESHOLD="${BMALPH_CB_SAME_ERROR_THRESHOLD:-5}"

CB_STATE_FILE="$STATE_DIR/.circuit_breaker_state"
CB_HISTORY_FILE="$STATE_DIR/.circuit_breaker_history"

# Initialize circuit breaker state
init_circuit_breaker() {
  if [[ -f "$CB_STATE_FILE" ]] && ! python3 -c "import json; json.load(open('$CB_STATE_FILE'))" 2>/dev/null; then
    rm -f "$CB_STATE_FILE"
  fi

  if [[ ! -f "$CB_STATE_FILE" ]]; then
    cat > "$CB_STATE_FILE" << EOF
{
  "state": "$CB_STATE_CLOSED",
  "last_change": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "consecutive_no_progress": 0,
  "consecutive_same_error": 0,
  "last_progress_loop": 0,
  "total_opens": 0,
  "reason": ""
}
EOF
  fi

  if [[ ! -f "$CB_HISTORY_FILE" ]]; then
    echo '[]' > "$CB_HISTORY_FILE"
  fi
}

# Get current state
get_circuit_state() {
  if [[ ! -f "$CB_STATE_FILE" ]]; then
    echo "$CB_STATE_CLOSED"
    return
  fi
  python3 -c "import json; print(json.load(open('$CB_STATE_FILE'))['state'])" 2>/dev/null || echo "$CB_STATE_CLOSED"
}

# Reset circuit breaker (called on phase transitions)
reset_circuit_breaker() {
  local reason="${1:-Phase transition}"
  cat > "$CB_STATE_FILE" << EOF
{
  "state": "$CB_STATE_CLOSED",
  "last_change": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "consecutive_no_progress": 0,
  "consecutive_same_error": 0,
  "last_progress_loop": 0,
  "total_opens": 0,
  "reason": "$reason"
}
EOF
  log_info "Circuit breaker reset: $reason"
}

# Record iteration result and check for stagnation
record_loop_result() {
  local loop_number=$1
  local files_changed=$2
  local has_errors=$3

  init_circuit_breaker

  local state_json
  state_json=$(cat "$CB_STATE_FILE")
  local current_state
  current_state=$(echo "$state_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['state'])")
  local no_progress
  no_progress=$(echo "$state_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['consecutive_no_progress'])")
  local same_error
  same_error=$(echo "$state_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['consecutive_same_error'])")

  # Detect progress
  if [[ $files_changed -gt 0 ]]; then
    no_progress=0
  else
    no_progress=$((no_progress + 1))
  fi

  # Detect repeated errors
  if [[ "$has_errors" == "true" ]]; then
    same_error=$((same_error + 1))
  else
    same_error=0
  fi

  # State transitions
  local new_state="$current_state"
  local reason=""

  case $current_state in
    "$CB_STATE_CLOSED")
      if [[ $no_progress -ge $CB_NO_PROGRESS_THRESHOLD ]]; then
        new_state="$CB_STATE_OPEN"
        reason="No progress in $no_progress iterations"
      elif [[ $same_error -ge $CB_SAME_ERROR_THRESHOLD ]]; then
        new_state="$CB_STATE_OPEN"
        reason="Same error repeated $same_error times"
      elif [[ $no_progress -ge 2 ]]; then
        new_state="$CB_STATE_HALF_OPEN"
        reason="Monitoring: $no_progress iterations without progress"
      fi
      ;;
    "$CB_STATE_HALF_OPEN")
      if [[ $files_changed -gt 0 ]]; then
        new_state="$CB_STATE_CLOSED"
        reason="Progress detected, recovered"
      elif [[ $no_progress -ge $CB_NO_PROGRESS_THRESHOLD ]]; then
        new_state="$CB_STATE_OPEN"
        reason="No recovery after $no_progress iterations"
      fi
      ;;
    "$CB_STATE_OPEN")
      reason="Circuit breaker open, halted"
      ;;
  esac

  local total_opens
  total_opens=$(echo "$state_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['total_opens'])")
  if [[ "$new_state" == "$CB_STATE_OPEN" && "$current_state" != "$CB_STATE_OPEN" ]]; then
    total_opens=$((total_opens + 1))
  fi

  cat > "$CB_STATE_FILE" << EOF
{
  "state": "$new_state",
  "last_change": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "consecutive_no_progress": $no_progress,
  "consecutive_same_error": $same_error,
  "last_progress_loop": $loop_number,
  "total_opens": $total_opens,
  "reason": "$reason"
}
EOF

  if [[ "$new_state" != "$current_state" ]]; then
    log_circuit_transition "$current_state" "$new_state" "$reason" "$loop_number"
  fi

  if [[ "$new_state" == "$CB_STATE_OPEN" ]]; then
    return 1
  fi
  return 0
}

# Log state transitions
log_circuit_transition() {
  local from=$1 to=$2 reason=$3 loop=$4

  case $to in
    "$CB_STATE_OPEN")    log_error "CIRCUIT BREAKER OPENED: $reason" ;;
    "$CB_STATE_HALF_OPEN") log_warn "Circuit breaker monitoring: $reason" ;;
    "$CB_STATE_CLOSED")  log_success "Circuit breaker recovered: $reason" ;;
  esac
}

# Check if execution should halt
should_halt_execution() {
  local state
  state=$(get_circuit_state)
  [[ "$state" == "$CB_STATE_OPEN" ]]
}
