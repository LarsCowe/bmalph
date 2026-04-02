#!/usr/bin/env bats
# Tests for ralph/lib/metrics.sh
# Validates append-only JSONL loop performance metrics (#129)

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/date_utils.sh"
    source "$RALPH_LIB/circuit_breaker.sh"
    source "$RALPH_LIB/metrics.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# init_metrics
# ===========================================================================

@test "init_metrics sets METRICS_RUN_ID to a non-empty ISO timestamp" {
    init_metrics

    assert [ -n "$METRICS_RUN_ID" ]
    # Verify it looks like an ISO timestamp (starts with YYYY-)
    [[ "$METRICS_RUN_ID" =~ ^[0-9]{4}- ]]
}

@test "init_metrics does not change METRICS_RUN_ID on second call" {
    init_metrics
    local first_id="$METRICS_RUN_ID"

    sleep 1
    init_metrics
    assert_equal "$METRICS_RUN_ID" "$first_id"
}

# ===========================================================================
# append_loop_metrics — file creation and format
# ===========================================================================

@test "append_loop_metrics creates metrics file on first call" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 3 false false "success"

    assert [ -f "$METRICS_FILE" ]
}

@test "append_loop_metrics writes valid JSON per line" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 2 false false "success"

    # Each line must be valid JSON
    while IFS= read -r line; do
        run jq -e '.' <<< "$line"
        assert_success
    done < "$METRICS_FILE"
}

@test "append_loop_metrics appends multiple records" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 2 false false "success"
    append_loop_metrics 2 5 false false "success"
    append_loop_metrics 3 0 true false "error"

    local line_count
    line_count=$(wc -l < "$METRICS_FILE")
    assert_equal "$line_count" "3"

    # Each line is valid JSON
    run jq -c '.' "$METRICS_FILE"
    assert_success
}

# ===========================================================================
# append_loop_metrics — field correctness
# ===========================================================================

@test "append_loop_metrics includes all required fields" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 5 false true "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    # Check all required fields exist
    local required_fields=(
        run_id loop timestamp driver session_id loop_outcome
        duration_ms duration_api_ms input_tokens output_tokens
        cache_read_tokens cache_creation_tokens total_cost_usd num_turns
        files_changed reported_files_modified has_errors exit_signal
        was_read_only_timeout quality_gate_result has_permission_denials
        circuit_breaker_state
    )

    for field in "${required_fields[@]}"; do
        run jq -e "has(\"$field\")" <<< "$record"
        assert_success "missing field: $field"
    done
}

@test "append_loop_metrics records correct loop number and outcome" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 7 3 false false "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.loop' <<< "$record"
    assert_output "7"

    run jq -r '.loop_outcome' <<< "$record"
    assert_output "success"
}

@test "append_loop_metrics records files_changed and has_errors" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 12 true false "error"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.files_changed' <<< "$record"
    assert_output "12"

    run jq -r '.has_errors' <<< "$record"
    assert_output "true"
}

@test "append_loop_metrics records exit_signal" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 0 false true "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.exit_signal' <<< "$record"
    assert_output "true"
}

@test "append_loop_metrics preserves run_id across calls" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 0 false false "success"
    append_loop_metrics 2 0 false false "success"

    local run_id_1 run_id_2
    run_id_1=$(sed -n '1p' "$METRICS_FILE" | jq -r '.run_id')
    run_id_2=$(sed -n '2p' "$METRICS_FILE" | jq -r '.run_id')

    assert_equal "$run_id_1" "$run_id_2"
    assert [ -n "$run_id_1" ]
}

@test "append_loop_metrics records quality_gate_result when provided" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 0 false false "success" "2"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.quality_gate_result' <<< "$record"
    assert_output "2"
}

@test "append_loop_metrics records null quality_gate_result by default" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 0 false false "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.quality_gate_result' <<< "$record"
    assert_output "null"
}

# ===========================================================================
# append_loop_metrics — usage data from .response_analysis
# ===========================================================================

@test "append_loop_metrics extracts usage data from response analysis" {
    init_metrics
    init_circuit_breaker

    # Create mock response analysis with usage data
    jq -n '{
        analysis: {
            input_tokens: 45000,
            output_tokens: 12000,
            cache_read_tokens: 30000,
            cache_creation_tokens: 5000,
            total_cost_usd: 0.42,
            duration_ms: 142000,
            duration_api_ms: 138000,
            num_turns: 3,
            files_modified: 8,
            has_permission_denials: false,
            session_id: "session-abc"
        }
    }' > "$RALPH_DIR/.response_analysis"

    append_loop_metrics 1 5 false false "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq '.input_tokens' <<< "$record"
    assert_output "45000"

    run jq '.output_tokens' <<< "$record"
    assert_output "12000"

    run jq '.cache_read_tokens' <<< "$record"
    assert_output "30000"

    run jq '.cache_creation_tokens' <<< "$record"
    assert_output "5000"

    run jq '.total_cost_usd' <<< "$record"
    assert_output "0.42"

    run jq '.duration_ms' <<< "$record"
    assert_output "142000"

    run jq '.duration_api_ms' <<< "$record"
    assert_output "138000"

    run jq '.num_turns' <<< "$record"
    assert_output "3"

    run jq '.reported_files_modified' <<< "$record"
    assert_output "8"

    run jq -r '.session_id' <<< "$record"
    assert_output "session-abc"
}

@test "append_loop_metrics handles missing response analysis gracefully" {
    init_metrics
    init_circuit_breaker

    # No .response_analysis file exists
    rm -f "$RALPH_DIR/.response_analysis"

    append_loop_metrics 1 0 false false "success"

    assert [ -f "$METRICS_FILE" ]

    local record
    record=$(head -1 "$METRICS_FILE")

    # Usage fields should be null
    run jq '.input_tokens' <<< "$record"
    assert_output "null"

    run jq '.output_tokens' <<< "$record"
    assert_output "null"

    run jq '.total_cost_usd' <<< "$record"
    assert_output "null"

    run jq '.duration_ms' <<< "$record"
    assert_output "null"
}

# ===========================================================================
# append_loop_metrics — circuit breaker state
# ===========================================================================

@test "append_loop_metrics reads circuit breaker state" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 1 0 false false "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.circuit_breaker_state' <<< "$record"
    assert_output "CLOSED"
}

@test "append_loop_metrics reads HALF_OPEN circuit breaker state" {
    init_metrics
    init_circuit_breaker

    # Force HALF_OPEN state
    jq '.state = "HALF_OPEN"' "$CB_STATE_FILE" > "$CB_STATE_FILE.tmp"
    mv "$CB_STATE_FILE.tmp" "$CB_STATE_FILE"

    append_loop_metrics 1 0 false false "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.circuit_breaker_state' <<< "$record"
    assert_output "HALF_OPEN"
}

@test "append_loop_metrics handles missing circuit breaker state" {
    init_metrics

    # No circuit breaker state file
    rm -f "$RALPH_DIR/.circuit_breaker_state"

    append_loop_metrics 1 0 false false "success"

    assert [ -f "$METRICS_FILE" ]

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.circuit_breaker_state' <<< "$record"
    assert_output "UNKNOWN"
}

# ===========================================================================
# append_loop_metrics — loop outcome variants
# ===========================================================================

@test "append_loop_metrics records read_only_timeout outcome" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 3 0 false false "read_only_timeout"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.loop_outcome' <<< "$record"
    assert_output "read_only_timeout"

    run jq -r '.was_read_only_timeout' <<< "$record"
    assert_output "true"
}

@test "append_loop_metrics records circuit_breaker_trip outcome" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 5 0 false false "circuit_breaker_trip"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.loop_outcome' <<< "$record"
    assert_output "circuit_breaker_trip"
}

@test "append_loop_metrics records error outcome" {
    init_metrics
    init_circuit_breaker

    append_loop_metrics 2 0 true false "error"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.loop_outcome' <<< "$record"
    assert_output "error"
}

# ===========================================================================
# append_loop_metrics — safety / never fails
# ===========================================================================

@test "append_loop_metrics never fails even with read-only RALPH_DIR" {
    init_metrics
    init_circuit_breaker

    # Make logs dir read-only to simulate write failure
    chmod 444 "$RALPH_DIR/logs"

    run append_loop_metrics 1 0 false false "success"
    assert_success

    # Restore permissions for teardown cleanup
    chmod 755 "$RALPH_DIR/logs"
}

# ===========================================================================
# append_loop_metrics — driver field
# ===========================================================================

@test "append_loop_metrics records driver from PLATFORM_DRIVER" {
    init_metrics
    init_circuit_breaker

    PLATFORM_DRIVER="codex"
    append_loop_metrics 1 0 false false "success"

    local record
    record=$(head -1 "$METRICS_FILE")

    run jq -r '.driver' <<< "$record"
    assert_output "codex"
}
