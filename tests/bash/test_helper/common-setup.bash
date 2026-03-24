#!/usr/bin/env bash
# Common test setup for bats tests
# Load this in each test file with: load 'test_helper/common-setup'
# Then call _common_setup in setup()

_common_setup() {
    local helper_dir
    helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Load bats helpers
    _load_helper "$helper_dir" "bats-support"
    _load_helper "$helper_dir" "bats-assert"

    # Project paths
    PROJECT_ROOT="$(cd "$helper_dir/../../.." && pwd)"
    RALPH_LIB="$PROJECT_ROOT/ralph/lib"
    RALPH_DRIVERS="$PROJECT_ROOT/ralph/drivers"
    FIXTURES_DIR="$PROJECT_ROOT/tests/bash/fixtures"

    # Create temp RALPH_DIR for test isolation
    RALPH_DIR="$(mktemp -d)"
    export RALPH_DIR
    mkdir -p "$RALPH_DIR/logs"
}

_common_teardown() {
    if [[ -n "$RALPH_DIR" && -d "$RALPH_DIR" ]]; then
        rm -rf "$RALPH_DIR"
    fi
}

# Generate ISO timestamp for N minutes ago (useful for cooldown/expiry tests)
_minutes_ago_iso() {
    local minutes=$1
    local epoch=$(($(date +%s) - minutes * 60))
    date -u -d "@$epoch" -Iseconds 2>/dev/null || \
        date -u -r "$epoch" +"%Y-%m-%dT%H:%M:%S+00:00" 2>/dev/null
}

# Create a mock .response_analysis file for circuit breaker tests
_mock_response_analysis() {
    local has_permission_denials="${1:-false}"
    local has_completion_signal="${2:-false}"
    local exit_signal="${3:-false}"
    local files_modified="${4:-0}"

    jq -n \
        --argjson hpd "$has_permission_denials" \
        --argjson hcs "$has_completion_signal" \
        --argjson es "$exit_signal" \
        --argjson fm "$files_modified" \
        '{analysis: {has_permission_denials: $hpd, has_completion_signal: $hcs, exit_signal: $es, files_modified: $fm}}' \
        > "$RALPH_DIR/.response_analysis"
}

# Quiet wrapper for record_loop_result — suppresses color console output.
# Use in test setup steps instead of `record_loop_result ... > /dev/null 2>&1`.
_quiet_record() {
    record_loop_result "$@" > /dev/null 2>&1
}

# Skip test if xargs is broken (Windows Git Bash: environment too large for exec)
# The response_analyzer.sh uses xargs for whitespace trimming in RALPH_STATUS parsing.
# On Windows, exported bash functions bloat the environment beyond xargs limits.
_skip_if_xargs_broken() {
    if ! echo "test" | xargs echo > /dev/null 2>&1; then
        skip "xargs unavailable (environment too large — Windows limitation)"
    fi
}

_skip_if_jq_missing() {
    if ! command -v jq >/dev/null 2>&1; then
        skip "jq unavailable in bash PATH"
    fi
}

# Create a mock CLI command in $RALPH_DIR/bin and prepend to PATH.
# The mock script outputs $stdout (if given) and exits with $exit_code.
# For argument-aware mocks, write a custom script to $RALPH_DIR/bin/$cmd instead.
# Usage: _mock_cli <command> [exit_code] [stdout_content]
_mock_cli() {
    local cmd=$1 exit_code=${2:-0} stdout=${3:-}
    mkdir -p "$RALPH_DIR/bin"
    printf '#!/usr/bin/env bash\n' > "$RALPH_DIR/bin/$cmd"
    [[ -n "$stdout" ]] && printf 'cat << '"'"'MOCK_OUT'"'"'\n%s\nMOCK_OUT\n' "$stdout" >> "$RALPH_DIR/bin/$cmd"
    printf 'exit %d\n' "$exit_code" >> "$RALPH_DIR/bin/$cmd"
    chmod +x "$RALPH_DIR/bin/$cmd"
    if [[ ":$PATH:" != *":$RALPH_DIR/bin:"* ]]; then
        export PATH="$RALPH_DIR/bin:$PATH"
    fi
    return 0
}

# Load a bats helper from local test_helper or system paths
_load_helper() {
    local base_dir=$1
    local name=$2

    # Local test_helper directory (CI clones here, setup-bats.sh installs here)
    if [[ -f "$base_dir/$name/load.bash" ]]; then
        load "$base_dir/$name/load"
        return
    fi

    # System-wide locations
    local dir
    for dir in /usr/lib /usr/local/lib /opt/homebrew/lib; do
        if [[ -f "$dir/$name/load.bash" ]]; then
            load "$dir/$name/load"
            return
        fi
    done

    printf 'Error: %s not found. Run: bash scripts/setup-bats.sh\n' "$name" >&2
    return 1
}
