#!/usr/bin/env bats
# Tests for ralph/drivers/copilot.sh
# Validates CLI binary, tool list, and command assembly for GitHub Copilot CLI.

setup() {
    load '../test_helper/common-setup'
    _common_setup
    source "$RALPH_DRIVERS/copilot.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# Driver identification
# ===========================================================================

@test "driver_cli_binary returns copilot" {
    run driver_cli_binary
    assert_output "copilot"
}

@test "driver_name returns copilot" {
    run driver_name
    assert_output "copilot"
}

@test "driver_display_name returns GitHub Copilot CLI" {
    run driver_display_name
    assert_output "GitHub Copilot CLI"
}

@test "driver_min_version returns semver string" {
    run driver_min_version
    assert_success
    assert_output --regexp '^[0-9]+\.[0-9]+\.[0-9]+$'
}

# ===========================================================================
# driver_valid_tools
# ===========================================================================

@test "driver_valid_tools has copilot-specific tool names" {
    driver_valid_tools

    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " shell " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " write " ]]
}

@test "driver_valid_tools includes shell glob patterns" {
    driver_valid_tools

    local found_git=false
    local found_npm=false
    for tool in "${VALID_TOOL_PATTERNS[@]}"; do
        if [[ "$tool" == "shell(git:*)" ]]; then
            found_git=true
        fi
        if [[ "$tool" == "shell(npm:*)" ]]; then
            found_npm=true
        fi
    done
    [[ "$found_git" == "true" ]]
    [[ "$found_npm" == "true" ]]
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

@test "driver_build_command uses autopilot and yolo flags" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement the feature" > "$prompt_file"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--autopilot" ]]
    [[ "$args_str" =~ "--yolo" ]]
}

@test "driver_build_command includes max-autopilot-continues" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--max-autopilot-continues 50" ]]
}

@test "driver_build_command includes no-ask-user and strip flags" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--no-ask-user" ]]
    [[ "$args_str" =~ "-s" ]]
}

@test "driver_build_command prepends context to prompt" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement auth module" > "$prompt_file"

    driver_build_command "$prompt_file" "Loop 2 context: progress detected" ""

    # Last arg is the combined prompt
    local last_arg="${CLAUDE_CMD_ARGS[${#CLAUDE_CMD_ARGS[@]}-1]}"
    [[ "$last_arg" =~ "Loop 2 context" ]]
    [[ "$last_arg" =~ "Implement auth module" ]]
}

@test "driver_build_command ignores session id" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    driver_build_command "$prompt_file" "" "session-copilot-789"

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ ! "$args_str" =~ "--resume" ]]
}

@test "driver_build_command does not use --append-system-prompt" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    driver_build_command "$prompt_file" "Some context" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ ! "$args_str" =~ "--append-system-prompt" ]]
}

@test "driver_build_command fails with missing prompt file" {
    run driver_build_command "/nonexistent/prompt.md" "" ""
    assert_failure
}

# ===========================================================================
# driver_supports_sessions
# ===========================================================================

@test "driver_supports_sessions returns false" {
    run driver_supports_sessions
    assert_failure
}

# ===========================================================================
# driver_stream_filter
# ===========================================================================

@test "driver_stream_filter returns passthrough" {
    run driver_stream_filter
    assert_success
    assert_output "."
}
