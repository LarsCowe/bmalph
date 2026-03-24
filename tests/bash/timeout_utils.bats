#!/usr/bin/env bats
# Tests for ralph/lib/timeout_utils.sh
# Validates cross-platform timeout command detection and execution.

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/timeout_utils.sh"
    reset_timeout_detection  # Clear cache for clean tests
}

teardown() {
    _common_teardown
}

# ===========================================================================
# detect_timeout_command
# ===========================================================================

@test "detect_timeout_command finds timeout binary" {
    run detect_timeout_command
    assert_success
    assert_output --regexp '^(timeout|gtimeout)$'
}

@test "detect_timeout_command caches result" {
    detect_timeout_command > /dev/null

    # Second call should return the cached value
    run detect_timeout_command
    assert_success
    assert_output --regexp '^(timeout|gtimeout)$'
}

@test "detect_timeout_command returns cached value without re-detection" {
    # Force cache to a known value
    _TIMEOUT_CMD="test_timeout"

    run detect_timeout_command
    assert_output "test_timeout"
}

# ===========================================================================
# has_timeout_command
# ===========================================================================

@test "has_timeout_command returns true on systems with timeout" {
    run has_timeout_command
    assert_success
}

# ===========================================================================
# portable_timeout
# ===========================================================================

@test "portable_timeout succeeds for fast commands" {
    run portable_timeout 5s echo "hello world"
    assert_success
    assert_output "hello world"
}

@test "portable_timeout kills on timeout expiry" {
    run portable_timeout 1s sleep 30
    # GNU timeout returns 124 on timeout
    [[ "$status" -eq 124 ]]
}

@test "portable_timeout requires duration argument" {
    run portable_timeout
    assert_failure
}

@test "portable_timeout requires command after duration" {
    run portable_timeout 5s
    assert_failure
}

@test "portable_timeout propagates command exit code" {
    run portable_timeout 5s bash -c 'exit 42'
    [[ "$status" -eq 42 ]]
}

# ===========================================================================
# reset_timeout_detection
# ===========================================================================

@test "reset_timeout_detection clears cached command" {
    detect_timeout_command > /dev/null
    [[ -n "$_TIMEOUT_CMD" ]]

    reset_timeout_detection
    [[ -z "$_TIMEOUT_CMD" ]]
}

# ===========================================================================
# get_timeout_status_message
# ===========================================================================

@test "get_timeout_status_message reports available command" {
    run get_timeout_status_message
    assert_success
    assert_output --partial "Timeout command available"
}
