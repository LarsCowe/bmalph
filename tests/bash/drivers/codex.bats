#!/usr/bin/env bats
# Tests for ralph/drivers/codex.sh
# Validates CLI binary, tool list, and command assembly for OpenAI Codex.

setup() {
    load '../test_helper/common-setup'
    _common_setup
    source "$RALPH_DRIVERS/codex.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# Driver identification
# ===========================================================================

@test "driver_cli_binary returns codex" {
    run driver_cli_binary
    assert_output "codex"
}

@test "driver_name returns codex" {
    run driver_name
    assert_output "codex"
}

@test "driver_display_name returns OpenAI Codex" {
    run driver_display_name
    assert_output "OpenAI Codex"
}

@test "driver_min_version returns semver string" {
    run driver_min_version
    assert_success
    assert_output --regexp '^[0-9]+\.[0-9]+\.[0-9]+$'
}

# ===========================================================================
# driver_valid_tools
# ===========================================================================

@test "driver_valid_tools has codex-specific tool names" {
    driver_valid_tools

    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " shell " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " read_file " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " write_file " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " edit_file " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " list_directory " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " search_files " ]]
}

@test "driver_valid_tools does not contain Claude Code tool names" {
    driver_valid_tools

    [[ ! " ${VALID_TOOL_PATTERNS[*]} " =~ " Write " ]]
    [[ ! " ${VALID_TOOL_PATTERNS[*]} " =~ " Read " ]]
    [[ ! " ${VALID_TOOL_PATTERNS[*]} " =~ " Bash " ]]
    [[ ! " ${VALID_TOOL_PATTERNS[*]} " =~ " Glob " ]]
}

# ===========================================================================
# driver_build_command
# ===========================================================================

@test "driver_build_command uses exec subcommand" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement the feature" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    [[ "${CLAUDE_CMD_ARGS[0]}" == "codex" ]]
    [[ "${CLAUDE_CMD_ARGS[1]}" == "exec" ]]
}

@test "driver_build_command includes json flag" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--json" ]]
}

@test "driver_build_command includes sandbox flag" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--sandbox workspace-write" ]]
}

@test "driver_build_command prepends context to prompt" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement auth module" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "Loop 2 context: progress detected" ""

    # Last arg is the combined prompt
    local last_arg="${CLAUDE_CMD_ARGS[${#CLAUDE_CMD_ARGS[@]}-1]}"
    [[ "$last_arg" =~ "Loop 2 context" ]]
    [[ "$last_arg" =~ "Implement auth module" ]]
}

@test "driver_build_command does not use --append-system-prompt" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="false"

    driver_build_command "$prompt_file" "Some context" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ ! "$args_str" =~ "--append-system-prompt" ]]
}

@test "driver_build_command adds resume with session id" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    export CLAUDE_USE_CONTINUE="true"

    driver_build_command "$prompt_file" "" "session-codex-456"

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "resume session-codex-456" ]]
    [[ ! "$args_str" =~ "--resume" ]]
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

@test "driver_stream_filter returns JSONL event filter" {
    run driver_stream_filter
    assert_success
    assert_output --partial "item.completed"
    assert_output --partial "agent_message"
    refute_output --partial 'select(.type == "message")'
}
