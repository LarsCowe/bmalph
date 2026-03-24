#!/usr/bin/env bats
# Tests for ralph/lib/circuit_breaker.sh
# Validates the 3-state machine (CLOSED → HALF_OPEN → OPEN),
# threshold-based transitions, auto-recovery, and history logging.

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/circuit_breaker.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# init_circuit_breaker
# ===========================================================================

@test "init_circuit_breaker creates valid state file" {
    init_circuit_breaker

    assert [ -f "$CB_STATE_FILE" ]

    run jq -r '.state' "$CB_STATE_FILE"
    assert_output "CLOSED"

    run jq -r '.consecutive_no_progress' "$CB_STATE_FILE"
    assert_output "0"

    run jq -r '.consecutive_same_error' "$CB_STATE_FILE"
    assert_output "0"

    run jq -r '.consecutive_permission_denials' "$CB_STATE_FILE"
    assert_output "0"
}

@test "init_circuit_breaker creates history file as empty array" {
    init_circuit_breaker

    assert [ -f "$CB_HISTORY_FILE" ]
    run jq 'length' "$CB_HISTORY_FILE"
    assert_output "0"
}

@test "init_circuit_breaker recreates corrupted state file" {
    echo "not valid json" > "$CB_STATE_FILE"
    echo '[]' > "$CB_HISTORY_FILE"

    init_circuit_breaker

    run jq -r '.state' "$CB_STATE_FILE"
    assert_output "CLOSED"
}

@test "init_circuit_breaker preserves valid non-OPEN state" {
    jq -n '{state: "HALF_OPEN", last_change: "2026-01-01T00:00:00+00:00", consecutive_no_progress: 2, consecutive_same_error: 0, consecutive_permission_denials: 0, last_progress_loop: 5, total_opens: 0, reason: "Monitoring"}' \
        > "$CB_STATE_FILE"
    echo '[]' > "$CB_HISTORY_FILE"

    init_circuit_breaker

    run jq -r '.state' "$CB_STATE_FILE"
    assert_output "HALF_OPEN"
}

# ===========================================================================
# get_circuit_state
# ===========================================================================

@test "get_circuit_state returns CLOSED after init" {
    init_circuit_breaker

    run get_circuit_state
    assert_output "CLOSED"
}

@test "get_circuit_state reads state from existing file" {
    jq -n '{state: "HALF_OPEN"}' > "$CB_STATE_FILE"

    run get_circuit_state
    assert_output "HALF_OPEN"
}

@test "get_circuit_state returns CLOSED when file missing" {
    run get_circuit_state
    assert_output "CLOSED"
}

# ===========================================================================
# record_loop_result — progress detection
# ===========================================================================

@test "record_loop_result with file changes records progress" {
    _quiet_record 1 3 false 500

    run get_circuit_state
    assert_output "CLOSED"

    run jq -r '.consecutive_no_progress' "$CB_STATE_FILE"
    assert_output "0"

    run jq -r '.last_progress_loop' "$CB_STATE_FILE"
    assert_output "1"
}

@test "record_loop_result without progress increments counter" {
    _quiet_record 1 0 false 100

    run jq -r '.consecutive_no_progress' "$CB_STATE_FILE"
    assert_output "1"
}

@test "record_loop_result detects progress from completion signal" {
    _mock_response_analysis false true true 0

    _quiet_record 1 0 false 100

    run jq -r '.consecutive_no_progress' "$CB_STATE_FILE"
    assert_output "0"
}

@test "record_loop_result detects progress from ralph files_modified" {
    _mock_response_analysis false false false 4

    _quiet_record 1 0 false 100

    run jq -r '.consecutive_no_progress' "$CB_STATE_FILE"
    assert_output "0"
}

@test "record_loop_result returns 0 when circuit allows execution" {
    run record_loop_result 1 5 false 500
    assert_success
}

# ===========================================================================
# State transitions: CLOSED → HALF_OPEN
# ===========================================================================

@test "two no-progress loops transitions CLOSED to HALF_OPEN" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100

    run get_circuit_state
    assert_output "HALF_OPEN"
}

# ===========================================================================
# State transitions: HALF_OPEN → CLOSED (recovery)
# ===========================================================================

@test "HALF_OPEN recovers to CLOSED on progress" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100  # → HALF_OPEN
    _quiet_record 3 5 false 500  # progress → CLOSED

    run get_circuit_state
    assert_output "CLOSED"
}

# ===========================================================================
# State transitions: HALF_OPEN → OPEN
# ===========================================================================

@test "HALF_OPEN transitions to OPEN after no-progress threshold" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100  # → HALF_OPEN
    _quiet_record 3 0 false 100 || true  # → OPEN

    run get_circuit_state
    assert_output "OPEN"
}

@test "record_loop_result returns 1 when circuit opens" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100

    run record_loop_result 3 0 false 100
    assert_failure
}

# ===========================================================================
# OPEN state
# ===========================================================================

@test "OPEN state blocks execution via can_execute" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100
    _quiet_record 3 0 false 100 || true

    run can_execute
    assert_failure
}

@test "CLOSED state allows execution via can_execute" {
    init_circuit_breaker

    run can_execute
    assert_success
}

# ===========================================================================
# Auto-recovery: CB_AUTO_RESET
# ===========================================================================

@test "CB_AUTO_RESET resets OPEN to CLOSED on init" {
    local now_iso
    now_iso=$(get_iso_timestamp)

    jq -n --arg ts "$now_iso" \
        '{state: "OPEN", last_change: $ts, opened_at: $ts, consecutive_no_progress: 3, consecutive_same_error: 0, consecutive_permission_denials: 0, last_progress_loop: 0, total_opens: 1, reason: "test", current_loop: 3}' \
        > "$CB_STATE_FILE"
    echo '[]' > "$CB_HISTORY_FILE"

    CB_AUTO_RESET=true
    init_circuit_breaker

    run get_circuit_state
    assert_output "CLOSED"
}

# ===========================================================================
# Auto-recovery: cooldown
# ===========================================================================

@test "cooldown expiry recovers OPEN to HALF_OPEN on init" {
    local old_time
    old_time=$(_minutes_ago_iso 60)  # 60 min ago; cooldown is 30 min

    jq -n --arg ts "$old_time" \
        '{state: "OPEN", last_change: $ts, opened_at: $ts, consecutive_no_progress: 3, consecutive_same_error: 0, consecutive_permission_denials: 0, last_progress_loop: 0, total_opens: 1, reason: "test", current_loop: 3}' \
        > "$CB_STATE_FILE"
    echo '[]' > "$CB_HISTORY_FILE"

    init_circuit_breaker

    run get_circuit_state
    assert_output "HALF_OPEN"
}

@test "OPEN state within cooldown window stays OPEN" {
    local recent_time
    recent_time=$(_minutes_ago_iso 5)  # 5 min ago; cooldown is 30 min

    jq -n --arg ts "$recent_time" \
        '{state: "OPEN", last_change: $ts, opened_at: $ts, consecutive_no_progress: 3, consecutive_same_error: 0, consecutive_permission_denials: 0, last_progress_loop: 0, total_opens: 1, reason: "test", current_loop: 3}' \
        > "$CB_STATE_FILE"
    echo '[]' > "$CB_HISTORY_FILE"

    init_circuit_breaker

    run get_circuit_state
    assert_output "OPEN"
}

# ===========================================================================
# Same error threshold
# ===========================================================================

@test "same error threshold trips breaker from CLOSED" {
    # Each loop has progress (files_changed=1) to avoid no-progress transitions
    for i in 1 2 3 4; do
        _quiet_record "$i" 1 true 100
    done
    _quiet_record 5 1 true 100 || true

    run get_circuit_state
    assert_output "OPEN"
}

@test "errors reset when loop succeeds without errors" {
    _quiet_record 1 1 true 100   # error
    _quiet_record 2 1 true 100   # error
    _quiet_record 3 1 false 100  # no error → resets counter
    _quiet_record 4 1 true 100   # error (counter = 1)

    run jq -r '.consecutive_same_error' "$CB_STATE_FILE"
    assert_output "1"
}

# ===========================================================================
# Permission denial threshold
# ===========================================================================

@test "permission denial threshold trips breaker" {
    PERMISSION_DENIAL_MODE="threshold"
    _mock_response_analysis true false false 0

    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100 || true

    run get_circuit_state
    assert_output "OPEN"

    run jq -r '.reason' "$CB_STATE_FILE"
    assert_output --partial "Permission denied"
}

@test "permission denials do not trip breaker in continue mode" {
    PERMISSION_DENIAL_MODE="continue"
    _mock_response_analysis true false false 0

    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100

    run get_circuit_state
    assert_output "HALF_OPEN"

    run jq -r '.consecutive_permission_denials' "$CB_STATE_FILE"
    assert_output "0"
}

@test "permission denials reset when loop has no denials" {
    PERMISSION_DENIAL_MODE="threshold"
    _mock_response_analysis true false false 0
    _quiet_record 1 0 false 100  # denial 1

    _mock_response_analysis false false false 0
    _quiet_record 2 0 false 100  # no denial → reset

    run jq -r '.consecutive_permission_denials' "$CB_STATE_FILE"
    assert_output "0"
}

# ===========================================================================
# reset_circuit_breaker
# ===========================================================================

@test "reset_circuit_breaker resets to CLOSED with zero counters" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100
    _quiet_record 3 0 false 100 || true

    run get_circuit_state
    assert_output "OPEN"

    reset_circuit_breaker > /dev/null 2>&1

    run get_circuit_state
    assert_output "CLOSED"

    run jq -r '.consecutive_no_progress' "$CB_STATE_FILE"
    assert_output "0"

    run jq -r '.total_opens' "$CB_STATE_FILE"
    assert_output "0"
}

@test "reset_circuit_breaker accepts custom reason" {
    init_circuit_breaker
    reset_circuit_breaker "User requested reset" > /dev/null 2>&1

    run jq -r '.reason' "$CB_STATE_FILE"
    assert_output "User requested reset"
}

# ===========================================================================
# History logging
# ===========================================================================

@test "history records all state transitions" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100  # → HALF_OPEN
    _quiet_record 3 0 false 100 || true  # → OPEN

    run jq 'length' "$CB_HISTORY_FILE"
    assert_output "2"

    run jq -r '.[0].from_state' "$CB_HISTORY_FILE"
    assert_output "CLOSED"

    run jq -r '.[0].to_state' "$CB_HISTORY_FILE"
    assert_output "HALF_OPEN"

    run jq -r '.[1].from_state' "$CB_HISTORY_FILE"
    assert_output "HALF_OPEN"

    run jq -r '.[1].to_state' "$CB_HISTORY_FILE"
    assert_output "OPEN"
}

@test "history records recovery transitions" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100  # → HALF_OPEN
    _quiet_record 3 5 false 500  # → CLOSED (recovery)

    run jq 'length' "$CB_HISTORY_FILE"
    assert_output "2"

    run jq -r '.[-1].to_state' "$CB_HISTORY_FILE"
    assert_output "CLOSED"

    run jq -r '.[-1].reason' "$CB_HISTORY_FILE"
    assert_output --partial "recovered"
}

@test "total_opens increments on each OPEN transition" {
    _quiet_record 1 0 false 100
    _quiet_record 2 0 false 100
    _quiet_record 3 0 false 100 || true

    run jq -r '.total_opens' "$CB_STATE_FILE"
    assert_output "1"
}

# ===========================================================================
# JSON safety: special characters in string fields
# ===========================================================================

@test "reset_circuit_breaker preserves reason with double quotes" {
    init_circuit_breaker
    reset_circuit_breaker 'Reset for "testing" purposes' > /dev/null 2>&1

    # State file must be valid JSON
    run jq empty "$CB_STATE_FILE"
    assert_success

    run jq -r '.reason' "$CB_STATE_FILE"
    assert_output 'Reset for "testing" purposes'
}

@test "reset_circuit_breaker preserves reason with backslash" {
    init_circuit_breaker
    reset_circuit_breaker 'Path: C:\Users\test' > /dev/null 2>&1

    run jq empty "$CB_STATE_FILE"
    assert_success

    run jq -r '.reason' "$CB_STATE_FILE"
    assert_output 'Path: C:\Users\test'
}

@test "log_circuit_transition preserves reason with newline" {
    init_circuit_breaker

    local reason=$'Line one\nLine two'
    log_circuit_transition "CLOSED" "HALF_OPEN" "$reason" 1 > /dev/null 2>&1

    # History file must be valid JSON
    run jq empty "$CB_HISTORY_FILE"
    assert_success

    # Verify both lines survived the JSON round-trip
    run jq -r '.[0].reason' "$CB_HISTORY_FILE"
    assert_output --partial "Line one"
    assert_output --partial "Line two"

    # Verify the reason contains a literal newline (not escaped \\n)
    run jq -r '.[0].reason | test("Line one\nLine two")' "$CB_HISTORY_FILE"
    assert_output "true"
}

@test "log_circuit_transition preserves reason with double quotes" {
    init_circuit_breaker

    log_circuit_transition "CLOSED" "OPEN" 'Error: "file not found"' 3 > /dev/null 2>&1

    run jq empty "$CB_HISTORY_FILE"
    assert_success

    run jq -r '.[0].reason' "$CB_HISTORY_FILE"
    assert_output 'Error: "file not found"'
}

# ===========================================================================
# show_circuit_status
# ===========================================================================

@test "show_circuit_status outputs CLOSED state info" {
    init_circuit_breaker
    run show_circuit_status
    assert_success
    assert_output --partial "CLOSED"
}

@test "show_circuit_status outputs OPEN state info" {
    init_circuit_breaker
    # Force to OPEN state
    jq '.state = "OPEN" | .reason = "no_progress_threshold"' "$CB_STATE_FILE" > "$CB_STATE_FILE.tmp"
    mv "$CB_STATE_FILE.tmp" "$CB_STATE_FILE"
    run show_circuit_status
    assert_success
    assert_output --partial "OPEN"
}

@test "show_circuit_status outputs HALF_OPEN state info" {
    init_circuit_breaker
    jq '.state = "HALF_OPEN"' "$CB_STATE_FILE" > "$CB_STATE_FILE.tmp"
    mv "$CB_STATE_FILE.tmp" "$CB_STATE_FILE"
    run show_circuit_status
    assert_success
    assert_output --partial "HALF_OPEN"
}

# ===========================================================================
# should_halt_execution
# ===========================================================================

@test "should_halt_execution returns 0 (halt) when OPEN" {
    init_circuit_breaker
    jq '.state = "OPEN" | .reason = "no_progress_threshold"' "$CB_STATE_FILE" > "$CB_STATE_FILE.tmp"
    mv "$CB_STATE_FILE.tmp" "$CB_STATE_FILE"
    run should_halt_execution
    assert_success
}

@test "should_halt_execution shows bmalph-compatible recovery guidance" {
    init_circuit_breaker
    jq '.state = "OPEN" | .reason = "no_progress_threshold"' "$CB_STATE_FILE" > "$CB_STATE_FILE.tmp"
    mv "$CB_STATE_FILE.tmp" "$CB_STATE_FILE"

    run should_halt_execution

    assert_success
    assert_output --partial ".ralph/@fix_plan.md"
    assert_output --partial "bash .ralph/ralph_loop.sh --reset-circuit"
    refute_output --partial ".ralph/fix_plan.md"
    refute_output --partial "ralph --reset-circuit"
}

@test "should_halt_execution returns 1 (continue) when CLOSED" {
    init_circuit_breaker
    run should_halt_execution
    assert_failure
}
