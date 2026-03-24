#!/usr/bin/env bats
# Tests for ralph/drivers/opencode.sh
# Validates CLI binary, command assembly, session fallback, and live-stream support.

setup() {
    load '../test_helper/common-setup'
    _common_setup
    source "$RALPH_DRIVERS/opencode.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# Driver identification
# ===========================================================================

@test "driver_cli_binary returns opencode" {
    run driver_cli_binary
    assert_output "opencode"
}

@test "driver_name returns opencode" {
    run driver_name
    assert_output "opencode"
}

@test "driver_display_name returns OpenCode" {
    run driver_display_name
    assert_output "OpenCode"
}

@test "driver_min_version returns semver string" {
    run driver_min_version
    assert_success
    assert_output --regexp '^[0-9]+\.[0-9]+\.[0-9]+$'
}

# ===========================================================================
# driver_valid_tools
# ===========================================================================

@test "driver_valid_tools includes OpenCode question support" {
    driver_valid_tools

    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " question " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " bash " ]]
}

# ===========================================================================
# driver_build_command
# ===========================================================================

@test "driver_build_command uses run subcommand" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement the feature" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    [[ "${CLAUDE_CMD_ARGS[0]}" == "opencode" ]]
    [[ "${CLAUDE_CMD_ARGS[1]}" == "run" ]]
}

@test "driver_build_command includes build agent and json format" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--agent build" ]]
    [[ "$args_str" =~ "--format json" ]]
}

@test "driver_build_command prepends context to prompt" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement auth module" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "Loop 2 context: progress detected" ""

    local last_arg="${CLAUDE_CMD_ARGS[${#CLAUDE_CMD_ARGS[@]}-1]}"
    [[ "$last_arg" =~ "Loop 2 context" ]]
    [[ "$last_arg" =~ "Implement auth module" ]]
}

@test "driver_build_command adds continue and session id" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="true"

    driver_build_command "$prompt_file" "" "session-opencode-456"

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--continue" ]]
    [[ "$args_str" =~ "--session session-opencode-456" ]]
}

@test "driver_build_command fails with missing prompt file" {
    run driver_build_command "/nonexistent/prompt.md" "" ""
    assert_failure
}

# ===========================================================================
# driver_supports_sessions / live output
# ===========================================================================

@test "driver_supports_sessions returns true" {
    run driver_supports_sessions
    assert_success
}

@test "driver_supports_live_output returns true" {
    run driver_supports_live_output
    assert_success
}

@test "driver_prepare_live_command keeps JSON event command unchanged" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement auth module" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""
    driver_prepare_live_command

    [[ "${LIVE_CMD_ARGS[*]}" == "${CLAUDE_CMD_ARGS[*]}" ]]
}

@test "driver_stream_filter returns OpenCode message event filter" {
    run driver_stream_filter
    assert_success
    assert_output --partial 'message.updated'
    assert_output --partial 'message.completed'
    assert_output --partial '.message.role == "assistant"'
}

# ===========================================================================
# session fallback
# ===========================================================================

@test "driver_fallback_session_id uses opencode session list" {
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/opencode" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == "session" && "$2" == "list" && "$3" == "--format" && "$4" == "json" ]]; then
    cat <<'JSON'
[{"id":"opencode-session-fallback-123"}]
JSON
    exit 0
fi
exit 1
EOF
    chmod +x "$RALPH_DIR/bin/opencode"
    export PATH="$RALPH_DIR/bin:$PATH"

    run driver_fallback_session_id "$RALPH_DIR/output.jsonl"
    assert_success
    assert_output "opencode-session-fallback-123"
}

@test "driver_fallback_session_id refuses ambiguous session lists" {
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/opencode" <<'EOF'
#!/usr/bin/env bash
if [[ "$1" == "session" && "$2" == "list" && "$3" == "--format" && "$4" == "json" ]]; then
    cat <<'JSON'
[{"id":"opencode-session-old"},{"id":"opencode-session-new"}]
JSON
    exit 0
fi
exit 1
EOF
    chmod +x "$RALPH_DIR/bin/opencode"
    export PATH="$RALPH_DIR/bin:$PATH"

    run driver_fallback_session_id "$RALPH_DIR/output.jsonl"
    assert_failure
    assert_output ""
}

@test "driver_extract_session_id_from_output reads session events directly" {
    local output_file="$RALPH_DIR/opencode-output.jsonl"
    cat > "$output_file" <<'EOF'
{"type":"session.created","session":{"id":"opencode-session-direct-123"}}
{"type":"message.updated","message":{"role":"assistant","parts":[{"type":"text","text":"Done"}]}}
EOF

    run driver_extract_session_id_from_output "$output_file"
    assert_success
    assert_output "opencode-session-direct-123"
}
