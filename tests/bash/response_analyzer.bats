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
# permission denial helpers
# ===========================================================================

@test "contains_permission_denial_text matches approval refusal in the response preamble" {
    local text='Permission denied: shell command requires approval before it can run.

---RALPH_STATUS---
STATUS: BLOCKED
EXIT_SIGNAL: false
---END_RALPH_STATUS---'

    run contains_permission_denial_text "$text"
    assert_success
}

@test "contains_permission_denial_text ignores permission denied log excerpts after the first paragraph" {
    local text='Implemented the cache cleanup fix and reran the workflow successfully.

Copied prior failing log for context:
Permission denied: opening /tmp/cache.lock

---RALPH_STATUS---
STATUS: IN_PROGRESS
EXIT_SIGNAL: false
---END_RALPH_STATUS---'

    run contains_permission_denial_text "$text"
    assert_failure
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

@test "detect_output_format identifies Codex JSONL" {
    run detect_output_format "$FIXTURES_DIR/codex_jsonl_response.jsonl"
    assert_output "json"
}

@test "detect_output_format identifies Cursor stream-json output" {
    run detect_output_format "$FIXTURES_DIR/cursor_ndjson_response.jsonl"
    assert_output "json"
}

@test "detect_output_format identifies OpenCode JSON events" {
    run detect_output_format "$FIXTURES_DIR/opencode_jsonl_response.jsonl"
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

@test "parse_json_response parses Cursor JSON result object" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cursor_json_response.json" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"

    run jq -r '.session_id' "$result"
    assert_output "cursor-session-123"
}

@test "parse_json_response parses Cursor JSON result object without xargs" {
    xargs() {
        return 127
    }
    export -f xargs

    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cursor_json_response.json" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"

    run jq -r '.session_id' "$result"
    assert_output "cursor-session-123"
}

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

@test "parse_json_response extracts TASKS_COMPLETED_THIS_LOOP from embedded RALPH_STATUS JSON" {
    _skip_if_jq_missing
    local output_file="$RALPH_DIR/tasks_completed.json"
    cat > "$output_file" <<'EOF'
{
  "result": "Implemented Story 2.1.\n\n---RALPH_STATUS---\nSTATUS: IN_PROGRESS\nTASKS_COMPLETED_THIS_LOOP: 1\nEXIT_SIGNAL: false\n---END_RALPH_STATUS---",
  "sessionId": "session-progress-1",
  "metadata": {
    "files_changed": 2
  }
}
EOF

    local result="$RALPH_DIR/result.json"
    run parse_json_response "$output_file" "$result"
    assert_success

    run jq -r '.tasks_completed_this_loop' "$result"
    assert_success
    assert_output "1"
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
# parse_json_response — Codex JSONL format
# ===========================================================================

@test "parse_json_response parses Cursor stream-json events with terminal result" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cursor_ndjson_response.jsonl" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"

    run jq -r '.summary' "$result"
    assert_output --partial "Completed the auth module updates."

    run jq -r '.session_id' "$result"
    assert_output "cursor-session-123"
}

@test "parse_json_response parses Codex JSONL agent message with RALPH_STATUS" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/codex_jsonl_response.jsonl" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"

    run jq -r '.session_id' "$result"
    assert_output "codex-thread-123"
}

@test "parse_json_response joins Codex JSONL content blocks into summary" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/codex_jsonl_completion.jsonl" "$result"

    run jq -r '.summary' "$result"
    assert_output --partial "All tasks complete and ready for review."

    run jq -r '.session_id' "$result"
    assert_output "codex-thread-456"
}

@test "parse_json_response parses OpenCode JSON events with assistant message parts" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/opencode_jsonl_response.jsonl" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "true"

    run jq -r '.summary' "$result"
    assert_output --partial "Completed the OpenCode run."

    run jq -r '.session_id' "$result"
    assert_output "opencode-session-123"
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

@test "parse_json_response detects generic permission denials in Codex JSONL summaries" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/codex_jsonl_permission_denied.jsonl" "$result"

    run jq -r '.has_permission_denials' "$result"
    assert_output "true"

    run jq -r '.permission_denial_count' "$result"
    assert_output "1"
}

@test "parse_json_response ignores normal Codex summaries that mention permission errors" {
    _skip_if_xargs_broken
    local output_file="$RALPH_DIR/codex_jsonl_permission_context.jsonl"
    cat > "$output_file" <<'EOF'
{"type":"thread.started","thread_id":"codex-thread-context-1"}
{"type":"turn.started"}
{"type":"item.completed","item":{"type":"agent_message","text":"Fixed a permission denied error in the test harness and reran the suite.\n\n---RALPH_STATUS---\nSTATUS: IN_PROGRESS\nEXIT_SIGNAL: false\n---END_RALPH_STATUS---"}}
EOF

    local result="$RALPH_DIR/result.json"
    parse_json_response "$output_file" "$result"

    run jq -r '.has_permission_denials' "$result"
    assert_output "false"

    run jq -r '.permission_denial_count' "$result"
    assert_output "0"
}

@test "parse_json_response ignores quoted permission log lines after a normal summary preamble" {
    _skip_if_xargs_broken
    local output_file="$RALPH_DIR/codex_jsonl_permission_log_excerpt.jsonl"
    cat > "$output_file" <<'EOF'
{"type":"thread.started","thread_id":"codex-thread-context-2"}
{"type":"turn.started"}
{"type":"item.completed","item":{"type":"agent_message","text":"Implemented the asset pipeline fix and reran the suite successfully.\n\nCopied prior failing log for context:\nPermission denied: opening /tmp/cache.lock\n\n---RALPH_STATUS---\nSTATUS: IN_PROGRESS\nEXIT_SIGNAL: false\n---END_RALPH_STATUS---"}}
EOF

    local result="$RALPH_DIR/result.json"
    parse_json_response "$output_file" "$result"

    run jq -r '.has_permission_denials' "$result"
    assert_output "false"

    run jq -r '.permission_denial_count' "$result"
    assert_output "0"
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

@test "analyze_response infers completion from Codex JSONL agent text" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/codex_jsonl_completion.jsonl" 6 "$analysis"
    assert_success

    run jq -r '.output_format' "$analysis"
    assert_output "json"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "true"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "true"
}

@test "analyze_response parses Cursor stream-json with structured confidence" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/cursor_ndjson_response.jsonl" 6 "$analysis"
    assert_success

    run jq -r '.output_format' "$analysis"
    assert_output "json"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "true"

    run jq -r '.analysis.work_summary' "$analysis"
    assert_output --partial "Completed the auth module updates."
}

@test "analyze_response parses OpenCode JSON events with structured confidence" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/opencode_jsonl_response.jsonl" 6 "$analysis"
    assert_success

    run jq -r '.output_format' "$analysis"
    assert_output "json"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "true"

    run jq -r '.analysis.work_summary' "$analysis"
    assert_output --partial "Completed the OpenCode run."
}

@test "analyze_response does not abort on Codex JSONL without agent message" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/codex_jsonl_no_agent_message.jsonl" 7 "$analysis"
    assert_success

    assert [ -f "$analysis" ]

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "false"
}

@test "parse_json_response does not mark structured EXIT_SIGNAL false responses as completion signals" {
    _skip_if_xargs_broken
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/cli_object_exit_false.json" "$result"

    run jq -r '.has_completion_signal' "$result"
    assert_output "false"
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

@test "analyze_response does not false-positive on substring matches in text" {
    local test_file="$RALPH_DIR/substring_test.txt"
    printf 'The migration was abandoned but the incomplete feature is unfinished.\n' > "$test_file"

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$test_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"
}

@test "JSONL summary with substring matches does not trigger completion" {
    local result="$RALPH_DIR/result.json"
    parse_json_response "$FIXTURES_DIR/codex_jsonl_substring_false_positive.jsonl" "$result"

    run jq -r '.exit_signal' "$result"
    assert_output "false"

    run jq -r '.has_completion_signal' "$result"
    assert_output "false"
}

@test "analyze_response still detects whole-word multi-word completion phrases" {
    local test_file="$RALPH_DIR/multiword_test.txt"
    printf 'All tasks complete and the project is ready for review.\n' > "$test_file"

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$test_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_completion_signal' "$analysis"
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

@test "analyze_response text fallback detects explicit approval refusals" {
    local text_file="$RALPH_DIR/approval_refusal.txt"
    cat > "$text_file" <<'EOF'
Permission denied: shell command requires approval before it can run.

---RALPH_STATUS---
STATUS: BLOCKED
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$text_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_permission_denials' "$analysis"
    assert_output "true"

    run jq -r '.analysis.permission_denial_count' "$analysis"
    assert_output "1"
}

@test "analyze_response text fallback ignores normal permission-error discussion" {
    local text_file="$RALPH_DIR/permission_context.txt"
    cat > "$text_file" <<'EOF'
Implemented a fix for the permission denied failure in the asset copy test and reran the suite successfully.
No approval prompt was shown during this loop.
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$text_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_permission_denials' "$analysis"
    assert_output "false"

    run jq -r '.analysis.permission_denial_count' "$analysis"
    assert_output "0"
}

@test "analyze_response text fallback ignores pasted permission denied logs outside the preamble" {
    local text_file="$RALPH_DIR/permission_log_excerpt.txt"
    cat > "$text_file" <<'EOF'
Implemented the cache cleanup fix and reran the workflow successfully.

Previous failing log for reference:
Permission denied: opening /tmp/cache.lock

---RALPH_STATUS---
STATUS: IN_PROGRESS
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$text_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_permission_denials' "$analysis"
    assert_output "false"

    run jq -r '.analysis.permission_denial_count' "$analysis"
    assert_output "0"
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

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"
}

# === Status block trusts structured fields (skips heuristics) ===

@test "analyze_response status block skips completion keyword heuristic" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/skip_keywords.txt"
    cat > "$status_file" << 'EOF'
All tasks complete and ready for review.

---RALPH_STATUS---
STATUS: IN_PROGRESS
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response status block skips test-only heuristic" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/skip_test_only.txt"
    cat > "$status_file" << 'EOF'
Running tests for the authentication module.
npm test
jest --coverage
pytest -v

---RALPH_STATUS---
STATUS: IN_PROGRESS
TASKS_COMPLETED_THIS_LOOP: 1
TESTS_STATUS: PASSING
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.is_test_only' "$analysis"
    assert_output "false"
}

@test "analyze_response status block skips stuck heuristic" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/skip_stuck.txt"
    cat > "$status_file" << 'EOF'
Error: Cannot find module 'express'
ERROR: Build failed with exit code 1
Error: ENOENT: no such file or directory
Exception: TypeError at line 42
Fatal error: Maximum call stack size exceeded
ERROR: Compilation failed
Error: Module not found

---RALPH_STATUS---
STATUS: IN_PROGRESS
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.is_stuck' "$analysis"
    assert_output "false"
}

@test "analyze_response status block skips no-work pattern heuristic" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/skip_no_work.txt"
    cat > "$status_file" << 'EOF'
There is nothing to do for the old module, but I implemented the new feature.

---RALPH_STATUS---
STATUS: IN_PROGRESS
TASKS_COMPLETED_THIS_LOOP: 1
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "false"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response status block EXIT_SIGNAL false sets confidence >= 80" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/confidence_80.txt"
    cat > "$status_file" << 'EOF'
Working on story implementation.

---RALPH_STATUS---
STATUS: IN_PROGRESS
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    # Base confidence is 80 from structured signal; git state may add +20
    local score
    score=$(jq -r '.analysis.confidence_score' "$analysis")
    [[ "$score" -ge 80 ]]
}

@test "analyze_response status block defaults is_test_only false" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/default_test_only.txt"
    cat > "$status_file" << 'EOF'
Ran the test suite to verify stability.

---RALPH_STATUS---
STATUS: IN_PROGRESS
TASKS_COMPLETED_THIS_LOOP: 0
TESTS_STATUS: PASSING
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    # is_test_only defaults to false when status block is present
    # (not derived from tasks=0 + tests_status)
    run jq -r '.analysis.is_test_only' "$analysis"
    assert_output "false"
}

@test "analyze_response status block still extracts work summary" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/summary_with_block.txt"
    cat > "$status_file" << 'EOF'
Summary: Implemented authentication module with OAuth2 support.

---RALPH_STATUS---
STATUS: IN_PROGRESS
TASKS_COMPLETED_THIS_LOOP: 1
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    local summary
    summary=$(jq -r '.analysis.work_summary' "$analysis")
    [[ "$summary" == *"authentication"* ]]
}

@test "analyze_response status block without EXIT_SIGNAL skips heuristics" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/no_exit_signal.txt"
    cat > "$status_file" << 'EOF'
The feature is complete and all tests pass.

---RALPH_STATUS---
STATUS: IN_PROGRESS
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    # "complete" keyword in text should NOT trigger completion heuristic
    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response empty status block skips heuristics" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/empty_block.txt"
    cat > "$status_file" << 'EOF'
All tasks complete and ready for review.
Error: Cannot find module
ERROR: Build failed
Error: ENOENT
Exception: TypeError
Fatal error: stack overflow
ERROR: Compilation failed

---RALPH_STATUS---
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    # Empty but structurally valid block: defaults apply, heuristics skipped
    run jq -r '.analysis.exit_signal' "$analysis"
    assert_output "false"

    run jq -r '.analysis.is_stuck' "$analysis"
    assert_output "false"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "false"
}

@test "analyze_response status block writes last_output_length" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/output_length_block.txt"
    cat > "$status_file" << 'EOF'
Working on implementation.

---RALPH_STATUS---
STATUS: IN_PROGRESS
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 1 "$analysis"
    assert_success

    # .last_output_length must be written even when status block is present
    [[ -f "$RALPH_DIR/.last_output_length" ]]
    local length
    length=$(cat "$RALPH_DIR/.last_output_length")
    [[ "$length" -gt 0 ]]
}

@test "analyze_response status block EXIT_SIGNAL true regression" {
    _skip_if_xargs_broken
    local status_file="$RALPH_DIR/exit_true_regression.txt"
    cat > "$status_file" << 'EOF'
All work is done.

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

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_output "true"

    local score
    score=$(jq -r '.analysis.confidence_score' "$analysis")
    [[ "$score" -ge 100 ]]
}

# === End status block trusts structured fields ===

@test "analyze_response persists TASKS_COMPLETED_THIS_LOOP from JSON output" {
    _skip_if_jq_missing
    local output_file="$RALPH_DIR/tasks_completed.json"
    cat > "$output_file" <<'EOF'
{
  "result": "Implemented Story 2.1.\n\n---RALPH_STATUS---\nSTATUS: IN_PROGRESS\nTASKS_COMPLETED_THIS_LOOP: 1\nEXIT_SIGNAL: false\n---END_RALPH_STATUS---",
  "sessionId": "session-progress-2",
  "metadata": {
    "files_changed": 2
  }
}
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$output_file" 9 "$analysis"
    assert_success

    run jq -r '.analysis.tasks_completed_this_loop' "$analysis"
    assert_success
    assert_output "1"

    run jq -r '.analysis.fix_plan_completed_delta' "$analysis"
    assert_success
    assert_output "0"

    run jq -r '.analysis.has_progress_tracking_mismatch' "$analysis"
    assert_success
    assert_output "false"
}

@test "analyze_response persists TASKS_COMPLETED_THIS_LOOP from text output" {
    _skip_if_jq_missing
    local status_file="$RALPH_DIR/tasks_completed.txt"
    cat > "$status_file" <<'EOF'
Implemented Story 2.1 and updated the application code.

---RALPH_STATUS---
STATUS: IN_PROGRESS
TASKS_COMPLETED_THIS_LOOP: 1
EXIT_SIGNAL: false
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$status_file" 10 "$analysis"
    assert_success

    run jq -r '.analysis.tasks_completed_this_loop' "$analysis"
    assert_success
    assert_output "1"
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

@test "get_last_session_id reads legacy JSON session files" {
    jq -n --arg sid "legacy-session-99" --arg ts "$(_minutes_ago_iso 5)" \
        '{session_id: $sid, timestamp: $ts}' > "$SESSION_FILE"

    run get_last_session_id
    assert_output "legacy-session-99"
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

@test "analyze_response persists raw session ID for loop continuity" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/codex_jsonl_response.jsonl" 8 "$analysis"
    assert_success

    local saved
    saved=$(cat "$SESSION_FILE")
    assert_equal "$saved" "codex-thread-123"
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

@test "update_exit_signals ignores completion state from denied loops" {
    local analysis="$RALPH_DIR/.response_analysis"
    local signals="$RALPH_DIR/.exit_signals"

    echo '{"test_only_loops": [], "done_signals": [2], "completion_indicators": [2,4]}' > "$signals"
    jq -n \
        '{
            loop_number: 5,
            analysis: {
                is_test_only: false,
                has_completion_signal: true,
                has_progress: true,
                exit_signal: true,
                has_permission_denials: true
            }
        }' > "$analysis"

    run update_exit_signals "$analysis" "$signals"
    assert_success

    run jq -c '{done_signals, completion_indicators}' "$signals"
    assert_output '{"done_signals":[2],"completion_indicators":[2,4]}'
}

@test "update_exit_signals ignores completion state from progress tracking mismatches" {
    _skip_if_jq_missing
    local analysis="$RALPH_DIR/.response_analysis"
    local signals="$RALPH_DIR/.exit_signals"

    echo '{"test_only_loops": [], "done_signals": [2], "completion_indicators": [2,4]}' > "$signals"
    jq -n \
        '{
            loop_number: 6,
            analysis: {
                is_test_only: false,
                has_completion_signal: true,
                has_progress: true,
                exit_signal: true,
                has_progress_tracking_mismatch: true
            }
        }' > "$analysis"

    run update_exit_signals "$analysis" "$signals"
    assert_success

    run jq -c '{done_signals, completion_indicators}' "$signals"
    assert_success
    assert_output '{"done_signals":[2],"completion_indicators":[2,4]}'
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

# ===========================================================================
# extract_ralph_status_block_json — TESTS_STATUS parsing
# ===========================================================================

@test "extract_ralph_status_block_json parses TESTS_STATUS field" {
    local text='---RALPH_STATUS---
STATUS: IN_PROGRESS
TESTS_STATUS: FAILING
EXIT_SIGNAL: false
---END_RALPH_STATUS---'

    run extract_ralph_status_block_json "$text"
    assert_success

    local json="$output"
    run jq -r '.tests_status' <<< "$json"
    assert_output "FAILING"
}

@test "extract_ralph_status_block_json defaults tests_status to UNKNOWN when absent" {
    local text='---RALPH_STATUS---
STATUS: COMPLETE
EXIT_SIGNAL: true
---END_RALPH_STATUS---'

    run extract_ralph_status_block_json "$text"
    assert_success

    local json="$output"
    run jq -r '.tests_status' <<< "$json"
    assert_output "UNKNOWN"
}

@test "extract_ralph_status_block_json parses PASSING tests status" {
    local text='---RALPH_STATUS---
STATUS: COMPLETE
TESTS_STATUS: PASSING
EXIT_SIGNAL: true
---END_RALPH_STATUS---'

    run extract_ralph_status_block_json "$text"
    assert_success

    local json="$output"
    run jq -r '.tests_status' <<< "$json"
    assert_output "PASSING"
}

@test "analyze_response persists tests_status from JSON output" {
    _skip_if_jq_missing
    local output_file="$RALPH_DIR/tests_status_json.json"
    cat > "$output_file" <<'EOF'
{
  "result": "Ran all tests.\n\n---RALPH_STATUS---\nSTATUS: IN_PROGRESS\nTESTS_STATUS: FAILING\nEXIT_SIGNAL: false\n---END_RALPH_STATUS---",
  "sessionId": "session-tests-1",
  "metadata": {
    "files_changed": 2
  }
}
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$output_file" 4 "$analysis"
    assert_success

    run jq -r '.analysis.tests_status' "$analysis"
    assert_success
    assert_output "FAILING"
}

@test "analyze_response persists tests_status from text output" {
    _skip_if_jq_missing
    local text_file="$RALPH_DIR/tests_status_text.txt"
    cat > "$text_file" <<'EOF'
Implemented the feature and ran the test suite.

---RALPH_STATUS---
STATUS: COMPLETE
TESTS_STATUS: PASSING
EXIT_SIGNAL: true
---END_RALPH_STATUS---
EOF

    local analysis="$RALPH_DIR/.response_analysis"
    run analyze_response "$text_file" 5 "$analysis"
    assert_success

    run jq -r '.analysis.tests_status' "$analysis"
    assert_success
    assert_output "PASSING"
}

@test "analyze_response defaults tests_status to UNKNOWN when not in RALPH_STATUS" {
    local analysis="$RALPH_DIR/.response_analysis"

    run analyze_response "$FIXTURES_DIR/flat_response.json" 1 "$analysis"
    assert_success

    run jq -r '.analysis.tests_status' "$analysis"
    assert_success
    assert_output "UNKNOWN"
}
