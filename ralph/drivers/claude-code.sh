#!/bin/bash
# Claude Code driver for Ralph
# Provides platform-specific CLI invocation logic

# Driver identification
driver_name() {
    echo "claude-code"
}

driver_display_name() {
    echo "Claude Code"
}

driver_cli_binary() {
    echo "claude"
}

driver_min_version() {
    echo "2.0.76"
}

# Check if the CLI binary is available
driver_check_available() {
    command -v "$(driver_cli_binary)" &>/dev/null
}

# Valid tool patterns for --allowedTools validation
# Sets the global VALID_TOOL_PATTERNS array
driver_valid_tools() {
    VALID_TOOL_PATTERNS=(
        "Write"
        "Read"
        "Edit"
        "MultiEdit"
        "Glob"
        "Grep"
        "Task"
        "TodoWrite"
        "WebFetch"
        "WebSearch"
        "Bash"
        "Bash(git *)"
        "Bash(npm *)"
        "Bash(bats *)"
        "Bash(python *)"
        "Bash(node *)"
        "NotebookEdit"
    )
}

# Build the CLI command arguments
# Populates global CLAUDE_CMD_ARGS array
# Parameters:
#   $1 - prompt_file: path to the prompt file
#   $2 - loop_context: context string for session continuity
#   $3 - session_id: session ID for resume (empty for new session)
driver_build_command() {
    local prompt_file=$1
    local loop_context=$2
    local session_id=$3

    # Note: We do NOT use --dangerously-skip-permissions here. Tool permissions
    # are controlled via --allowedTools from CLAUDE_ALLOWED_TOOLS in .ralphrc.
    # This preserves the permission denial circuit breaker (Issue #101).
    CLAUDE_CMD_ARGS=("$(driver_cli_binary)")

    if [[ ! -f "$prompt_file" ]]; then
        echo "ERROR: Prompt file not found: $prompt_file" >&2
        return 1
    fi

    # Output format
    if [[ "$CLAUDE_OUTPUT_FORMAT" == "json" ]]; then
        CLAUDE_CMD_ARGS+=("--output-format" "json")
    fi

    # Allowed tools
    if [[ -n "$CLAUDE_ALLOWED_TOOLS" ]]; then
        CLAUDE_CMD_ARGS+=("--allowedTools")
        local IFS=','
        read -ra tools_array <<< "$CLAUDE_ALLOWED_TOOLS"
        for tool in "${tools_array[@]}"; do
            tool=$(echo "$tool" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            if [[ -n "$tool" ]]; then
                CLAUDE_CMD_ARGS+=("$tool")
            fi
        done
    fi

    # Session resume
    # IMPORTANT: Use --resume with explicit session ID instead of --continue.
    # --continue resumes the "most recent session in current directory" which
    # can hijack active Claude Code sessions. --resume with a specific session ID
    # ensures we only resume Ralph's own sessions. (Issue #151)
    if [[ "$CLAUDE_USE_CONTINUE" == "true" && -n "$session_id" ]]; then
        CLAUDE_CMD_ARGS+=("--resume" "$session_id")
    fi

    # Loop context as system prompt
    if [[ -n "$loop_context" ]]; then
        CLAUDE_CMD_ARGS+=("--append-system-prompt" "$loop_context")
    fi

    # Prompt content
    local prompt_content
    prompt_content=$(cat "$prompt_file")
    CLAUDE_CMD_ARGS+=("-p" "$prompt_content")
}

# Whether this driver supports session continuity
driver_supports_sessions() {
    return 0  # true
}

# Stream filter for live output (jq filter for JSON streaming)
driver_stream_filter() {
    echo '.content // empty | select(type == "string")'
}
