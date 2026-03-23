#!/usr/bin/env bats
# Tests for ralph/ralph_loop.sh
# Validates pure logic functions: load_ralphrc, can_make_call,
# validate_allowed_tools, build_loop_context, generate_session_id,
# check_claude_version, init_claude_session.

setup() {
    load 'test_helper/common-setup'
    _common_setup

    # Source ralph_loop.sh to load function definitions.
    # RALPH_DIR is already exported by _common_setup (temp dir), and the script
    # respects it via ${RALPH_DIR:-.ralph}. Side effects: set -e, library sourcing,
    # variable init, mkdir (in temp dir since RALPH_DIR is pre-set).
    source "$PROJECT_ROOT/ralph/ralph_loop.sh"

    # Disable set -e leaked by ralph_loop.sh so tests that call functions
    # without `run` don't abort on intermediate non-zero exits.
    set +e

    # Re-export RALPH_DIR and re-derive path variables for test isolation.
    export RALPH_DIR
    LOG_DIR="$RALPH_DIR/logs"
    DOCS_DIR="$RALPH_DIR/docs/generated"
    STATUS_FILE="$RALPH_DIR/status.json"
    PROGRESS_FILE="$RALPH_DIR/progress.json"
    CALL_COUNT_FILE="$RALPH_DIR/.call_count"
    TIMESTAMP_FILE="$RALPH_DIR/.last_reset"
    EXIT_SIGNALS_FILE="$RALPH_DIR/.exit_signals"
    RESPONSE_ANALYSIS_FILE="$RALPH_DIR/.response_analysis"
    CLAUDE_SESSION_FILE="$RALPH_DIR/.claude_session_id"
    RALPH_SESSION_FILE="$RALPH_DIR/.ralph_session"
    RALPH_SESSION_HISTORY_FILE="$RALPH_DIR/.ralph_session_history"
    LIVE_LOG_FILE="$RALPH_DIR/live.log"

    # Reset defaults after sourcing (sourcing captures env state in _env_ vars)
    MAX_CALLS_PER_HOUR=100
    CLAUDE_TIMEOUT_MINUTES=15
    CLAUDE_OUTPUT_FORMAT="json"
    CLAUDE_ALLOWED_TOOLS="Write,Read,Edit,MultiEdit,Glob,Grep,Task,TodoWrite,WebFetch,WebSearch,EnterPlanMode,ExitPlanMode,NotebookEdit,Bash"
    CLAUDE_PERMISSION_MODE="bypassPermissions"
    CLAUDE_USE_CONTINUE="true"
    CLAUDE_SESSION_EXPIRY_HOURS=24
    PERMISSION_DENIAL_MODE="continue"
    VERBOSE_PROGRESS="false"
    CLAUDE_MIN_VERSION="2.0.76"
    CLAUDE_CODE_CMD="claude"
    PLATFORM_DRIVER="claude-code"
    DRIVER_DISPLAY_NAME="Claude Code"
    RALPHRC_LOADED=false
    RUNTIME_CONTEXT_LOADED=false

    # Clear _env_ prefixed vars so .ralphrc overrides are not blocked
    _env_MAX_CALLS_PER_HOUR=""
    _env_CLAUDE_TIMEOUT_MINUTES=""
    _env_CLAUDE_OUTPUT_FORMAT=""
    _env_CLAUDE_ALLOWED_TOOLS=""
    _env_CLAUDE_PERMISSION_MODE=""
    _env_has_CLAUDE_PERMISSION_MODE=""
    _env_CLAUDE_USE_CONTINUE=""
    _env_CLAUDE_SESSION_EXPIRY_HOURS=""
    _env_ALLOWED_TOOLS=""
    _env_SESSION_CONTINUITY=""
    _env_SESSION_EXPIRY_HOURS=""
    _env_PERMISSION_DENIAL_MODE=""
    _env_RALPH_VERBOSE=""
    _env_VERBOSE_PROGRESS=""
    _env_CB_COOLDOWN_MINUTES=""
    _env_CB_AUTO_RESET=""
    _env_TEST_COMMAND=""
    _env_QUALITY_GATES=""
    _env_QUALITY_GATE_MODE=""
    _env_QUALITY_GATE_TIMEOUT=""
    _env_QUALITY_GATE_ON_COMPLETION_ONLY=""

    # Reset quality gate defaults
    TEST_COMMAND=""
    QUALITY_GATES=""
    QUALITY_GATE_MODE="warn"
    QUALITY_GATE_TIMEOUT=120
    QUALITY_GATE_ON_COMPLETION_ONLY="false"
    QUALITY_GATE_RESULTS_FILE="$RALPH_DIR/.quality_gate_results"

    unset ALLOWED_TOOLS SESSION_CONTINUITY SESSION_EXPIRY_HOURS RALPH_VERBOSE
    _cli_MAX_CALLS_PER_HOUR=""
    _cli_CLAUDE_TIMEOUT_MINUTES=""
    _cli_CLAUDE_OUTPUT_FORMAT=""
    _cli_CLAUDE_ALLOWED_TOOLS=""
    _cli_CLAUDE_PERMISSION_MODE=""
    _cli_CLAUDE_USE_CONTINUE=""
    _cli_CLAUDE_SESSION_EXPIRY_HOURS=""
    _cli_VERBOSE_PROGRESS=""
    _CLI_MAX_CALLS_PER_HOUR=""
    _CLI_CLAUDE_TIMEOUT_MINUTES=""
    _CLI_CLAUDE_OUTPUT_FORMAT=""
    _CLI_ALLOWED_TOOLS=""
    _CLI_SESSION_CONTINUITY=""
    _CLI_SESSION_EXPIRY_HOURS=""
    _CLI_VERBOSE_PROGRESS=""

    mkdir -p "$RALPH_DIR/logs" "$RALPH_DIR/docs/generated"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# load_ralphrc
# ===========================================================================

@test "load_ralphrc returns 0 when no .ralphrc file exists" {
    run load_ralphrc
    assert_success
}

@test "load_ralphrc sets RALPHRC_LOADED=true when file exists" {
    echo 'MAX_CALLS_PER_HOUR=50' > "$RALPHRC_FILE"
    load_ralphrc
    assert_equal "$RALPHRC_LOADED" "true"
}

@test "load_ralphrc applies .ralphrc overrides" {
    echo 'MAX_CALLS_PER_HOUR=42' > "$RALPHRC_FILE"
    load_ralphrc
    assert_equal "$MAX_CALLS_PER_HOUR" "42"
}

@test "load_ralphrc applies permission denial mode override" {
    echo 'PERMISSION_DENIAL_MODE="threshold"' > "$RALPHRC_FILE"
    load_ralphrc
    assert_equal "$PERMISSION_DENIAL_MODE" "threshold"
}

@test "load_ralphrc applies Claude permission mode override" {
    echo 'CLAUDE_PERMISSION_MODE="dontAsk"' > "$RALPHRC_FILE"
    load_ralphrc
    assert_equal "$CLAUDE_PERMISSION_MODE" "dontAsk"
}

@test "load_ralphrc normalizes blank Claude permission mode to bypassPermissions" {
    echo 'CLAUDE_PERMISSION_MODE=""' > "$RALPHRC_FILE"
    load_ralphrc
    assert_equal "$CLAUDE_PERMISSION_MODE" "bypassPermissions"
}

@test "load_ralphrc: env vars take precedence over .ralphrc" {
    echo 'MAX_CALLS_PER_HOUR=42' > "$RALPHRC_FILE"
    _env_MAX_CALLS_PER_HOUR="200"
    MAX_CALLS_PER_HOUR="200"
    load_ralphrc
    assert_equal "$MAX_CALLS_PER_HOUR" "200"
}

@test "load_ralphrc: ALLOWED_TOOLS env alias overrides .ralphrc" {
    echo 'ALLOWED_TOOLS="Write"' > "$RALPHRC_FILE"
    _env_ALLOWED_TOOLS="Write,Bash(node --version)"
    ALLOWED_TOOLS="Write,Bash(node --version)"

    load_ralphrc

    assert_equal "$CLAUDE_ALLOWED_TOOLS" "Write,Bash(node --version)"
}

@test "load_ralphrc: SESSION_CONTINUITY env alias overrides .ralphrc" {
    echo 'SESSION_CONTINUITY="false"' > "$RALPHRC_FILE"
    _env_SESSION_CONTINUITY="true"
    SESSION_CONTINUITY="true"

    load_ralphrc

    assert_equal "$CLAUDE_USE_CONTINUE" "true"
}

@test "load_ralphrc: SESSION_EXPIRY_HOURS env alias overrides .ralphrc" {
    echo 'SESSION_EXPIRY_HOURS="12"' > "$RALPHRC_FILE"
    _env_SESSION_EXPIRY_HOURS="48"
    SESSION_EXPIRY_HOURS="48"

    load_ralphrc

    assert_equal "$CLAUDE_SESSION_EXPIRY_HOURS" "48"
}

@test "load_ralphrc: RALPH_VERBOSE env alias overrides .ralphrc" {
    echo 'RALPH_VERBOSE="false"' > "$RALPHRC_FILE"
    _env_RALPH_VERBOSE="true"
    RALPH_VERBOSE="true"

    load_ralphrc

    assert_equal "$VERBOSE_PROGRESS" "true"
}

@test "load_ralphrc: public ALLOWED_TOOLS alias beats internal env override" {
    echo 'ALLOWED_TOOLS="Edit"' > "$RALPHRC_FILE"
    _env_ALLOWED_TOOLS="Write,Read"
    ALLOWED_TOOLS="Write,Read"
    _env_CLAUDE_ALLOWED_TOOLS="Bash"
    CLAUDE_ALLOWED_TOOLS="Bash"

    load_ralphrc

    assert_equal "$CLAUDE_ALLOWED_TOOLS" "Write,Read"
}

@test "load_ralphrc: internal CLAUDE_ALLOWED_TOOLS env override still works" {
    echo 'ALLOWED_TOOLS="Write"' > "$RALPHRC_FILE"
    _env_CLAUDE_ALLOWED_TOOLS="Read,Edit"
    CLAUDE_ALLOWED_TOOLS="Read,Edit"

    load_ralphrc

    assert_equal "$CLAUDE_ALLOWED_TOOLS" "Read,Edit"
}

@test "load_ralphrc: internal CLAUDE_PERMISSION_MODE env override still works" {
    echo 'CLAUDE_PERMISSION_MODE="plan"' > "$RALPHRC_FILE"
    _env_CLAUDE_PERMISSION_MODE="dontAsk"
    _env_has_CLAUDE_PERMISSION_MODE="x"
    CLAUDE_PERMISSION_MODE="dontAsk"

    load_ralphrc

    [[ "$CLAUDE_PERMISSION_MODE" == "dontAsk" ]]
}

@test "load_ralphrc: explicit empty CLAUDE_PERMISSION_MODE env override resets to bypassPermissions at startup" {
    local isolated_ralph_dir
    isolated_ralph_dir="$(mktemp -d)"
    printf 'CLAUDE_PERMISSION_MODE="plan"\n' > "$isolated_ralph_dir/.ralphrc"

    run bash -lc "
        export RALPH_DIR='$isolated_ralph_dir'
        export CLAUDE_PERMISSION_MODE=''
        source '$PROJECT_ROOT/ralph/ralph_loop.sh' >/dev/null 2>&1
        set +e
        load_ralphrc >/dev/null 2>&1
        printf '%s' \"\$CLAUDE_PERMISSION_MODE\"
    "

    rm -rf "$isolated_ralph_dir"

    [[ "$status" -eq 0 && "$output" == "bypassPermissions" ]]
}

@test "load_ralphrc: unset CLAUDE_PERMISSION_MODE env leaves config in place at startup" {
    local isolated_ralph_dir
    isolated_ralph_dir="$(mktemp -d)"
    printf 'CLAUDE_PERMISSION_MODE="plan"\n' > "$isolated_ralph_dir/.ralphrc"

    run bash -lc "
        export RALPH_DIR='$isolated_ralph_dir'
        unset CLAUDE_PERMISSION_MODE
        source '$PROJECT_ROOT/ralph/ralph_loop.sh' >/dev/null 2>&1
        set +e
        load_ralphrc >/dev/null 2>&1
        printf '%s' \"\$CLAUDE_PERMISSION_MODE\"
    "

    rm -rf "$isolated_ralph_dir"

    [[ "$status" -eq 0 && "$output" == "plan" ]]
}

@test "load_ralphrc: internal CLAUDE_PERMISSION_MODE env override beats blank config" {
    echo 'CLAUDE_PERMISSION_MODE=""' > "$RALPHRC_FILE"
    _env_CLAUDE_PERMISSION_MODE="dontAsk"
    _env_has_CLAUDE_PERMISSION_MODE="x"
    CLAUDE_PERMISSION_MODE="dontAsk"

    load_ralphrc

    [[ "$CLAUDE_PERMISSION_MODE" == "dontAsk" ]]
}

@test "load_ralphrc: internal CLAUDE_USE_CONTINUE env override still works" {
    echo 'SESSION_CONTINUITY="false"' > "$RALPHRC_FILE"
    _env_CLAUDE_USE_CONTINUE="true"
    CLAUDE_USE_CONTINUE="true"

    load_ralphrc

    assert_equal "$CLAUDE_USE_CONTINUE" "true"
}

@test "load_ralphrc: internal CLAUDE_SESSION_EXPIRY_HOURS env override still works" {
    echo 'SESSION_EXPIRY_HOURS="12"' > "$RALPHRC_FILE"
    _env_CLAUDE_SESSION_EXPIRY_HOURS="72"
    CLAUDE_SESSION_EXPIRY_HOURS="72"

    load_ralphrc

    assert_equal "$CLAUDE_SESSION_EXPIRY_HOURS" "72"
}

@test "load_ralphrc: internal VERBOSE_PROGRESS env override still works" {
    echo 'RALPH_VERBOSE="false"' > "$RALPHRC_FILE"
    _env_VERBOSE_PROGRESS="true"
    VERBOSE_PROGRESS="true"

    load_ralphrc

    assert_equal "$VERBOSE_PROGRESS" "true"
}

@test "load_ralphrc: CLI allowed-tools overrides env alias and .ralphrc" {
    echo 'ALLOWED_TOOLS="Edit"' > "$RALPHRC_FILE"
    _env_ALLOWED_TOOLS="Write"
    ALLOWED_TOOLS="Write"
    CLAUDE_ALLOWED_TOOLS="Bash(node --version)"
    _cli_CLAUDE_ALLOWED_TOOLS="Bash(node --version)"
    _CLI_ALLOWED_TOOLS=true

    load_ralphrc

    assert_equal "$CLAUDE_ALLOWED_TOOLS" "Bash(node --version)"
}

@test "load_ralphrc: CLI session continuity overrides env alias and .ralphrc" {
    echo 'SESSION_CONTINUITY="true"' > "$RALPHRC_FILE"
    _env_SESSION_CONTINUITY="true"
    SESSION_CONTINUITY="true"
    CLAUDE_USE_CONTINUE="false"
    _cli_CLAUDE_USE_CONTINUE="false"
    _CLI_SESSION_CONTINUITY=true

    load_ralphrc

    assert_equal "$CLAUDE_USE_CONTINUE" "false"
}

@test "load_ralphrc: CLI calls override env and .ralphrc" {
    run bash -lc "cd '$PROJECT_ROOT' && \
        tmp_dir=\$(mktemp -d) && \
        export RALPH_DIR=\"\$tmp_dir\" && \
        mkdir -p \"\$RALPH_DIR/logs\" \"\$RALPH_DIR/docs/generated\" && \
        source 'ralph/ralph_loop.sh' && \
        set +e && \
        printf 'MAX_CALLS_PER_HOUR=42\n' > \"\$RALPH_DIR/.ralphrc\" && \
        _env_MAX_CALLS_PER_HOUR='120' && \
        MAX_CALLS_PER_HOUR='120' && \
        MAX_CALLS_PER_HOUR='75' && \
        _cli_MAX_CALLS_PER_HOUR='75' && \
        _CLI_MAX_CALLS_PER_HOUR=true && \
        load_ralphrc && \
        printf '%s' \"\$MAX_CALLS_PER_HOUR\""

    assert_success
    assert_output "75"
}

@test "load_ralphrc: CLI timeout overrides env and .ralphrc" {
    run bash -lc "cd '$PROJECT_ROOT' && \
        tmp_dir=\$(mktemp -d) && \
        export RALPH_DIR=\"\$tmp_dir\" && \
        mkdir -p \"\$RALPH_DIR/logs\" \"\$RALPH_DIR/docs/generated\" && \
        source 'ralph/ralph_loop.sh' && \
        set +e && \
        printf 'CLAUDE_TIMEOUT_MINUTES=22\n' > \"\$RALPH_DIR/.ralphrc\" && \
        _env_CLAUDE_TIMEOUT_MINUTES='45' && \
        CLAUDE_TIMEOUT_MINUTES='45' && \
        CLAUDE_TIMEOUT_MINUTES='9' && \
        _cli_CLAUDE_TIMEOUT_MINUTES='9' && \
        _CLI_CLAUDE_TIMEOUT_MINUTES=true && \
        load_ralphrc && \
        printf '%s' \"\$CLAUDE_TIMEOUT_MINUTES\""

    assert_success
    assert_output "9"
}

@test "load_ralphrc: CLI output format overrides env and .ralphrc" {
    run bash -lc "cd '$PROJECT_ROOT' && \
        tmp_dir=\$(mktemp -d) && \
        export RALPH_DIR=\"\$tmp_dir\" && \
        mkdir -p \"\$RALPH_DIR/logs\" \"\$RALPH_DIR/docs/generated\" && \
        source 'ralph/ralph_loop.sh' && \
        set +e && \
        printf 'CLAUDE_OUTPUT_FORMAT=\"text\"\n' > \"\$RALPH_DIR/.ralphrc\" && \
        _env_CLAUDE_OUTPUT_FORMAT='text' && \
        CLAUDE_OUTPUT_FORMAT='text' && \
        CLAUDE_OUTPUT_FORMAT='json' && \
        _cli_CLAUDE_OUTPUT_FORMAT='json' && \
        _CLI_CLAUDE_OUTPUT_FORMAT=true && \
        load_ralphrc && \
        printf '%s' \"\$CLAUDE_OUTPUT_FORMAT\""

    assert_success
    assert_output "json"
}

@test "setup_tmux_session forwards restored CLI calls timeout and output format" {
    run bash -lc "cd '$PROJECT_ROOT' && \
        tmp_dir=\$(mktemp -d) && \
        export RALPH_DIR=\"\$tmp_dir\" && \
        mkdir -p \"\$RALPH_DIR/logs\" \"\$RALPH_DIR/docs/generated\" \"\$RALPH_DIR/bin\" && \
        source 'ralph/ralph_loop.sh' && \
        set +e && \
        cat > \"\$RALPH_DIR/.ralphrc\" <<'EOF'\nMAX_CALLS_PER_HOUR=42\nCLAUDE_TIMEOUT_MINUTES=22\nCLAUDE_OUTPUT_FORMAT=\"json\"\nEOF\n\
        MAX_CALLS_PER_HOUR='75' && \
        _cli_MAX_CALLS_PER_HOUR='75' && \
        _CLI_MAX_CALLS_PER_HOUR=true && \
        CLAUDE_TIMEOUT_MINUTES='9' && \
        _cli_CLAUDE_TIMEOUT_MINUTES='9' && \
        _CLI_CLAUDE_TIMEOUT_MINUTES=true && \
        CLAUDE_OUTPUT_FORMAT='text' && \
        _cli_CLAUDE_OUTPUT_FORMAT='text' && \
        _CLI_CLAUDE_OUTPUT_FORMAT=true && \
        cat > \"\$RALPH_DIR/bin/tmux\" <<'EOF'\n#!/usr/bin/env bash\nprintf '%s\\n' \"\$*\"\nexit 0\nEOF\n\
        chmod +x \"\$RALPH_DIR/bin/tmux\" && \
        export PATH=\"\$RALPH_DIR/bin:\$PATH\" && \
        setup_tmux_session"
    assert_success
    assert_output --partial "--calls 75 --output-format text --timeout 9"
}

@test "load_ralphrc prefers the bundled .ralph/.ralphrc file" {
    echo 'MAX_CALLS_PER_HOUR=41' > "$RALPH_DIR/.ralphrc"
    echo 'MAX_CALLS_PER_HOUR=84' > ".ralphrc"
    load_ralphrc
    assert_equal "$MAX_CALLS_PER_HOUR" "41"
}

@test "load_ralphrc falls back to project-root .ralphrc when bundled config is missing" {
    rm -f "$RALPH_DIR/.ralphrc"
    echo 'MAX_CALLS_PER_HOUR=84' > ".ralphrc"
    load_ralphrc
    assert_equal "$MAX_CALLS_PER_HOUR" "84"
}

# ===========================================================================
# can_make_call
# ===========================================================================

@test "can_make_call returns 0 when under limit" {
    echo "5" > "$CALL_COUNT_FILE"
    run can_make_call
    assert_success
}

@test "can_make_call returns 1 when at limit" {
    echo "$MAX_CALLS_PER_HOUR" > "$CALL_COUNT_FILE"
    run can_make_call
    assert_failure
}

@test "can_make_call returns 0 when count file missing" {
    rm -f "$CALL_COUNT_FILE"
    run can_make_call
    assert_success
}

# ===========================================================================
# validate_allowed_tools
# ===========================================================================

@test "validate_allowed_tools accepts empty input" {
    run validate_allowed_tools ""
    assert_success
}

@test "validate_allowed_tools accepts valid tools" {
    run validate_allowed_tools "Write,Read,Edit"
    assert_success
}

@test "validate_allowed_tools rejects invalid tools" {
    run validate_allowed_tools "Write,InvalidTool,Read"
    assert_failure
    assert_output --partial "Invalid tool"
}

@test "validate_allowed_tools accepts Bash with any parenthesized content" {
    run validate_allowed_tools "Bash(docker compose *),Write"
    assert_success
}

@test "validate_allowed_tools accepts AskUserQuestion for Claude opt-in configs" {
    run validate_allowed_tools "Write,AskUserQuestion,Bash(node --version)"
    assert_success
}

@test "validate_allowed_tools accepts EnterPlanMode and ExitPlanMode for autonomous safety nets" {
    run validate_allowed_tools "Write,EnterPlanMode,ExitPlanMode,Bash(node --version)"
    assert_success
}

@test "warn_if_allowed_tools_ignored warns for drivers without allowlist support" {
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="codex"
    load_platform_driver
    CLAUDE_ALLOWED_TOOLS="Write,Read"
    _CLI_ALLOWED_TOOLS=true

    run warn_if_allowed_tools_ignored
    assert_success
    assert_output --partial "ignored by OpenAI Codex"
}

@test "warn_if_allowed_tools_ignored stays quiet for Claude Code" {
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="claude-code"
    load_platform_driver
    CLAUDE_ALLOWED_TOOLS="Write,Read"
    _CLI_ALLOWED_TOOLS=true

    run warn_if_allowed_tools_ignored
    assert_success
    assert_output ""
}

# ===========================================================================
# validate_claude_permission_mode
# ===========================================================================

@test "validate_claude_permission_mode accepts supported modes" {
    local modes=(auto acceptEdits bypassPermissions default dontAsk plan)

    for mode in "${modes[@]}"; do
        run validate_claude_permission_mode "$mode"
        assert_success
    done
}

@test "validate_claude_permission_mode rejects invalid mode" {
    run validate_claude_permission_mode "askLater"
    assert_failure
    assert_output --partial "Invalid CLAUDE_PERMISSION_MODE"
    assert_output --partial "Valid modes: auto acceptEdits bypassPermissions default dontAsk plan"
}

# ===========================================================================
# build_loop_context
# ===========================================================================

@test "build_loop_context includes loop number" {
    run build_loop_context 7
    assert_success
    assert_output --partial "Loop #7"
}

@test "build_loop_context includes remaining task count" {
    cat > "$RALPH_DIR/@fix_plan.md" << 'EOF'
- [ ] First incomplete task
- [x] Completed task
- [ ] Second incomplete task
EOF
    run build_loop_context 3
    assert_success
    assert_output --partial "Remaining tasks: 2"
}

@test "build_loop_context truncates to 500 characters" {
    run build_loop_context 1
    assert_success
    local len=${#output}
    [[ $len -le 500 ]]
}

# ===========================================================================
# fix-plan progress tracking enforcement
# ===========================================================================

@test "enforce_fix_plan_progress_tracking preserves matching checkbox delta" {
    _skip_if_jq_missing
    local analysis="$RALPH_DIR/.response_analysis"
    jq -n \
        '{
            analysis: {
                tasks_completed_this_loop: 1,
                has_completion_signal: true,
                exit_signal: true
            }
        }' > "$analysis"

    run enforce_fix_plan_progress_tracking "$analysis" 0 1
    assert_success

    run jq -r '.analysis.fix_plan_completed_delta' "$analysis"
    assert_success
    assert_output "1"

    run jq -r '.analysis.has_progress_tracking_mismatch' "$analysis"
    assert_success
    assert_output "false"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_success
    assert_output "true"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_success
    assert_output "true"
}

@test "enforce_fix_plan_progress_tracking suppresses completion when claimed work has zero checkbox delta" {
    _skip_if_jq_missing
    local analysis="$RALPH_DIR/.response_analysis"
    jq -n \
        '{
            analysis: {
                tasks_completed_this_loop: 1,
                has_completion_signal: true,
                exit_signal: true
            }
        }' > "$analysis"

    run enforce_fix_plan_progress_tracking "$analysis" 0 0
    assert_success

    run jq -r '.analysis.fix_plan_completed_delta' "$analysis"
    assert_success
    assert_output "0"

    run jq -r '.analysis.has_progress_tracking_mismatch' "$analysis"
    assert_success
    assert_output "true"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_success
    assert_output "false"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_success
    assert_output "false"
}

@test "enforce_fix_plan_progress_tracking flags inflated claimed task counts" {
    _skip_if_jq_missing
    local analysis="$RALPH_DIR/.response_analysis"
    jq -n \
        '{
            analysis: {
                tasks_completed_this_loop: 2,
                has_completion_signal: true,
                exit_signal: true
            }
        }' > "$analysis"

    run enforce_fix_plan_progress_tracking "$analysis" 0 2
    assert_success

    run jq -r '.analysis.fix_plan_completed_delta' "$analysis"
    assert_success
    assert_output "2"

    run jq -r '.analysis.has_progress_tracking_mismatch' "$analysis"
    assert_success
    assert_output "true"

    run jq -r '.analysis.has_completion_signal' "$analysis"
    assert_success
    assert_output "false"

    run jq -r '.analysis.exit_signal' "$analysis"
    assert_success
    assert_output "false"
}

# ===========================================================================
# generate_session_id
# ===========================================================================

@test "generate_session_id produces ralph- prefix" {
    run generate_session_id
    assert_success
    assert_output --regexp '^ralph-[0-9]+-[0-9]+$'
}

@test "generate_session_id produces unique values" {
    local id1 id2
    id1=$(generate_session_id)
    id2=$(generate_session_id)
    [[ "$id1" != "$id2" ]] || {
        # Very unlikely but possible with same timestamp+RANDOM
        # Try once more
        id2=$(generate_session_id)
        [[ "$id1" != "$id2" ]]
    }
}

# ===========================================================================
# check_claude_version
# ===========================================================================

@test "check_claude_version: above minimum returns success" {
    _mock_cli claude 0 "claude v3.0.0"
    CLAUDE_CODE_CMD="claude"
    run check_claude_version
    assert_success
}

@test "check_claude_version: below minimum returns failure" {
    _mock_cli claude 0 "claude v1.0.0"
    CLAUDE_CODE_CMD="claude"
    run check_claude_version
    assert_failure
}

@test "check_claude_version: missing binary returns success with warning" {
    CLAUDE_CODE_CMD="nonexistent_claude_binary_xyz"
    run check_claude_version
    assert_success
}

# ===========================================================================
# init_claude_session
# ===========================================================================

@test "init_claude_session: returns empty when no session file" {
    rm -f "$CLAUDE_SESSION_FILE"
    run init_claude_session
    assert_success
    assert_output ""
}

@test "init_claude_session: returns session ID from valid file" {
    echo "session-abc-123" > "$CLAUDE_SESSION_FILE"
    # Touch the file to make it recent (not expired)
    touch "$CLAUDE_SESSION_FILE"
    run init_claude_session
    assert_success
    assert_output "session-abc-123"
}

@test "init_claude_session: reads session ID from legacy JSON file" {
    jq -n --arg sid "legacy-session-456" --arg ts "$(_minutes_ago_iso 10)" \
        '{session_id: $sid, timestamp: $ts}' > "$CLAUDE_SESSION_FILE"

    run init_claude_session
    assert_success
    assert_output "legacy-session-456"
}

@test "init_claude_session: does not resume expired legacy JSON session timestamps" {
    jq -n --arg sid "legacy-session-expired" --arg ts "$(_minutes_ago_iso $((25 * 60)))" \
        '{session_id: $sid, timestamp: $ts}' > "$CLAUDE_SESSION_FILE"

    run init_claude_session
    assert_success
    assert_output ""
    [[ ! -f "$CLAUDE_SESSION_FILE" ]]
}

@test "init_claude_session: returns empty for expired session" {
    echo "old-session-456" > "$CLAUDE_SESSION_FILE"
    CLAUDE_SESSION_EXPIRY_HOURS=0
    run init_claude_session
    assert_success
    assert_output ""
}

# ===========================================================================
# Tier 2 — Filesystem side effects
# ===========================================================================

# ===========================================================================
# init_call_tracking
# ===========================================================================

@test "init_call_tracking resets counter on new hour" {
    echo "2024010100" > "$TIMESTAMP_FILE"
    echo "50" > "$CALL_COUNT_FILE"
    init_call_tracking
    local count
    count=$(cat "$CALL_COUNT_FILE")
    [[ "$count" == "0" ]]
}

@test "init_call_tracking preserves counter for same hour" {
    local current_hour
    current_hour=$(date +%Y%m%d%H)
    echo "$current_hour" > "$TIMESTAMP_FILE"
    echo "25" > "$CALL_COUNT_FILE"
    init_call_tracking
    local count
    count=$(cat "$CALL_COUNT_FILE")
    [[ "$count" == "25" ]]
}

@test "init_call_tracking creates exit signals file if missing" {
    rm -f "$EXIT_SIGNALS_FILE"
    init_call_tracking
    [[ -f "$EXIT_SIGNALS_FILE" ]]
    # Should contain valid JSON
    jq empty "$EXIT_SIGNALS_FILE"
}

# ===========================================================================
# update_status
# ===========================================================================

@test "update_status creates valid JSON status file" {
    update_status 5 10 "executing_loop" "running"
    [[ -f "$STATUS_FILE" ]]
    jq empty "$STATUS_FILE"
    local status
    status=$(jq -r '.status' "$STATUS_FILE")
    assert_equal "$status" "running"
}

@test "update_status includes loop count and calls" {
    update_status 12 45 "analyzing_response" "running"
    local loop_count
    loop_count=$(jq -r '.loop_count' "$STATUS_FILE")
    assert_equal "$loop_count" "12"
    local calls
    calls=$(jq -r '.calls_made_this_hour' "$STATUS_FILE")
    assert_equal "$calls" "45"
}

# ===========================================================================
# save_claude_session
# ===========================================================================

@test "save_claude_session extracts session ID from JSON output" {
    local output_file="$RALPH_DIR/test_output.json"
    echo '{"metadata": {"session_id": "ses-abc-123"}}' > "$output_file"
    save_claude_session "$output_file"
    local saved
    saved=$(cat "$CLAUDE_SESSION_FILE")
    assert_equal "$saved" "ses-abc-123"
}

@test "save_claude_session extracts session ID from Codex JSONL output" {
    local output_file="$RALPH_DIR/test_output.jsonl"
    cp "$FIXTURES_DIR/codex_jsonl_response.jsonl" "$output_file"

    save_claude_session "$output_file"

    local saved
    saved=$(cat "$CLAUDE_SESSION_FILE")
    assert_equal "$saved" "codex-thread-123"
}

@test "save_claude_session extracts session ID from Cursor JSON output" {
    local output_file="$RALPH_DIR/test_output.json"
    cp "$FIXTURES_DIR/cursor_json_response.json" "$output_file"

    save_claude_session "$output_file"

    local saved
    saved=$(cat "$CLAUDE_SESSION_FILE")
    assert_equal "$saved" "cursor-session-123"
}

@test "save_claude_session creates a fresh active Ralph session for a new driver session" {
    local output_file="$RALPH_DIR/test_output.json"
    echo '{"metadata": {"session_id": "ses-new-456"}}' > "$output_file"
    echo '{"session_id":"","reset_at":"2026-03-13T09:10:53+00:00","reset_reason":"permission_denied"}' > "$RALPH_SESSION_FILE"

    save_claude_session "$output_file"

    local session_id
    session_id=$(jq -r '.session_id' "$RALPH_SESSION_FILE")
    assert_equal "$session_id" "ses-new-456"

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    [[ "$created_at" != "null" && -n "$created_at" ]]

    local last_used
    last_used=$(jq -r '.last_used' "$RALPH_SESSION_FILE")
    assert_equal "$last_used" "$created_at"
}

@test "save_claude_session preserves created_at when the driver session matches the active Ralph session" {
    local output_file="$RALPH_DIR/test_output.json"
    echo '{"metadata": {"session_id": "ses-abc-123"}}' > "$output_file"
    echo '{"session_id":"ses-abc-123","created_at":"2026-01-01T00:00:00Z","last_used":"2026-01-01T00:05:00Z"}' > "$RALPH_SESSION_FILE"

    save_claude_session "$output_file"

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    assert_equal "$created_at" "2026-01-01T00:00:00Z"

    local last_used
    last_used=$(jq -r '.last_used' "$RALPH_SESSION_FILE")
    [[ "$last_used" != "2026-01-01T00:05:00Z" ]]
}

@test "save_claude_session rewrites a matching active session when created_at is invalid" {
    local output_file="$RALPH_DIR/test_output.json"
    echo '{"metadata": {"session_id": "ses-abc-123"}}' > "$output_file"
    echo '{"session_id":"ses-abc-123","created_at":"not-a-date","last_used":"2026-01-01T00:05:00Z"}' > "$RALPH_SESSION_FILE"

    save_claude_session "$output_file"

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    [[ "$created_at" != "not-a-date" && -n "$created_at" ]]

    local last_used
    last_used=$(jq -r '.last_used' "$RALPH_SESSION_FILE")
    assert_equal "$last_used" "$created_at"
}

@test "save_claude_session rewrites a matching active session when created_at is in the future" {
    local output_file="$RALPH_DIR/test_output.json"
    echo '{"metadata": {"session_id": "ses-abc-123"}}' > "$output_file"
    echo '{"session_id":"ses-abc-123","created_at":"2999-01-01T00:00:00Z","last_used":"2026-01-01T00:05:00Z"}' > "$RALPH_SESSION_FILE"

    save_claude_session "$output_file"

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    [[ "$created_at" != "2999-01-01T00:00:00Z" && -n "$created_at" ]]

    local last_used
    last_used=$(jq -r '.last_used' "$RALPH_SESSION_FILE")
    assert_equal "$last_used" "$created_at"
}

@test "save_claude_session does nothing when output file missing" {
    rm -f "$CLAUDE_SESSION_FILE"
    save_claude_session "$RALPH_DIR/nonexistent.json"
    [[ ! -f "$CLAUDE_SESSION_FILE" ]]
}

# ===========================================================================
# reset_session
# ===========================================================================

@test "reset_session clears Claude session file" {
    echo "old-session" > "$CLAUDE_SESSION_FILE"
    reset_session "test_reset"
    [[ ! -f "$CLAUDE_SESSION_FILE" ]]
}

@test "reset_session resets exit signals to empty arrays" {
    echo '{"test_only_loops": [1,2], "done_signals": [3], "completion_indicators": [4]}' > "$EXIT_SIGNALS_FILE"
    reset_session "test_reset"
    local test_loops
    test_loops=$(jq '.test_only_loops | length' "$EXIT_SIGNALS_FILE")
    assert_equal "$test_loops" "0"
}

@test "reset_session writes reason to session file" {
    reset_session "circuit_breaker_open"
    [[ -f "$RALPH_SESSION_FILE" ]]
    local reason
    reason=$(jq -r '.reset_reason' "$RALPH_SESSION_FILE")
    assert_equal "$reason" "circuit_breaker_open"
}

@test "reset_session writes an inactive payload without active-session timestamps" {
    reset_session "permission_denied"

    local session_id
    session_id=$(jq -r '.session_id' "$RALPH_SESSION_FILE")
    assert_equal "$session_id" ""

    local has_created_at
    has_created_at=$(jq 'has("created_at")' "$RALPH_SESSION_FILE")
    assert_equal "$has_created_at" "false"

    local has_last_used
    has_last_used=$(jq 'has("last_used")' "$RALPH_SESSION_FILE")
    assert_equal "$has_last_used" "false"
}

@test "init_session_tracking recreates an active session from an inactive payload" {
    echo '{"session_id":"","reset_at":"2026-03-13T09:10:53+00:00","reset_reason":"permission_denied"}' > "$RALPH_SESSION_FILE"

    init_session_tracking

    local session_id
    session_id=$(jq -r '.session_id' "$RALPH_SESSION_FILE")
    [[ -n "$session_id" ]]

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    [[ "$created_at" != "null" && -n "$created_at" ]]
}

@test "init_session_tracking recreates an active session from a legacy reset payload" {
    echo '{"session_id":"","created_at":"","last_used":"","reset_at":"2026-03-13T09:10:53+00:00","reset_reason":"permission_denied"}' > "$RALPH_SESSION_FILE"

    init_session_tracking

    local session_id
    session_id=$(jq -r '.session_id' "$RALPH_SESSION_FILE")
    [[ -n "$session_id" ]]

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    [[ "$created_at" != "null" && -n "$created_at" ]]
}

@test "init_session_tracking recreates an active session from an invalid active payload" {
    echo '{"session_id":"ses-abc-123","created_at":"not-a-date","last_used":"2026-03-13T09:10:53+00:00"}' > "$RALPH_SESSION_FILE"

    init_session_tracking

    local session_id
    session_id=$(jq -r '.session_id' "$RALPH_SESSION_FILE")
    [[ "$session_id" != "ses-abc-123" && -n "$session_id" ]]

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    [[ "$created_at" != "not-a-date" && -n "$created_at" ]]
}

@test "init_session_tracking recreates an active session from a future active payload" {
    echo '{"session_id":"ses-abc-123","created_at":"2999-01-01T00:00:00Z","last_used":"2026-03-13T09:10:53+00:00"}' > "$RALPH_SESSION_FILE"

    init_session_tracking

    local session_id
    session_id=$(jq -r '.session_id' "$RALPH_SESSION_FILE")
    [[ "$session_id" != "ses-abc-123" && -n "$session_id" ]]

    local created_at
    created_at=$(jq -r '.created_at' "$RALPH_SESSION_FILE")
    [[ "$created_at" != "2999-01-01T00:00:00Z" && -n "$created_at" ]]
}

@test "update_session_last_used leaves inactive payloads unchanged" {
    echo '{"session_id":"","reset_at":"2026-03-13T09:10:53+00:00","reset_reason":"permission_denied"}' > "$RALPH_SESSION_FILE"

    update_session_last_used

    local has_last_used
    has_last_used=$(jq 'has("last_used")' "$RALPH_SESSION_FILE")
    assert_equal "$has_last_used" "false"
}

# ===========================================================================
# log_session_transition
# ===========================================================================

@test "log_session_transition creates history file on first call" {
    rm -f "$RALPH_SESSION_HISTORY_FILE"
    log_session_transition "active" "reset" "test_reason" 5
    [[ -f "$RALPH_SESSION_HISTORY_FILE" ]]
    local count
    count=$(jq 'length' "$RALPH_SESSION_HISTORY_FILE")
    assert_equal "$count" "1"
}

@test "log_session_transition appends to existing history" {
    echo '[{"timestamp": "2024-01-01T00:00:00", "from_state": "init", "to_state": "active", "reason": "start", "loop_number": 0}]' > "$RALPH_SESSION_HISTORY_FILE"
    log_session_transition "active" "reset" "another_reason" 10
    local count
    count=$(jq 'length' "$RALPH_SESSION_HISTORY_FILE")
    assert_equal "$count" "2"
}

@test "log_session_transition caps history at 50 entries" {
    # Create 50 existing entries
    local entries='['
    for i in $(seq 1 50); do
        [[ $i -gt 1 ]] && entries+=','
        entries+="{\"timestamp\":\"t\",\"from_state\":\"a\",\"to_state\":\"b\",\"reason\":\"r\",\"loop_number\":$i}"
    done
    entries+=']'
    echo "$entries" > "$RALPH_SESSION_HISTORY_FILE"

    log_session_transition "active" "reset" "overflow" 51
    local count
    count=$(jq 'length' "$RALPH_SESSION_HISTORY_FILE")
    assert_equal "$count" "50"
}

# ===========================================================================
# Tier 3 — External dependencies
# ===========================================================================

# ===========================================================================
# load_platform_driver
# ===========================================================================

@test "load_platform_driver: loads claude-code driver and sets CLAUDE_CODE_CMD" {
    PLATFORM_DRIVER="claude-code"
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    load_platform_driver
    assert_equal "$CLAUDE_CODE_CMD" "claude"
}

@test "load_platform_driver: sets driver display name for runtime logging" {
    PLATFORM_DRIVER="cursor"
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    load_platform_driver
    assert_equal "$DRIVER_DISPLAY_NAME" "Cursor CLI"
}

@test "load_platform_driver: loads opencode driver and sets display name" {
    PLATFORM_DRIVER="opencode"
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    load_platform_driver
    assert_equal "$CLAUDE_CODE_CMD" "opencode"
    assert_equal "$DRIVER_DISPLAY_NAME" "OpenCode"
}

@test "setup_tmux_session uses the active driver name for the output pane" {
    PLATFORM_DRIVER="cursor"
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    DRIVER_DISPLAY_NAME="Claude Code"
    CLAUDE_CODE_CMD="claude"

    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/tmux" <<'TMUX'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$RALPH_DIR/tmux.log"
if [[ "$1" == "show-options" ]]; then
    echo "0"
fi
exit 0
TMUX
    chmod +x "$RALPH_DIR/bin/tmux"
    export PATH="$RALPH_DIR/bin:$PATH"

    exit() {
        return "${1:-0}"
    }

    setup_tmux_session

    assert_equal "$DRIVER_DISPLAY_NAME" "Cursor CLI"
    [[ "$CLAUDE_CODE_CMD" != "claude" ]]
    assert_file_exist "$RALPH_DIR/tmux.log"
    run grep -F -- "select-pane -t" "$RALPH_DIR/tmux.log"
    assert_output --partial "Cursor CLI Output"
}

@test "setup_tmux_session uses SCRIPT_DIR not HOME/.ralph for ralph_home fallback" {
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="claude-code"
    DRIVER_DISPLAY_NAME="Claude Code"
    CLAUDE_CODE_CMD="claude"

    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/tmux" <<'TMUX'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$RALPH_DIR/tmux.log"
if [[ "$1" == "show-options" ]]; then
    echo "0"
fi
exit 0
TMUX
    chmod +x "$RALPH_DIR/bin/tmux"
    export PATH="$RALPH_DIR/bin:$PATH"

    exit() {
        return "${1:-0}"
    }

    setup_tmux_session

    assert_file_exist "$RALPH_DIR/tmux.log"
    run grep "ralph_loop.sh" "$RALPH_DIR/tmux.log"
    assert_success
    run grep -- "ralph_loop.sh" "$RALPH_DIR/tmux.log"
    refute_output --partial "$HOME/.ralph"
    assert_output --partial "$SCRIPT_DIR/ralph_loop.sh"
}

@test "load_platform_driver: fails for non-existent driver" {
    PLATFORM_DRIVER="nonexistent-platform"
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    run load_platform_driver
    assert_failure
}

# ===========================================================================
# User-facing help and guidance
# ===========================================================================

@test "show_help uses driver-agnostic bmalph guidance" {
    run show_help

    assert_success
    assert_output --partial "Ralph Loop"
    assert_output --partial "Use 'bmalph init'"
    assert_output --partial "Show live driver output in real-time"
    assert_output --partial "Set driver execution timeout in minutes"
    assert_output --partial "Ignored by codex, opencode, cursor, and copilot"
    assert_output --partial "bmalph run"
    refute_output --partial "Ralph Loop for Claude Code"
    refute_output --partial "Show Claude Code output in real-time"
    refute_output --partial "ralph-setup my-project"
}

@test "main recommends bmalph commands when the prompt file is missing" {
    SCRIPT_DIR="$PROJECT_ROOT/ralph"

    run main

    assert_failure
    assert_output --partial "Prompt file '$RALPH_DIR/PROMPT.md' not found!"
    assert_output --partial "Initialize bmalph in this project: bmalph init"
    assert_output --partial "Restore bundled Ralph files in an existing project: bmalph upgrade"
    assert_output --partial "Generate Ralph task files after planning: bmalph implement"
    refute_output --partial "ralph-enable"
    refute_output --partial "ralph-setup"
    refute_output --partial "ralph-import"
}

# ===========================================================================
# should_exit_gracefully
# ===========================================================================

@test "should_exit_gracefully returns empty when no signals" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    rm -f "$RESPONSE_ANALYSIS_FILE"
    rm -f "$RALPH_DIR/@fix_plan.md"
    local result
    result=$(should_exit_gracefully)
    assert_equal "$result" ""
}

@test "should_exit_gracefully ignores permission denials in continue mode" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    _mock_response_analysis true false false 0
    local result
    result=$(should_exit_gracefully)
    assert_equal "$result" ""
}

@test "should_exit_gracefully ignores stale permission denials in halt mode" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    jq -n \
        --arg summary "Permission was denied in the prior loop." \
        '{
            analysis: {
                has_permission_denials: true,
                permission_denial_count: 1,
                denied_commands: ["AskUserQuestion"],
                work_summary: $summary,
                exit_signal: false
            }
        }' > "$RESPONSE_ANALYSIS_FILE"
    PERMISSION_DENIAL_MODE="halt"
    set -e

    run should_exit_gracefully
    assert_success
    assert_output ""
}

@test "should_exit_gracefully ignores permission denials in threshold mode" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    _mock_response_analysis true false false 0
    PERMISSION_DENIAL_MODE="threshold"
    local result
    result=$(should_exit_gracefully)
    assert_equal "$result" ""
}

@test "should_exit_gracefully ignores denied completion loops for completion_signals" {
    echo '{"test_only_loops": [], "done_signals": [1], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    PERMISSION_DENIAL_MODE="continue"
    jq -n \
        '{
            loop_number: 2,
            analysis: {
                is_test_only: false,
                has_progress: true,
                has_completion_signal: true,
                exit_signal: true,
                has_permission_denials: true,
                permission_denial_count: 1,
                denied_commands: ["AskUserQuestion"],
                work_summary: "Approval was required before implementation could continue."
            }
        }' > "$RESPONSE_ANALYSIS_FILE"
    set -e

    update_exit_signals "$RESPONSE_ANALYSIS_FILE" "$EXIT_SIGNALS_FILE"
    consume_current_loop_permission_denial 2 > /dev/null 2>&1

    run should_exit_gracefully
    assert_success
    assert_output ""
}

@test "should_exit_gracefully ignores denied completion loops for project_complete" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": [1]}' > "$EXIT_SIGNALS_FILE"
    PERMISSION_DENIAL_MODE="continue"
    jq -n \
        '{
            loop_number: 2,
            analysis: {
                is_test_only: false,
                has_progress: true,
                has_completion_signal: true,
                exit_signal: true,
                has_permission_denials: true,
                permission_denial_count: 1,
                denied_commands: ["AskUserQuestion"],
                work_summary: "Approval was required before implementation could continue."
            }
        }' > "$RESPONSE_ANALYSIS_FILE"
    set -e

    update_exit_signals "$RESPONSE_ANALYSIS_FILE" "$EXIT_SIGNALS_FILE"
    consume_current_loop_permission_denial 2 > /dev/null 2>&1

    run should_exit_gracefully
    assert_success
    assert_output ""
}

@test "should_exit_gracefully ignores denied completion loops for safety_circuit_breaker" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": [1,2,3,4]}' > "$EXIT_SIGNALS_FILE"
    PERMISSION_DENIAL_MODE="continue"
    jq -n \
        '{
            loop_number: 5,
            analysis: {
                is_test_only: false,
                has_progress: true,
                has_completion_signal: true,
                exit_signal: true,
                has_permission_denials: true,
                permission_denial_count: 1,
                denied_commands: ["AskUserQuestion"],
                work_summary: "Approval was required before implementation could continue."
            }
        }' > "$RESPONSE_ANALYSIS_FILE"
    set -e

    update_exit_signals "$RESPONSE_ANALYSIS_FILE" "$EXIT_SIGNALS_FILE"
    consume_current_loop_permission_denial 5 > /dev/null 2>&1

    run should_exit_gracefully
    assert_success
    assert_output ""
}

@test "handle_permission_denial continues without resetting the session" {
    echo '{"session_id":"ralph-session","created_at":"2026-01-01T00:00:00Z","last_used":"2026-01-01T00:00:00Z"}' \
        > "$RALPH_SESSION_FILE"
    echo "claude-session-123" > "$CLAUDE_SESSION_FILE"
    echo "4" > "$CALL_COUNT_FILE"
    set -e

    handle_permission_denial 2 "Bash(node --version)" > /dev/null 2>&1

    run echo "$PERMISSION_DENIAL_ACTION"
    assert_success
    assert_output "continue"

    run cat "$CLAUDE_SESSION_FILE"
    assert_output "claude-session-123"

    run cat "$STATUS_FILE"
    assert_output --partial '"status": "running"'

    run cat "$STATUS_FILE"
    assert_output --partial '"last_action": "permission_denied"'
}

@test "handle_permission_denial halts and resets the session in halt mode" {
    echo '{"session_id":"ralph-session","created_at":"2026-01-01T00:00:00Z","last_used":"2026-01-01T00:00:00Z"}' \
        > "$RALPH_SESSION_FILE"
    echo "claude-session-123" > "$CLAUDE_SESSION_FILE"
    echo "4" > "$CALL_COUNT_FILE"
    PERMISSION_DENIAL_MODE="halt"
    set -e

    handle_permission_denial 2 "Bash(node --version)" > /dev/null 2>&1

    run echo "$PERMISSION_DENIAL_ACTION"
    assert_success
    assert_output "halt"

    [[ ! -f "$CLAUDE_SESSION_FILE" ]]

    run cat "$STATUS_FILE"
    assert_output --partial '"status": "halted"'
}

@test "consume_current_loop_permission_denial halts in the loop that produced the denial" {
    echo '{"session_id":"ralph-session","created_at":"2026-01-01T00:00:00Z","last_used":"2026-01-01T00:00:00Z"}' \
        > "$RALPH_SESSION_FILE"
    echo "claude-session-123" > "$CLAUDE_SESSION_FILE"
    echo "4" > "$CALL_COUNT_FILE"
    jq -n \
        --arg summary "Attempted to continue implementation work." \
        '{
            analysis: {
                has_permission_denials: true,
                permission_denial_count: 1,
                denied_commands: ["AskUserQuestion"],
                work_summary: $summary,
                exit_signal: false
            }
        }' > "$RESPONSE_ANALYSIS_FILE"
    PERMISSION_DENIAL_MODE="halt"
    set -e

    consume_current_loop_permission_denial 2 > /dev/null 2>&1

    run echo "$PERMISSION_DENIAL_ACTION"
    assert_success
    assert_output "halt"

    [[ ! -f "$CLAUDE_SESSION_FILE" ]]

    run cat "$STATUS_FILE"
    assert_output --partial '"status": "halted"'
}

@test "consume_current_loop_permission_denial clears denial fields and preserves the summary" {
    echo "4" > "$CALL_COUNT_FILE"
    jq -n \
        --arg summary "Implemented the auth recovery flow." \
        '{
            analysis: {
                has_completion_signal: true,
                has_permission_denials: true,
                permission_denial_count: 1,
                denied_commands: ["AskUserQuestion"],
                work_summary: $summary,
                exit_signal: true
            }
        }' > "$RESPONSE_ANALYSIS_FILE"
    PERMISSION_DENIAL_MODE="continue"
    set -e

    consume_current_loop_permission_denial 2 > /dev/null 2>&1

    run echo "$PERMISSION_DENIAL_ACTION"
    assert_success
    assert_output "continue"

    run cat "$RESPONSE_ANALYSIS_FILE"
    assert_output --partial '"has_permission_denials": false'

    run cat "$RESPONSE_ANALYSIS_FILE"
    assert_output --partial '"permission_denial_count": 0'

    run cat "$RESPONSE_ANALYSIS_FILE"
    assert_output --partial '"denied_commands": []'

    run cat "$RESPONSE_ANALYSIS_FILE"
    assert_output --partial '"has_completion_signal": false'

    run cat "$RESPONSE_ANALYSIS_FILE"
    assert_output --partial '"exit_signal": false'

    run cat "$RESPONSE_ANALYSIS_FILE"
    assert_output --partial '"work_summary": "Implemented the auth recovery flow."'

    run build_loop_context 3
    assert_success
    assert_output --partial "Previous: Implemented the auth recovery flow."
}

@test "should_exit_gracefully detects test_saturation" {
    echo '{"test_only_loops": [1,2,3], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    rm -f "$RESPONSE_ANALYSIS_FILE"
    local result
    result=$(should_exit_gracefully)
    assert_equal "$result" "test_saturation"
}

@test "should_exit_gracefully detects plan_complete" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    rm -f "$RESPONSE_ANALYSIS_FILE"
    cat > "$RALPH_DIR/@fix_plan.md" << 'PLAN'
- [x] First task done
- [x] Second task done
PLAN
    local result
    result=$(should_exit_gracefully)
    assert_equal "$result" "plan_complete"
}

@test "should_exit_gracefully: no exit when incomplete tasks remain" {
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    rm -f "$RESPONSE_ANALYSIS_FILE"
    cat > "$RALPH_DIR/@fix_plan.md" << 'PLAN'
- [x] Done task
- [ ] Still pending
PLAN
    local result
    result=$(should_exit_gracefully)
    assert_equal "$result" ""
}

# ===========================================================================
# execute_claude_code
# ===========================================================================

@test "execute_claude_code: success path increments call count" {
    _skip_if_xargs_broken
    echo "0" > "$CALL_COUNT_FILE"
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"

    # Create a mock claude that outputs valid JSON
    _mock_cli claude 0 '{"result": "ok", "metadata": {"session_id": "test-session"}}'
    CLAUDE_CODE_CMD="claude"
    CLAUDE_USE_CONTINUE="false"
    LIVE_OUTPUT=false

    # Create minimal prompt file
    echo "Test prompt" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    # Load the real driver so driver_build_command is available
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="claude-code"
    load_platform_driver

    run execute_claude_code 1
    assert_success
    # Check call count was incremented
    local count
    count=$(cat "$CALL_COUNT_FILE" 2>/dev/null || echo "0")
    [[ "$count" -ge 1 ]]
}

@test "execute_claude_code: API limit returns exit code 2" {
    _skip_if_xargs_broken
    echo "0" > "$CALL_COUNT_FILE"
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"

    # Create a mock claude that fails with limit message
    _mock_cli claude 1 "Error: 5 hour usage limit reached. Please try back later."
    CLAUDE_CODE_CMD="claude"
    CLAUDE_USE_CONTINUE="false"
    LIVE_OUTPUT=false

    echo "Test prompt" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    # Load the real driver so driver_build_command is available
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="claude-code"
    load_platform_driver

    run execute_claude_code 1
    assert_equal "$status" "2"
}

@test "execute_claude_code: codex JSONL output is analyzed without silent failure" {
    _skip_if_xargs_broken
    echo "0" > "$CALL_COUNT_FILE"
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"

    _mock_cli codex 0 "$(cat "$FIXTURES_DIR/codex_jsonl_response.jsonl")"
    CLAUDE_USE_CONTINUE="true"
    LIVE_OUTPUT=false

    echo "Implement the task" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="codex"
    load_platform_driver

    run execute_claude_code 1
    assert_success

    local saved
    saved=$(cat "$CLAUDE_SESSION_FILE")
    assert_equal "$saved" "codex-thread-123"

    run jq -r '.output_format' "$RESPONSE_ANALYSIS_FILE"
    assert_output "json"

    run jq -r '.analysis.exit_signal' "$RESPONSE_ANALYSIS_FILE"
    assert_output "true"
}

@test "execute_claude_code: cursor driver resumes saved sessions" {
    _skip_if_xargs_broken
    echo "0" > "$CALL_COUNT_FILE"
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    echo "stale-session-123" > "$CLAUDE_SESSION_FILE"

    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/cursor-agent" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" > "$RALPH_DIR/cursor_args.log"
cat <<'OUT'
{"result":"Completed the auth module updates.\n\n---RALPH_STATUS---\nSTATUS: COMPLETE\nEXIT_SIGNAL: true\n---END_RALPH_STATUS---","session_id":"cursor-session-123"}
OUT
exit 0
EOF
    chmod +x "$RALPH_DIR/bin/cursor-agent"
    export PATH="$RALPH_DIR/bin:$PATH"

    CLAUDE_USE_CONTINUE="true"
    LIVE_OUTPUT=false
    export OSTYPE="linux-gnu"
    unset OS

    echo "Implement the task" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="cursor"
    load_platform_driver

    run execute_claude_code 1
    assert_success

    run grep -- "--resume" "$RALPH_DIR/cursor_args.log"
    assert_success
    assert_output --partial "stale-session-123"
}

@test "execute_claude_code: opencode driver resumes saved sessions from stream output" {
    _skip_if_xargs_broken
    echo "0" > "$CALL_COUNT_FILE"
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"
    echo "stale-opencode-session-123" > "$CLAUDE_SESSION_FILE"

    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/opencode" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" > "$RALPH_DIR/opencode_args.log"
cat <<'OUT'
{"type":"session.created","session":{"id":"opencode-session-123"}}
{"type":"message.updated","message":{"role":"assistant","parts":[{"type":"text","text":"Completed the OpenCode run.\n\n---RALPH_STATUS---\nSTATUS: COMPLETE\nEXIT_SIGNAL: true\n---END_RALPH_STATUS---"}]}}
OUT
exit 0
EOF
    chmod +x "$RALPH_DIR/bin/opencode"
    export PATH="$RALPH_DIR/bin:$PATH"

    CLAUDE_USE_CONTINUE="true"
    LIVE_OUTPUT=false

    echo "Implement the task" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="opencode"
    load_platform_driver

    run execute_claude_code 1
    assert_success

    run grep -- "--continue" "$RALPH_DIR/opencode_args.log"
    assert_success

    run grep -- "--session" "$RALPH_DIR/opencode_args.log"
    assert_success
    assert_output --partial "stale-opencode-session-123"

    run cat "$CLAUDE_SESSION_FILE"
    assert_output "opencode-session-123"
}

@test "execute_claude_code: opencode driver falls back to session list when stream omits session id" {
    _skip_if_xargs_broken
    echo "0" > "$CALL_COUNT_FILE"
    echo '{"test_only_loops": [], "done_signals": [], "completion_indicators": []}' > "$EXIT_SIGNALS_FILE"

    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/opencode" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$RALPH_DIR/opencode_fallback.log"
if [[ "$1" == "session" && "$2" == "list" ]]; then
    cat <<'JSON'
[{"id":"opencode-session-fallback-456"}]
JSON
    exit 0
fi

cat <<'OUT'
{"type":"message.updated","message":{"role":"assistant","parts":[{"type":"text","text":"Completed the OpenCode run without a session event.\n\n---RALPH_STATUS---\nSTATUS: COMPLETE\nEXIT_SIGNAL: true\n---END_RALPH_STATUS---"}]}}
OUT
exit 0
EOF
    chmod +x "$RALPH_DIR/bin/opencode"
    export PATH="$RALPH_DIR/bin:$PATH"

    CLAUDE_USE_CONTINUE="true"
    LIVE_OUTPUT=false

    echo "Implement the task" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="opencode"
    load_platform_driver

    run execute_claude_code 1
    assert_success

    run cat "$CLAUDE_SESSION_FILE"
    assert_output "opencode-session-fallback-456"

    run grep -- "session list --format json" "$RALPH_DIR/opencode_fallback.log"
    assert_success
}

@test "prepare_live_command_args converts Claude JSON mode into stream-json" {
    echo "Implement auth" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="claude-code"
    load_platform_driver
    build_claude_command "$PROMPT_FILE" "" ""

    prepare_live_command_args
    local args_str="${LIVE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--output-format stream-json" ]]
    [[ "$args_str" =~ "--verbose" ]]
    [[ "$args_str" =~ "--include-partial-messages" ]]

    run get_live_stream_filter
    assert_success
    assert_output --partial "stream_event"
}

@test "prepare_live_command_args keeps Codex JSONL command unchanged" {
    echo "Implement auth" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="codex"
    load_platform_driver
    build_claude_command "$PROMPT_FILE" "" ""

    prepare_live_command_args
    local args_str="${LIVE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--json" ]]
    [[ ! "$args_str" =~ "--include-partial-messages" ]]

    run get_live_stream_filter
    assert_success
    assert_output --partial "item.completed"
}

@test "prepare_live_command_args converts Cursor JSON mode into stream-json" {
    echo "Implement auth" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="cursor"
    load_platform_driver
    build_claude_command "$PROMPT_FILE" "" ""

    prepare_live_command_args
    local args_str="${LIVE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--output-format stream-json" ]]

    run get_live_stream_filter
    assert_success
    assert_output --partial '.type == "assistant"'
}

@test "prepare_live_command_args keeps OpenCode JSON event command unchanged" {
    echo "Implement auth" > "$RALPH_DIR/PROMPT.md"
    PROMPT_FILE="$RALPH_DIR/PROMPT.md"

    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="opencode"
    load_platform_driver
    build_claude_command "$PROMPT_FILE" "" ""

    prepare_live_command_args
    local args_str="${LIVE_CMD_ARGS[*]}"
    [[ "$args_str" =~ "--agent build --format json" ]]
    [[ "$args_str" == "${CLAUDE_CMD_ARGS[*]}" ]]

    run get_live_stream_filter
    assert_success
    assert_output --partial 'message.updated'
}

@test "supports_live_output rejects drivers without structured streams" {
    SCRIPT_DIR="$PROJECT_ROOT/ralph"
    PLATFORM_DRIVER="copilot"
    load_platform_driver

    run supports_live_output
    assert_failure
}

# ===========================================================================
# load_ralphrc — quality gate config
# ===========================================================================

@test "validate_quality_gate_mode accepts valid modes" {
    local modes=(warn block circuit-breaker)
    for mode in "${modes[@]}"; do
        run validate_quality_gate_mode "$mode"
        assert_success
    done
}

@test "validate_quality_gate_mode rejects invalid mode" {
    run validate_quality_gate_mode "blokc"
    assert_failure
    assert_output --partial "Invalid QUALITY_GATE_MODE"
    assert_output --partial "Valid modes: warn block circuit-breaker"
}

@test "validate_quality_gate_timeout accepts positive integers" {
    run validate_quality_gate_timeout 120
    assert_success

    run validate_quality_gate_timeout 1
    assert_success
}

@test "validate_quality_gate_timeout rejects non-numeric values" {
    run validate_quality_gate_timeout "abc"
    assert_failure
    assert_output --partial "must be a positive integer"
}

@test "validate_quality_gate_timeout rejects zero" {
    run validate_quality_gate_timeout 0
    assert_failure
    assert_output --partial "must be a positive integer"
}

@test "load_ralphrc applies QUALITY_GATES from config" {
    cat > "$RALPH_DIR/.ralphrc" <<'EOF'
QUALITY_GATES="npm run lint;npm run type-check"
QUALITY_GATE_MODE="block"
TEST_COMMAND="npm test"
EOF
    RALPHRC_FILE="$RALPH_DIR/.ralphrc"

    load_ralphrc

    assert_equal "$QUALITY_GATES" "npm run lint;npm run type-check"
    assert_equal "$QUALITY_GATE_MODE" "block"
    assert_equal "$TEST_COMMAND" "npm test"
}

@test "load_ralphrc applies QUALITY_GATE_TIMEOUT and QUALITY_GATE_ON_COMPLETION_ONLY from config" {
    cat > "$RALPH_DIR/.ralphrc" <<'EOF'
QUALITY_GATE_TIMEOUT="60"
QUALITY_GATE_ON_COMPLETION_ONLY="true"
EOF
    RALPHRC_FILE="$RALPH_DIR/.ralphrc"

    load_ralphrc

    assert_equal "$QUALITY_GATE_TIMEOUT" "60"
    assert_equal "$QUALITY_GATE_ON_COMPLETION_ONLY" "true"
}

@test "load_ralphrc env vars override QUALITY_GATE_TIMEOUT and QUALITY_GATE_ON_COMPLETION_ONLY" {
    cat > "$RALPH_DIR/.ralphrc" <<'EOF'
QUALITY_GATE_TIMEOUT="60"
QUALITY_GATE_ON_COMPLETION_ONLY="true"
EOF
    RALPHRC_FILE="$RALPH_DIR/.ralphrc"
    _env_QUALITY_GATE_TIMEOUT="30"
    _env_QUALITY_GATE_ON_COMPLETION_ONLY="false"

    load_ralphrc

    assert_equal "$QUALITY_GATE_TIMEOUT" "30"
    assert_equal "$QUALITY_GATE_ON_COMPLETION_ONLY" "false"
}

@test "load_ralphrc env vars override quality gate config" {
    cat > "$RALPH_DIR/.ralphrc" <<'EOF'
QUALITY_GATE_MODE="block"
TEST_COMMAND="npm test"
EOF
    RALPHRC_FILE="$RALPH_DIR/.ralphrc"
    _env_QUALITY_GATE_MODE="circuit-breaker"
    _env_TEST_COMMAND="pytest"

    load_ralphrc

    assert_equal "$QUALITY_GATE_MODE" "circuit-breaker"
    assert_equal "$TEST_COMMAND" "pytest"
}

# ===========================================================================
# run_test_gate
# ===========================================================================

@test "run_test_gate skips when no analysis file exists" {
    run run_test_gate "$RALPH_DIR/nonexistent.json"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "skip"
}

@test "run_test_gate passes when tests_status is PASSING" {
    jq -n '{analysis: {tests_status: "PASSING"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "pass"
}

@test "run_test_gate fails when tests_status is FAILING and no TEST_COMMAND" {
    jq -n '{analysis: {tests_status: "FAILING"}}' > "$RESPONSE_ANALYSIS_FILE"
    TEST_COMMAND=""

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "fail"

    run jq -r '.verified' <<< "$json"
    assert_output "false"
}

@test "run_test_gate verifies with TEST_COMMAND when tests_status is FAILING and command succeeds" {
    jq -n '{analysis: {tests_status: "FAILING"}}' > "$RESPONSE_ANALYSIS_FILE"
    _mock_cli "npm" 0 "All tests passed"
    TEST_COMMAND="npm test"

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "pass"

    run jq -r '.verified' <<< "$json"
    assert_output "true"
}

@test "run_test_gate verifies with TEST_COMMAND when tests_status is FAILING and command fails" {
    jq -n '{analysis: {tests_status: "FAILING"}}' > "$RESPONSE_ANALYSIS_FILE"
    _mock_cli "npm" 1 "3 tests failed"
    TEST_COMMAND="npm test"

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "fail"

    run jq -r '.verified' <<< "$json"
    assert_output "true"
}

@test "run_test_gate verifies with TEST_COMMAND when tests_status is PASSING and command fails" {
    jq -n '{analysis: {tests_status: "PASSING"}}' > "$RESPONSE_ANALYSIS_FILE"
    _mock_cli "npm" 1 "3 tests failed"
    TEST_COMMAND="npm test"

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "fail"

    run jq -r '.verified' <<< "$json"
    assert_output "true"
}

@test "run_test_gate verifies with TEST_COMMAND when tests_status is PASSING and command succeeds" {
    jq -n '{analysis: {tests_status: "PASSING"}}' > "$RESPONSE_ANALYSIS_FILE"
    _mock_cli "npm" 0 "All tests passed"
    TEST_COMMAND="npm test"

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "pass"

    run jq -r '.verified' <<< "$json"
    assert_output "true"
}

@test "run_test_gate skips when tests_status is UNKNOWN and no TEST_COMMAND" {
    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"
    TEST_COMMAND=""

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "skip"
}

@test "run_test_gate runs TEST_COMMAND when tests_status is UNKNOWN and TEST_COMMAND is set" {
    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"
    _mock_cli "npm" 0 "All tests passed"
    TEST_COMMAND="npm test"

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "pass"

    run jq -r '.verified' <<< "$json"
    assert_output "true"

    run jq -r '.tests_status_reported' <<< "$json"
    assert_output "UNKNOWN"
}

@test "run_test_gate reports fail when TEST_COMMAND times out" {
    jq -n '{analysis: {tests_status: "PASSING"}}' > "$RESPONSE_ANALYSIS_FILE"
    _mock_cli "npm" 124 "Command timed out"
    TEST_COMMAND="npm test"

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "fail"

    run jq -r '.verified' <<< "$json"
    assert_output "true"
}

@test "run_test_gate passes for unexpected status values without TEST_COMMAND" {
    jq -n '{analysis: {tests_status: "NOT_RUN"}}' > "$RESPONSE_ANALYSIS_FILE"
    TEST_COMMAND=""

    run run_test_gate "$RESPONSE_ANALYSIS_FILE"
    assert_success

    local json="$output"
    run jq -r '.status' <<< "$json"
    assert_output "pass"

    run jq -r '.verified' <<< "$json"
    assert_output "false"
}

# ===========================================================================
# run_custom_gates
# ===========================================================================

@test "run_custom_gates returns empty array when no gates configured" {
    QUALITY_GATES=""

    run run_custom_gates
    assert_success

    local json="$output"
    run jq 'length' <<< "$json"
    assert_output "0"
}

@test "run_custom_gates runs semicolon-separated commands" {
    QUALITY_GATES="true;true"
    QUALITY_GATE_TIMEOUT=5

    run run_custom_gates
    assert_success

    local json="$output"
    run jq 'length' <<< "$json"
    assert_output "2"

    run jq -r '.[0].status' <<< "$json"
    assert_output "pass"

    run jq -r '.[1].status' <<< "$json"
    assert_output "pass"
}

@test "run_custom_gates records failure exit codes" {
    _mock_cli "failing-lint" 1 "lint error found"
    QUALITY_GATES="failing-lint"
    QUALITY_GATE_TIMEOUT=5

    run run_custom_gates
    assert_success

    local json="$output"
    run jq -r '.[0].status' <<< "$json"
    assert_output "fail"

    run jq -r '.[0].exit_code' <<< "$json"
    assert_output "1"
}

@test "run_custom_gates records timeout when command exceeds limit" {
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/slow-lint" <<'SCRIPT'
#!/usr/bin/env bash
sleep 10
SCRIPT
    chmod +x "$RALPH_DIR/bin/slow-lint"
    export PATH="$RALPH_DIR/bin:$PATH"

    QUALITY_GATES="slow-lint"
    QUALITY_GATE_TIMEOUT=1

    run run_custom_gates
    assert_success

    local json="$output"
    run jq -r '.[0].status' <<< "$json"
    assert_output "fail"

    run jq -r '.[0].timed_out' <<< "$json"
    assert_output "true"
}

@test "run_custom_gates captures output truncation" {
    # Create a command that produces a lot of output
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/verbose-lint" <<'SCRIPT'
#!/usr/bin/env bash
for i in $(seq 1 200); do echo "lint warning $i: unused variable"; done
exit 1
SCRIPT
    chmod +x "$RALPH_DIR/bin/verbose-lint"
    export PATH="$RALPH_DIR/bin:$PATH"

    QUALITY_GATES="verbose-lint"
    QUALITY_GATE_TIMEOUT=5

    run run_custom_gates
    assert_success

    local json="$output"
    run jq -r '.[0].status' <<< "$json"
    assert_output "fail"

    # Output should be truncated (max 500 chars)
    local output_len
    output_len=$(jq -r '.[0].output | length' <<< "$json")
    [[ $output_len -le 500 ]]
}

@test "run_custom_gates skips empty entries from double semicolons" {
    _mock_cli "lint-a" 0 "ok"
    _mock_cli "lint-b" 0 "ok"
    QUALITY_GATES="lint-a;;lint-b"
    QUALITY_GATE_TIMEOUT=5

    run run_custom_gates
    assert_success

    local json="$output"
    run jq 'length' <<< "$json"
    assert_output "2"

    run jq -r '.[0].command' <<< "$json"
    assert_output "lint-a"

    run jq -r '.[1].command' <<< "$json"
    assert_output "lint-b"
}

# ===========================================================================
# run_quality_gates
# ===========================================================================

@test "run_quality_gates returns 0 when no gates configured" {
    TEST_COMMAND=""
    QUALITY_GATES=""

    run run_quality_gates 1 "false"
    assert_success
    assert_output "0"
}

@test "run_quality_gates skips in completion-only mode when not completing" {
    QUALITY_GATE_ON_COMPLETION_ONLY="true"
    TEST_COMMAND="npm test"
    QUALITY_GATES="npm run lint"

    run run_quality_gates 1 "false"
    assert_success
    assert_output "0"
}

@test "run_quality_gates runs in completion-only mode when completing" {
    QUALITY_GATE_ON_COMPLETION_ONLY="true"
    TEST_COMMAND=""
    QUALITY_GATES="true"
    QUALITY_GATE_MODE="warn"
    QUALITY_GATE_TIMEOUT=5

    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_quality_gates 1 "true"
    assert_success
    assert_output "0"

    assert [ -f "$QUALITY_GATE_RESULTS_FILE" ]
}

@test "run_quality_gates returns 0 when all gates pass" {
    QUALITY_GATES="true"
    QUALITY_GATE_MODE="block"
    QUALITY_GATE_TIMEOUT=5
    TEST_COMMAND=""
    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_quality_gates 1 "false"
    assert_success
    assert_output "0"
}

@test "run_quality_gates returns 1 in block mode on failure" {
    _mock_cli "failing-lint" 1 "error"
    QUALITY_GATES="failing-lint"
    QUALITY_GATE_MODE="block"
    QUALITY_GATE_TIMEOUT=5
    TEST_COMMAND=""
    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_quality_gates 1 "false"
    assert_success
    assert_output "1"
}

@test "run_quality_gates returns 2 in circuit-breaker mode on failure" {
    _mock_cli "failing-lint" 1 "error"
    QUALITY_GATES="failing-lint"
    QUALITY_GATE_MODE="circuit-breaker"
    QUALITY_GATE_TIMEOUT=5
    TEST_COMMAND=""
    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_quality_gates 1 "false"
    assert_success
    assert_output "2"
}

@test "run_quality_gates returns 0 in warn mode even on failure" {
    _mock_cli "failing-lint" 1 "error"
    QUALITY_GATES="failing-lint"
    QUALITY_GATE_MODE="warn"
    QUALITY_GATE_TIMEOUT=5
    TEST_COMMAND=""
    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_quality_gates 1 "false"
    assert_success
    assert_output "0"
}

@test "run_quality_gates detects combined test and custom gate failure" {
    _mock_cli "failing-lint" 1 "error"
    QUALITY_GATES="failing-lint"
    QUALITY_GATE_MODE="block"
    QUALITY_GATE_TIMEOUT=5
    TEST_COMMAND=""
    jq -n '{analysis: {tests_status: "FAILING"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_quality_gates 1 "false"
    assert_success
    assert_output "1"

    run jq -r '.test_gate.status' "$QUALITY_GATE_RESULTS_FILE"
    assert_output "fail"

    run jq -r '.custom_gates[0].status' "$QUALITY_GATE_RESULTS_FILE"
    assert_output "fail"

    run jq -r '.overall_status' "$QUALITY_GATE_RESULTS_FILE"
    assert_output "fail"
}

@test "run_quality_gates writes results file" {
    QUALITY_GATES="true"
    QUALITY_GATE_MODE="warn"
    QUALITY_GATE_TIMEOUT=5
    TEST_COMMAND=""
    jq -n '{analysis: {tests_status: "UNKNOWN"}}' > "$RESPONSE_ANALYSIS_FILE"

    run run_quality_gates 3 "false"
    assert_success

    assert [ -f "$QUALITY_GATE_RESULTS_FILE" ]

    run jq -r '.loop_number' "$QUALITY_GATE_RESULTS_FILE"
    assert_output "3"

    run jq -r '.overall_status' "$QUALITY_GATE_RESULTS_FILE"
    assert_output "pass"
}

# ===========================================================================
# build_loop_context — quality gate feedback
# ===========================================================================

@test "build_loop_context includes gate failure info in block mode" {
    jq -n '{
        overall_status: "fail",
        mode: "block",
        test_gate: {status: "skip"},
        custom_gates: [{command: "lint", status: "fail"}]
    }' > "$QUALITY_GATE_RESULTS_FILE"

    run build_loop_context 5
    assert_success
    assert_output --partial "QG fail:"
}

@test "build_loop_context includes test failure info in block mode" {
    jq -n '{
        overall_status: "fail",
        mode: "block",
        test_gate: {status: "fail"},
        custom_gates: []
    }' > "$QUALITY_GATE_RESULTS_FILE"

    run build_loop_context 5
    assert_success
    assert_output --partial "TESTS FAILING."
}

@test "build_loop_context omits gate failure info in warn mode" {
    jq -n '{
        overall_status: "fail",
        mode: "warn",
        test_gate: {status: "fail"},
        custom_gates: [{command: "lint", status: "fail"}]
    }' > "$QUALITY_GATE_RESULTS_FILE"

    run build_loop_context 5
    assert_success
    refute_output --partial "TESTS FAILING"
    refute_output --partial "QG fail"
}

@test "build_loop_context includes gate failure info in circuit-breaker mode" {
    jq -n '{
        overall_status: "fail",
        mode: "circuit-breaker",
        test_gate: {status: "fail"},
        custom_gates: [{command: "lint", status: "fail"}]
    }' > "$QUALITY_GATE_RESULTS_FILE"

    run build_loop_context 5
    assert_success
    assert_output --partial "TESTS FAILING."
    assert_output --partial "QG fail:"
}

@test "build_loop_context omits gate feedback when gates pass" {
    jq -n '{
        overall_status: "pass",
        mode: "block",
        test_gate: {status: "pass"},
        custom_gates: [{command: "lint", status: "pass"}]
    }' > "$QUALITY_GATE_RESULTS_FILE"

    run build_loop_context 5
    assert_success
    refute_output --partial "TESTS FAILING"
    refute_output --partial "QG fail"
}
