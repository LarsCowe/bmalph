#!/bin/bash
# Antigravity (agy) driver for Ralph

driver_name() {
    echo "antigravity"
}

driver_display_name() {
    echo "Antigravity (agy)"
}

driver_cli_binary() {
    echo "agy"
}

driver_min_version() {
    echo "0.1.0"
}

driver_check_available() {
    command -v "$(driver_cli_binary)" &>/dev/null
}

driver_valid_tools() {
    VALID_TOOL_PATTERNS=()
}

driver_supports_tool_allowlist() {
    return 1
}

driver_permission_denial_help() {
    echo "  - $DRIVER_DISPLAY_NAME uses its native permission and approval model."
    echo "  - Use 'agy --dangerously-skip-permissions' or configure toolPermission to 'always-proceed' in settings.json to run unattended loops."
}

driver_build_command() {
    local prompt_file=$1
    local loop_context=$2
    local session_id=$3

    CLAUDE_CMD_ARGS=("$(driver_cli_binary)")

    if [[ ! -f "$prompt_file" ]]; then
        echo "ERROR: Prompt file not found: $prompt_file" >&2
        return 1
    fi

    if [[ "$CLAUDE_USE_CONTINUE" == "true" && -n "$session_id" ]]; then
        CLAUDE_CMD_ARGS+=("--conversation" "$session_id")
    fi

    local prompt_content
    prompt_content=$(cat "$prompt_file")
    if [[ -n "$loop_context" ]]; then
        prompt_content="$loop_context

$prompt_content"
    fi

    # Using --prompt since the user explicitly requested it in their prompt instructions.
    # We could also use --print to run non-interactively if that is what Ralph needs.
    # The prompt flag expects the string instruction.
    CLAUDE_CMD_ARGS+=("--prompt" "$prompt_content")
}

driver_supports_sessions() {
    return 0
}

driver_supports_live_output() {
    return 0
}

driver_prepare_live_command() {
    LIVE_CMD_ARGS=("${CLAUDE_CMD_ARGS[@]}")
}

driver_stream_filter() {
    # If Antigravity doesn't output JSON, we just return empty string to pass raw stdout.
    echo '.'
}

driver_extract_session_id_from_output() {
    # We might need to handle conversation ID extraction later, but for now
    # this will rely on fallback session id or just pass
    echo ""
    return 1
}

driver_fallback_session_id() {
    echo ""
    return 1
}
