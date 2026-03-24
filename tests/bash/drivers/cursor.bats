#!/usr/bin/env bats
# Tests for ralph/drivers/cursor.sh
# Validates CLI binary, tool list, and command assembly for Cursor CLI.

setup() {
    load '../test_helper/common-setup'
    _common_setup
    source "$RALPH_DRIVERS/cursor.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# Driver identification
# ===========================================================================

@test "driver_cli_binary falls back to cursor-agent" {
    run driver_cli_binary
    assert_output "cursor-agent"
}

@test "driver_cli_binary prefers cursor-agent over agent" {
    _mock_cli agent 0
    _mock_cli cursor-agent 0

    run driver_cli_binary

    assert_success
    [[ "$output" =~ cursor-agent$ ]]
}

@test "driver_cli_binary falls back to LOCALAPPDATA agent.cmd on Windows" {
    export OSTYPE="msys"
    export LOCALAPPDATA="$RALPH_DIR/localappdata"
    mkdir -p "$LOCALAPPDATA/cursor-agent"
    printf '@echo off\r\n' > "$LOCALAPPDATA/cursor-agent/agent.cmd"

    run driver_cli_binary

    assert_success
    [[ "$output" =~ agent\.cmd$ ]]
}

@test "driver_cli_binary prefers LOCALAPPDATA cursor-agent.cmd on Windows" {
    export OSTYPE="msys"
    export LOCALAPPDATA="$RALPH_DIR/localappdata"
    mkdir -p "$LOCALAPPDATA/cursor-agent"
    printf '@echo off\r\n' > "$LOCALAPPDATA/cursor-agent/cursor-agent.cmd"

    run driver_cli_binary

    assert_success
    [[ "$output" =~ cursor-agent\.cmd$ ]]
}

@test "driver_cli_binary detects agent.cmd on PATH on Windows" {
    export OSTYPE="msys"
    mkdir -p "$RALPH_DIR/windows-bin"
    printf '@echo off\r\n' > "$RALPH_DIR/windows-bin/agent.cmd"
    export PATH="$RALPH_DIR/windows-bin:$PATH"

    run driver_cli_binary

    assert_success
    assert_equal "$output" "$RALPH_DIR/windows-bin/agent.cmd"
}

@test "driver_cli_binary parses semicolon-delimited Windows PATH entries" {
    export OSTYPE="msys"
    local original_path="$PATH"
    mkdir -p "$RALPH_DIR/win-bin-1" "$RALPH_DIR/win-bin-2"
    printf '@echo off\r\n' > "$RALPH_DIR/win-bin-2/agent.cmd"

    cygpath() {
        if [[ "$1" != "-u" ]]; then
            return 1
        fi

        case "$2" in
            'C:\mock\bin1')
                echo "$RALPH_DIR/win-bin-1"
                ;;
            'D:\mock\bin2')
                echo "$RALPH_DIR/win-bin-2"
                ;;
            *)
                return 1
                ;;
        esac
    }
    export -f cygpath

    export PATH='C:\mock\bin1;D:\mock\bin2'

    run driver_cli_binary
    export PATH="$original_path"

    assert_success
    assert_equal "$output" "$RALPH_DIR/win-bin-2/agent.cmd"
}

@test "driver_name returns cursor" {
    run driver_name
    assert_output "cursor"
}

@test "driver_display_name returns Cursor CLI" {
    run driver_display_name
    assert_output "Cursor CLI"
}

@test "driver_min_version returns semver string" {
    run driver_min_version
    assert_success
    assert_output --regexp '^[0-9]+\.[0-9]+\.[0-9]+$'
}

# ===========================================================================
# driver_valid_tools
# ===========================================================================

@test "driver_valid_tools has cursor-specific tool names" {
    driver_valid_tools

    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " file_edit " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " file_read " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " terminal " ]]
    [[ " ${VALID_TOOL_PATTERNS[*]} " =~ " search " ]]
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

@test "driver_build_command uses print and force flags" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Implement the feature" > "$prompt_file"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "-p" ]]
    [[ "$args_str" =~ "--force" ]]
}

@test "driver_build_command includes output-format json" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    driver_build_command "$prompt_file" "" ""

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--output-format json" ]]
}

@test "driver_build_command prepends context to prompt" {
    local prompt_file="$RALPH_DIR/prompt.md"
    local original_os="${OS-}"
    local original_ostype="${OSTYPE-}"
    echo "Implement auth module" > "$prompt_file"

    unset OS
    export OSTYPE="linux-gnu"
    driver_build_command "$prompt_file" "Loop 2 context: progress detected" ""
    if [[ -n "$original_os" ]]; then
        export OS="$original_os"
    else
        unset OS
    fi
    if [[ -n "$original_ostype" ]]; then
        export OSTYPE="$original_ostype"
    else
        unset OSTYPE
    fi

    # Last arg is the combined prompt
    local last_arg="${CLAUDE_CMD_ARGS[${#CLAUDE_CMD_ARGS[@]}-1]}"
    [[ "$last_arg" =~ "Loop 2 context" ]]
    [[ "$last_arg" =~ "Implement auth module" ]]
}

@test "driver_build_command adds resume when session continuity is enabled" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    CLAUDE_USE_CONTINUE=true
    driver_build_command "$prompt_file" "" "session-cursor-456"

    local args_str="${CLAUDE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--resume session-cursor-456" ]]
}

@test "driver_build_command skips session when CLAUDE_USE_CONTINUE is false" {
    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    CLAUDE_USE_CONTINUE=false
    driver_build_command "$prompt_file" "" "session-cursor-456"

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

@test "driver_build_command uses bootstrap prompt on Windows" {
    export OSTYPE="msys"
    export LOCALAPPDATA="$RALPH_DIR/localappdata"
    mkdir -p "$LOCALAPPDATA/cursor-agent"
    printf '@echo off\r\n' > "$LOCALAPPDATA/cursor-agent/agent.cmd"

    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Very large prompt content that should not be passed inline on Windows" > "$prompt_file"

    driver_build_command "$prompt_file" "Loop 2 context: progress detected" ""

    local last_arg="${CLAUDE_CMD_ARGS[${#CLAUDE_CMD_ARGS[@]}-1]}"
    [[ "$last_arg" =~ ".ralph/PROMPT.md" ]]
    [[ "$last_arg" =~ ".ralph/PROJECT_CONTEXT.md" ]]
    [[ "$last_arg" =~ ".ralph/SPECS_INDEX.md" ]]
    [[ "$last_arg" =~ ".ralph/@fix_plan.md" ]]
    [[ "$last_arg" =~ ".ralph/@AGENT.md" ]]
    [[ "$last_arg" =~ ".ralph/specs/" ]]
    [[ "$last_arg" =~ "Loop 2 context" ]]
    [[ ! "$last_arg" =~ "Very large prompt content" ]]
}

@test "driver_build_command wraps .cmd binaries for timeout compatibility" {
    export OSTYPE="msys"
    export LOCALAPPDATA="$RALPH_DIR/localappdata"
    mkdir -p "$LOCALAPPDATA/cursor-agent"
    printf '@echo off\r\n' > "$LOCALAPPDATA/cursor-agent/agent.cmd"

    local prompt_file="$RALPH_DIR/prompt.md"
    echo "Test prompt" > "$prompt_file"

    driver_build_command "$prompt_file" "" ""

    [[ "${CLAUDE_CMD_ARGS[0]}" =~ cursor-agent-wrapper\.sh$ ]]
    assert_equal "${CLAUDE_CMD_ARGS[1]}" "$LOCALAPPDATA/cursor-agent/agent.cmd"
}

@test "driver_build_command fails with missing prompt file" {
    run driver_build_command "/nonexistent/prompt.md" "" ""
    assert_failure
}

# ===========================================================================
# driver_supports_sessions
# ===========================================================================

@test "driver_supports_sessions returns success" {
    run driver_supports_sessions
    assert_success
}

# ===========================================================================
# driver_stream_filter
# ===========================================================================

@test "driver_stream_filter contains assistant delta extraction and tool call activity" {
    run driver_stream_filter
    assert_success
    assert_output --partial '.type == "assistant"'
    assert_output --partial '.message.content[]?'
    assert_output --partial '.type == "tool_call"'
}
