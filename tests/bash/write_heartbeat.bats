#!/usr/bin/env bats
# Tests for ralph/lib/write_heartbeat.sh
# Validates heartbeat marker management, timeout detection,
# file modification monitoring, and process lifecycle.

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/write_heartbeat.sh"

    # Create a temp project directory with a .ralph dir inside
    PROJECT_DIR="$(mktemp -d)"
    mkdir -p "$PROJECT_DIR/.ralph"
    # Point RALPH_DIR at the project's .ralph so the library finds its markers
    RALPH_DIR="$PROJECT_DIR/.ralph"
    export RALPH_DIR

    # Spawn a long-lived target process that timeout tests can kill
    sleep 600 &
    TARGET_PID=$!
}

teardown() {
    # Clean up the monitor if still running
    stop_write_heartbeat 2>/dev/null || true

    # Clean up the target process
    kill "$TARGET_PID" 2>/dev/null || true
    wait "$TARGET_PID" 2>/dev/null || true

    # Remove temp project dir
    if [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR" ]]; then
        rm -rf "$PROJECT_DIR"
    fi

    _common_teardown
}

# ===========================================================================
# Helper: wait for a file to appear (with timeout)
# ===========================================================================

_wait_for_file() {
    local file=$1
    local max_iterations=${2:-25}  # Each iteration is 0.2s; 25 = ~5 seconds
    local i=0
    while [[ ! -f "$file" && $i -lt $max_iterations ]]; do
        sleep 0.2
        i=$((i + 1))
    done
    [[ -f "$file" ]]
}

# ===========================================================================
# start_write_heartbeat
# ===========================================================================

@test "start_write_heartbeat creates marker file" {
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 10 5

    assert [ -f "$RALPH_DIR/.heartbeat_marker" ]

    stop_write_heartbeat
}

@test "start_write_heartbeat creates pid file with running PID" {
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 10 5

    assert [ -f "$RALPH_DIR/.write_heartbeat_pid" ]

    local monitor_pid
    monitor_pid=$(cat "$RALPH_DIR/.write_heartbeat_pid")
    # Verify the stored PID is a running process
    run kill -0 "$monitor_pid"
    assert_success

    stop_write_heartbeat
}

@test "start_write_heartbeat cleans stale triggered marker" {
    # Plant a stale marker
    touch "$RALPH_DIR/.write_heartbeat_triggered"
    assert [ -f "$RALPH_DIR/.write_heartbeat_triggered" ]

    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 10 5

    refute [ -f "$RALPH_DIR/.write_heartbeat_triggered" ]

    stop_write_heartbeat
}

# ===========================================================================
# stop_write_heartbeat
# ===========================================================================

@test "stop_write_heartbeat kills monitor process" {
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 10 5

    local monitor_pid
    monitor_pid=$(cat "$RALPH_DIR/.write_heartbeat_pid")

    stop_write_heartbeat
    sleep 0.3

    # Monitor PID should no longer be running
    run kill -0 "$monitor_pid"
    assert_failure
}

@test "stop_write_heartbeat cleans up files" {
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 10 5

    stop_write_heartbeat

    refute [ -f "$RALPH_DIR/.write_heartbeat_pid" ]
    refute [ -f "$RALPH_DIR/.heartbeat_marker" ]
}

@test "stop_write_heartbeat is safe when no monitor running" {
    # No start_write_heartbeat called — should not error
    run stop_write_heartbeat
    assert_success
}

# ===========================================================================
# was_write_heartbeat_timeout
# ===========================================================================

@test "was_write_heartbeat_timeout returns false when no marker" {
    run was_write_heartbeat_timeout
    assert_failure
}

@test "was_write_heartbeat_timeout returns true when marker exists" {
    touch "$RALPH_DIR/.write_heartbeat_triggered"

    run was_write_heartbeat_timeout
    assert_success
}

@test "was_write_heartbeat_timeout does not delete marker" {
    touch "$RALPH_DIR/.write_heartbeat_triggered"

    was_write_heartbeat_timeout

    assert [ -f "$RALPH_DIR/.write_heartbeat_triggered" ]
}

# ===========================================================================
# Timeout behavior
# Uses _HEARTBEAT_TIMEOUT_SECS_OVERRIDE to avoid waiting 60+ seconds
# ===========================================================================

@test "monitor times out when no files modified" {
    export _HEARTBEAT_TIMEOUT_SECS_OVERRIDE=2
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 1 1

    # Wait long enough for the timeout to fire
    sleep 4

    stop_write_heartbeat 2>/dev/null || true

    assert [ -f "$RALPH_DIR/.write_heartbeat_triggered" ]
}

@test "monitor kills target process on timeout" {
    # Create a dedicated target for this test
    sleep 600 &
    local victim_pid=$!

    export _HEARTBEAT_TIMEOUT_SECS_OVERRIDE=2
    start_write_heartbeat "$PROJECT_DIR" "$victim_pid" 1 1

    # Wait for the monitor to kill the target
    sleep 4

    # Target should be dead
    run kill -0 "$victim_pid"
    assert_failure

    stop_write_heartbeat 2>/dev/null || true
    wait "$victim_pid" 2>/dev/null || true
}

@test "was_write_heartbeat_timeout returns true after monitor timeout" {
    export _HEARTBEAT_TIMEOUT_SECS_OVERRIDE=2
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 1 1

    sleep 4

    run was_write_heartbeat_timeout
    assert_success

    stop_write_heartbeat 2>/dev/null || true
}

# ===========================================================================
# File detection
# ===========================================================================

@test "monitor detects file modification and does not timeout" {
    export _HEARTBEAT_TIMEOUT_SECS_OVERRIDE=4
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 1 1

    # Create a file (sleep 1s to ensure different FS timestamp than marker)
    sleep 1.2
    touch "$PROJECT_DIR/new_file.txt"

    # Wait past the timeout period
    sleep 4

    stop_write_heartbeat

    # Should NOT have timed out because the file was detected
    refute [ -f "$RALPH_DIR/.write_heartbeat_triggered" ]
}

@test "monitor creates seen marker when file detected" {
    export _HEARTBEAT_TIMEOUT_SECS_OVERRIDE=10
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 1 1

    # Create a file in the project directory (sleep 1s to ensure different
    # filesystem timestamp than the heartbeat marker — some FS have 1s granularity)
    sleep 1.2
    touch "$PROJECT_DIR/some_source_file.ts"

    # Wait for the monitor to detect it (needs at least 1 check_interval cycle)
    _wait_for_file "$RALPH_DIR/.write_heartbeat_seen" 25

    # Assert BEFORE stop (stop cleans up .write_heartbeat_seen)
    assert [ -f "$RALPH_DIR/.write_heartbeat_seen" ]

    stop_write_heartbeat
}

# ===========================================================================
# Excluded directories
# ===========================================================================

@test "monitor ignores files in excluded directories" {
    export _HEARTBEAT_TIMEOUT_SECS_OVERRIDE=2
    start_write_heartbeat "$PROJECT_DIR" "$TARGET_PID" 1 1

    # Create files only in excluded directories
    mkdir -p "$PROJECT_DIR/node_modules/pkg"
    mkdir -p "$PROJECT_DIR/.git/objects"
    sleep 0.5
    touch "$PROJECT_DIR/node_modules/pkg/index.js"
    touch "$PROJECT_DIR/.git/objects/abc123"

    # Wait for timeout to fire
    sleep 4

    stop_write_heartbeat 2>/dev/null || true

    # Should have timed out — excluded files don't count
    assert [ -f "$RALPH_DIR/.write_heartbeat_triggered" ]
}

# ===========================================================================
# Cleanup: monitor exits when target PID dies
# ===========================================================================

@test "monitor exits when target PID dies" {
    # Create a dedicated target for this test
    sleep 600 &
    local target=$!

    export _HEARTBEAT_TIMEOUT_SECS_OVERRIDE=60
    start_write_heartbeat "$PROJECT_DIR" "$target" 1 1

    local monitor_pid
    monitor_pid=$(cat "$RALPH_DIR/.write_heartbeat_pid")

    # Kill the target process
    kill "$target" 2>/dev/null
    wait "$target" 2>/dev/null || true

    # Give the monitor time to notice (next check_interval iteration)
    sleep 3

    # Monitor should have exited
    run kill -0 "$monitor_pid"
    assert_failure
}

# ===========================================================================
# RALPH_DIR guard
# ===========================================================================

@test "stop_write_heartbeat fails when RALPH_DIR is unset" {
    unset RALPH_DIR
    run stop_write_heartbeat
    assert_failure
    assert_output --partial "RALPH_DIR is not set"
}

@test "was_write_heartbeat_timeout fails when RALPH_DIR is unset" {
    unset RALPH_DIR
    run was_write_heartbeat_timeout
    assert_failure
    assert_output --partial "RALPH_DIR is not set"
}
