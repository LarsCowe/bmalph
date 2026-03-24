#!/usr/bin/env bats
# Tests for ralph/drivers/claude-code.sh
# Validates CLI binary, tool list, and command assembly for Claude Code.

setup() {
    load '../test_helper/common-setup'
    _common_setup
    source "$RALPH_DRIVERS/claude-code.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# Driver identification
# ===========================================================================

@test "driver_cli_binary returns claude" {
    run driver_cli_binary
    assert_output "claude"
}

@test "driver_name returns claude-code" {
    run driver_name
    assert_output "claude-code"
}

@test "driver_display_name returns Claude Code" {
    run driver_display_name
    assert_output "Claude Code"
}

@test "driver_min_version returns semver string" {
    run driver_min_version
    assert_success
    assert_output --regexp '^[0-9]+\.[0-9]+\.[0-9]+$'
}

# ===========================================================================
# driver_valid_tools
# ===========================================================================

@test "driver_valid_tools includes core tool names" {
    driver_valid_tools

    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " Write " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " Read " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " Edit " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " EnterPlanMode " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " ExitPlanMode " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " Bash " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " Grep " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " Glob " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " Task " ]]
}

@test "driver_valid_tools includes bash glob patterns" {
    driver_valid_tools

    local found_git=false
    for tool in "${VALID_TOOL_PATTERNS[@]}"; do
        if [[ "$tool" == "Bash(git *)" ]]; then
            found_git=true
            break
        fi
    done
    [[ "$found_git" == "true" ]]
}

@test "driver_permission_denial_help distinguishes permission mode from allowed tools" {
    RALPHRC_FILE="$RALPH_DIR/.ralphrc"

    run driver_permission_denial_help

    assert_success
    assert_output --partial "CLAUDE_PERMISSION_MODE=bypassPermissions"
    assert_output --partial "ALLOWED_TOOLS"
    assert_output --partial "will not fix it"
    assert_output --partial "--reset-session"
    assert_output --partial "bmalph run"
}

# ===========================================================================
# driver_build_command
# ===========================================================================

@test "driver_build_command assembles basic command" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement the authentication module" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    [[ "${CLAUDE_CMD_ARGS[0]}" == "claude" ]]
    # Should have -p flag with prompt content
    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "-p" ]]
    [[ "$args_str" =~ "Implement the authentication module" ]]
}

@test "driver_build_command adds output format json" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT="json"
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_PERMISSION_MODE=""
    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--output-format json" ]]
}

@test "driver_build_command defaults permission mode to bypassPermissions" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_PERMISSION_MODE=""
    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--permission-mode bypassPermissions" ]]
}

@test "driver_build_command passes configured permission mode" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_PERMISSION_MODE="dontAsk"
    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--permission-mode dontAsk" ]]
}

@test "driver_build_command adds allowed tools" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS="Write,Read,Bash"
    export CLAUDE_PERMISSION_MODE=""
    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--allowedTools" ]]
    [[ "$args_str" =~ "Write" ]]
    [[ "$args_str" =~ "Read" ]]
    [[ "$args_str" =~ "Bash" ]]
}

@test "driver_build_command adds resume with session id" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_PERMISSION_MODE=""
    export CLAUDE_USE_CONTINUE="true"

    driver_build_command "$prompt_file" "" "session-abc-123"

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--resume session-abc-123" ]]
}

@test "driver_build_command omits resume without session id" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_PERMISSION_MODE=""
    export CLAUDE_USE_CONTINUE="true"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ ! "$args_str" =~ "--resume" ]]
}

@test "driver_build_command omits resume when continue disabled" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_PERMISSION_MODE=""
    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" "session-abc-123"

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ ! "$args_str" =~ "--resume" ]]
}

@test "driver_build_command adds system prompt with context" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_OUTPUT_FORMAT=""
    export CLAUDE_ALLOWED_TOOLS=""
    export CLAUDE_PERMISSION_MODE=""
    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "Loop 3 context: 2 files changed" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--append-system-prompt" ]]
    [[ "$args_str" =~ "Loop 3 context" ]]
}

@test "driver_build_command fails with missing prompt file" {
    run driver_build_command "/nonexistent/prompt.md" "" ""
    assert_failure
}

# ===========================================================================
# driver_supports_sessions
# ===========================================================================

@test "driver_supports_sessions returns true" {
    run driver_supports_sessions
    assert_success
}

# ===========================================================================
# driver_stream_filter
# ===========================================================================

@test "driver_stream_filter returns jq expression" {
    run driver_stream_filter
    assert_success
    assert_output --partial "stream_event"
    assert_output --partial "content_block_delta"
}
