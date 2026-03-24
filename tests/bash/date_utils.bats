#!/usr/bin/env bats
# Tests for ralph/lib/date_utils.sh
# Validates cross-platform date formatting and parsing.

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/date_utils.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# get_iso_timestamp
# ===========================================================================

@test "get_iso_timestamp returns valid ISO 8601 format" {
    run get_iso_timestamp
    assert_success
    # Match YYYY-MM-DDTHH:MM:SS with timezone
    assert_output --regexp '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
}

@test "get_iso_timestamp returns current year" {
    run get_iso_timestamp
    assert_success
    # Should start with 202x (current decade)
    assert_output --regexp '^202[0-9]-'
}

# ===========================================================================
# get_epoch_seconds
# ===========================================================================

@test "get_epoch_seconds returns numeric value" {
    run get_epoch_seconds
    assert_success
    assert_output --regexp '^[0-9]+$'
}

@test "get_epoch_seconds returns reasonable epoch" {
    run get_epoch_seconds
    assert_success
    # Should be after 2024-01-01 (1704067200)
    [[ "$output" -gt 1704067200 ]]
}

# ===========================================================================
# parse_iso_to_epoch
# ===========================================================================

@test "parse_iso_to_epoch handles UTC ISO timestamp" {
    run parse_iso_to_epoch "2026-01-15T10:30:00+00:00"
    assert_success
    assert_output --regexp '^[0-9]+$'
    # 2026-01-15T10:30:00Z ≈ 1768479000 (should be in that range)
    [[ "$output" -gt 1700000000 ]]
}

@test "parse_iso_to_epoch handles Z suffix" {
    run parse_iso_to_epoch "2026-06-01T00:00:00Z"
    assert_success
    assert_output --regexp '^[0-9]+$'
}

@test "parse_iso_to_epoch returns current epoch for null input" {
    local now
    now=$(date +%s)

    run parse_iso_to_epoch "null"
    assert_success
    assert_output --regexp '^[0-9]+$'
    # Should be within 2 seconds of current time
    local diff=$(( output - now ))
    [[ ${diff#-} -lt 2 ]]
}

@test "parse_iso_to_epoch returns current epoch for empty input" {
    local now
    now=$(date +%s)

    run parse_iso_to_epoch ""
    assert_success
    assert_output --regexp '^[0-9]+$'
    local diff=$(( output - now ))
    [[ ${diff#-} -lt 2 ]]
}

@test "parse_iso_to_epoch round-trips with get_iso_timestamp" {
    local iso
    iso=$(get_iso_timestamp)

    local before
    before=$(date +%s)

    run parse_iso_to_epoch "$iso"
    assert_success

    local after
    after=$(date +%s)

    # Parsed epoch should be between before and after
    [[ "$output" -ge "$((before - 1))" ]]
    [[ "$output" -le "$((after + 1))" ]]
}

# ===========================================================================
# parse_iso_to_epoch_strict
# ===========================================================================

@test "parse_iso_to_epoch_strict handles millisecond ISO timestamps" {
    run parse_iso_to_epoch_strict "2025-01-01T00:00:00.000Z"
    assert_success
    assert_output --regexp '^[0-9]+$'
}

@test "parse_iso_to_epoch_strict fails for invalid timestamps" {
    run parse_iso_to_epoch_strict "not-a-date"
    assert_failure
}

# ===========================================================================
# get_next_hour_time
# ===========================================================================

@test "get_next_hour_time returns HH:MM:SS format" {
    run get_next_hour_time
    assert_success
    assert_output --regexp '^[0-9]{2}:[0-9]{2}:[0-9]{2}$'
}

# ===========================================================================
# get_basic_timestamp
# ===========================================================================

@test "get_basic_timestamp returns YYYY-MM-DD HH:MM:SS format" {
    run get_basic_timestamp
    assert_success
    assert_output --regexp '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
}
