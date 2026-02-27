#!/usr/bin/env bats
# Tests for ralph/lib/response_analyzer.sh
# Validates JSON parsing (3 formats), text fallback, and session management.

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/response_analyzer.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# detect_output_format
# ===========================================================================

@test "detect_output_format identifies JSON object" {
    run detect_output_format "$FIXTURES_DIR/flat_response.json"
    assert_output "json"
}

@test "detect_output_format identifies JSON array" {
    run detect_output_format "$FIXTURES_DIR/cli_array_response.json"
    assert_output "json"
}

@test "detect_output_format identifies text file" {
    run detect_output_format "$FIXTURES_DIR/text_response_complete.txt"
    assert_output "text"
}

@test "detect_output_format returns text for missing file" {
    run detect_output_format "/nonexistent/file"
    assert_output "text"
}

@test "detect_output_format returns text for empty file" {
    local empty_file="$RALPH_DIR/empty.txt"
    touch "$empty_file"

    run detect_output_format "$empty_file"
    assert_output "text"
}

@test "detect_output_format returns text for invalid JSON" {
    local bad_json="$RALPH_DIR/bad.json"
    echo '{ broken json' > "$bad_json"

    run detect_output_format "$bad_json"
    assert_output "text"
}

# ===========================================================================
# parse_json_response — flat format
# ===========================================================================

@test "parse_json_response parses flat format status" {
    local result="$RALPH_DIR/result.json"

    run parse_json_response "$FIXTURES_DIR/flat_response.json" "$result"
    assert_success

    run jq -r '.status' "$result"
    assert_output "COMPLETE"
}

@test "parse_json_response parses flat format exit_signal" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/flat_response.json" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"
}

@test "parse_json_response parses flat format files_modified" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/flat_response.json" "$result"

    run jq -r '.files_modified' "$result"
    assert_output "3"
}

@test "parse_json_response sets has_completion_signal from status COMPLETE" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/flat_response.json" "$result"

    run jq -r '.has_completion_signal' "$result"
    assert_output "true"
}

@test "parse_json_response parses in-progress response" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/flat_response_in_progress.json" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "false"

    run jq -r '.has_completion_signal' "$result"
    assert_output "false"
}

# ===========================================================================
# parse_json_response — CLI object format
# ===========================================================================

@test "parse_json_response parses CLI object with RALPH_STATUS" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cli_object_response.json" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"

    run jq -r '.session_id' "$result"
    assert_output "session-abc-123"
}

@test "parse_json_response extracts files_changed from metadata" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cli_object_response.json" "$result"

    run jq -r '.files_modified' "$result"
    assert_output "5"
}

@test "parse_json_response respects explicit EXIT_SIGNAL false" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cli_object_exit_false.json" "$result"

    # EXIT_SIGNAL: false means "task done, keep working on next task"
    run jq -r '.exit_signal' "$result"
    assert_output "false"
}

# ===========================================================================
# parse_json_response — CLI array format
# ===========================================================================

@test "parse_json_response parses CLI array format" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cli_array_response.json" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"
}

@test "parse_json_response extracts session_id from array init message" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cli_array_response.json" "$result"

    run jq -r '.session_id' "$result"
    assert_output "session-xyz-789"
}

@test "parse_json_response handles array without init message" {
    local no_init="$RALPH_DIR/no_init.json"
    cat > "$no_init" << 'EOF'
[
    {"type": "assistant", "content": "Working..."},
    {"type": "result", "result": "Done.", "sessionId": "session-from-result"}
]
EOF

    local result="$RALPH_DIR/result.json"
    parse_json_response "$no_init" "$result"

    run jq -r '.session_id' "$result"
    assert_output "session-from-result"
}

# ===========================================================================
# parse_json_response — permission denials
# ===========================================================================

@test "parse_json_response detects permission denials" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/permission_denials.json" "$result"

    run jq -r '.has_permission_denials' "$result"
    assert_output "true"

    run jq -r '.permission_denial_count' "$result"
    assert_output "2"
}

@test "parse_json_response extracts denied command names" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/permission_denials.json" "$result"

    # First denial is a Bash command, second is AskUserQuestion
    run jq -r '.denied_commands[0]' "$result"
    assert_output --partial "Bash("

    run jq -r '.denied_commands[1]' "$result"
    assert_output "AskUserQuestion"
}

# ===========================================================================
# parse_json_response — error handling
# ===========================================================================

@test "parse_json_response fails for missing file" {
    run parse_json_response "/nonexistent/file" "$RALPH_DIR/result.json"
    assert_failure
}

@test "parse_json_response fails for invalid JSON" {
    local bad="$RALPH_DIR/bad.json"
    echo '{ broken' > "$bad"

    run parse_json_response "$bad" "$RALPH_DIR/result.json"
    assert_failure
}

# ===========================================================================
# analyze_response — JSON path
# ===========================================================================

@test "analyze_response processes JSON format with high confidence" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/flat_response.json" 5 "$analysis"
    assert_success

    run jq -r '.output_format' "$analysis"
    assert_output "json"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "true"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "true"
}

# ===========================================================================
# analyze_response — text fallback
# ===========================================================================

@test "analyze_response detects completion keywords in text" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/text_response_complete.txt" 1 "$analysis"
    assert_success

    run jq -r '.output_format' "$analysis"
    assert_output "text"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "true"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "true"
}

@test "analyze_response detects test-only loop in text" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/text_response_test_only.txt" 1 "$analysis"
    assert_success

    run jq -r '.analysis.is_test_only' "$analysis"
    assert_output "true"
}

@test "analyze_response test-only text has no completion signal" {
    # Use inline text without completion keywords (fixture has "completed" which triggers heuristic)
    local test_file="$RALPH_DIR/pure_test.txt"
    printf 'Running tests for the auth module.\nnpm test\nAll 42 test suites passed.\n' > "$test_file"

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$test_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response detects stuck/error patterns in text" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/text_response_stuck.txt" 1 "$analysis"
    assert_success

    run jq -r '.analysis.is_stuck' "$analysis"
    assert_output "true"

    # Stuck response should not signal exit
    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response stuck text has no completion signal" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/text_response_stuck.txt" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response detects nothing-to-do patterns" {
    local nothing_file="$RALPH_DIR/nothing.txt"
    echo "There is nothing to do. All items are already implemented." > "$nothing_file"

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$nothing_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "true"
}

@test "analyze_response respects explicit RALPH_STATUS in text" {
    _skip_if_xargs_broken  # RALPH_STATUS parsing uses xargs for trimming
    local status_file="$RALPH_DIR/ralph_status.txt"
    cat > "$status_file" << 'EOF'
Working on the implementation...

---RALPH_STATUS---
STATUS: COMPLETE
EXIT_SIGNAL: true
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "true"

    # Confidence is 100 from explicit RALPH_STATUS, but git state in CWD
    # may add +20, so check >= 100 rather than exact value
    local score
    score=$(jq -r '.analysis.confidence_score' "$analysis")
    [[ "$score" -ge 100 ]]
}

@test "analyze_response respects EXIT_SIGNAL false in text" {
    _skip_if_xargs_broken  # RALPH_STATUS parsing uses xargs for trimming
    local status_file="$RALPH_DIR/continue.txt"
    cat > "$status_file" << 'EOF'
Story 1 is complete.

---RALPH_STATUS---
STATUS: COMPLETE
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    # Explicit EXIT_SIGNAL: false overrides heuristic completion detection
    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response tracks output length" {
    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$FIXTURES_DIR/text_response_complete.txt" 1 "$analysis"
    assert_success

    assert [ -f "$RALPH_DIR/.last_output_length" ]
    local saved_length
    saved_length=$(cat "$RALPH_DIR/.last_output_length")
    [[ "$saved_length" -gt 0 ]]
}

@test "analyze_response boosts confidence when output declines" {
    # Pre-set a large baseline output length
    echo "10000" > "$RALPH_DIR/.last_output_length"

    # Create a short text file (well under 50% of 10000 chars)
    local short_file="$RALPH_DIR/short_output.txt"
    echo "Still processing the request." > "$short_file"

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$short_file" 2 "$analysis"
    assert_success

    # Confidence should include +10 from output length decline.
    # Git state in CWD may add +20, so check >= 10 rather than exact value.
    local score
    score=$(jq -r '.analysis.confidence_score' "$analysis")
    [[ "$score" -ge 10 ]]
}

# ===========================================================================
# Session management
# ===========================================================================

@test "store_session_id and get_last_session_id round-trip" {
    store_session_id "session-roundtrip-42"

    run get_last_session_id
    assert_output "session-roundtrip-42"
}

@test "get_last_session_id returns empty when no session file" {
    run get_last_session_id
    assert_output ""
}

@test "store_session_id fails for empty id" {
    run store_session_id ""
    assert_failure
}

@test "should_resume_session returns true for fresh session" {
    store_session_id "session-fresh"

    run should_resume_session
    assert_output "true"
    assert_success
}

@test "should_resume_session returns false for expired session" {
    local old_time
    old_time=$(_minutes_ago_iso $((25 * 60)))  # 25 hours ago

    jq -n --arg sid "session-expired" --arg ts "$old_time" \
        '{session_id: $sid, timestamp: $ts}' > "$SESSION_FILE"

    run should_resume_session
    assert_output "false"
    assert_failure
}

@test "should_resume_session returns false when no session file" {
    run should_resume_session
    assert_output "false"
    assert_failure
}

@test "should_resume_session returns false at exactly 24h boundary" {
    local boundary_time
    boundary_time=$(_minutes_ago_iso $((24 * 60)))  # exactly 24 hours ago

    jq -n --arg sid "session-boundary" --arg ts "$boundary_time" \
        '{session_id: $sid, timestamp: $ts}' > "$SESSION_FILE"

    run should_resume_session
    assert_output "false"
    assert_failure
}

@test "should_resume_session returns true at 23h59m" {
    local almost_time
    almost_time=$(_minutes_ago_iso $((23 * 60 + 59)))  # 23h59m ago

    jq -n --arg sid "session-almost" --arg ts "$almost_time" \
        '{session_id: $sid, timestamp: $ts}' > "$SESSION_FILE"

    run should_resume_session
    assert_output "true"
    assert_success
}

# ===========================================================================
# update_exit_signals
# ===========================================================================

@test "update_exit_signals tracks test-only loops" {
    local analysis="$RALPH_DIR/.response_analysis"
    local signals="$RALPH_DIR/.exit_signals"

    # Create analysis result with is_test_only=true
    jq -n '{loop_number: 1, analysis: {is_test_only: true, has_completion_signal: false, has_progress: false, exit_signal: false}}' \
        > "$analysis"

    run update_exit_signals "$analysis" "$signals"
    assert_success

    run jq '.test_only_loops | length' "$signals"
    assert_output "1"
}

@test "update_exit_signals tracks completion signals" {
    local analysis="$RALPH_DIR/.response_analysis"
    local signals="$RALPH_DIR/.exit_signals"

    jq -n '{loop_number: 3, analysis: {is_test_only: false, has_completion_signal: true, has_progress: true, exit_signal: true}}' \
        > "$analysis"

    run update_exit_signals "$analysis" "$signals"
    assert_success

    run jq '.done_signals | length' "$signals"
    assert_output "1"

    run jq '.completion_indicators | length' "$signals"
    assert_output "1"
}

@test "update_exit_signals keeps rolling window of 5" {
    local analysis="$RALPH_DIR/.response_analysis"
    local signals="$RALPH_DIR/.exit_signals"

    for i in 1 2 3 4 5 6 7; do
        jq -n --argjson ln "$i" \
            '{loop_number: $ln, analysis: {is_test_only: true, has_completion_signal: false, has_progress: false, exit_signal: false}}' \
            > "$analysis"
        update_exit_signals "$analysis" "$signals"
    done

    run jq '.test_only_loops | length' "$signals"
    assert_output "5"
}

# ===========================================================================
# detect_stuck_loop
# ===========================================================================

@test "detect_stuck_loop returns not-stuck when no history files exist" {
    local current="$RALPH_DIR/current.txt"
    echo "Error: something broke" > "$current"

    run detect_stuck_loop "$current" "$RALPH_DIR/logs"
    assert_failure  # exit code 1 = not stuck
}

@test "detect_stuck_loop returns not-stuck when current output has no errors" {
    # Create history files with errors
    echo "Error: old problem" > "$RALPH_DIR/logs/claude_output_1.log"
    echo "Error: old problem" > "$RALPH_DIR/logs/claude_output_2.log"
    echo "Error: old problem" > "$RALPH_DIR/logs/claude_output_3.log"

    local current="$RALPH_DIR/current.txt"
    echo "Everything is working fine." > "$current"

    run detect_stuck_loop "$current" "$RALPH_DIR/logs"
    assert_failure  # exit code 1 = not stuck (no errors in current)
}

@test "detect_stuck_loop detects repeated errors across history" {
    # All history files have the same errors as current output
    for i in 1 2 3; do
        cp "$FIXTURES_DIR/text_response_stuck.txt" "$RALPH_DIR/logs/claude_output_${i}.log"
    done

    run detect_stuck_loop "$FIXTURES_DIR/text_response_stuck.txt" "$RALPH_DIR/logs"
    assert_success  # exit code 0 = stuck on same errors
}

@test "detect_stuck_loop returns not-stuck when errors differ across history" {
    # History files with different errors than current
    echo "Error: connection refused" > "$RALPH_DIR/logs/claude_output_1.log"
    echo "Error: timeout exceeded" > "$RALPH_DIR/logs/claude_output_2.log"
    echo "Error: permission denied" > "$RALPH_DIR/logs/claude_output_3.log"

    local current="$RALPH_DIR/current.txt"
    echo "Error: out of memory" > "$current"

    run detect_stuck_loop "$current" "$RALPH_DIR/logs"
    assert_failure  # exit code 1 = not stuck (different errors)
}

# ===========================================================================
# log_analysis_summary
# ===========================================================================

@test "log_analysis_summary outputs key fields from analysis file" {
    cat > "$RALPH_DIR/.response_analysis" << 'JSON'
{
    "loop_number": 5,
    "analysis": {
        "exit_signal": false,
        "confidence_score": 35,
        "is_test_only": false,
        "files_modified": 3,
        "work_summary": "Implemented authentication module"
    }
}
JSON
    run log_analysis_summary "$RALPH_DIR/.response_analysis"
    assert_success
    assert_output --partial "Loop #5"
    assert_output --partial "3"
}

@test "log_analysis_summary returns 1 when file missing" {
    run log_analysis_summary "$RALPH_DIR/nonexistent.json"
    assert_failure
}
