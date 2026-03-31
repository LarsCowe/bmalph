#!/usr/bin/env bash
# Write heartbeat monitor for Ralph (#146)
# Kills the Claude driver early if no project files are modified within a
# configurable timeout window.  Prevents the agent from burning the entire
# CLAUDE_TIMEOUT_MINUTES on read-only exploration loops.

# Start a background monitor that watches for project file modifications.
#
# Args:
#   $1 - project_dir: root of the project to monitor
#   $2 - claude_pid:  PID of the portable_timeout wrapper to kill on timeout
#   $3 - timeout_minutes: minutes without a write before killing the driver
#   $4 - check_interval: seconds between filesystem checks (default 30)
#
# Env:
#   _HEARTBEAT_TIMEOUT_SECS_OVERRIDE: if set, overrides timeout_minutes * 60
#                                      (test-support only)
start_write_heartbeat() {
    local project_dir=$1 claude_pid=$2 timeout_minutes=$3 check_interval=${4:-30}
    local ralph_dir="$project_dir/.ralph"
    local marker="$ralph_dir/.heartbeat_marker"
    local timeout_secs

    if [[ -n "${_HEARTBEAT_TIMEOUT_SECS_OVERRIDE:-}" ]]; then
        timeout_secs=$_HEARTBEAT_TIMEOUT_SECS_OVERRIDE
    else
        timeout_secs=$((timeout_minutes * 60))
    fi

    # Clean stale state from previous runs
    rm -f "$ralph_dir/.write_heartbeat_triggered" \
          "$ralph_dir/.write_heartbeat_seen"

    # Timestamp marker — find -newer compares against this
    touch "$marker"

    (
        set +e  # Prevent inherited set -e from killing monitor on find errors
        trap 'exit 0' TERM

        local elapsed=0 write_seen=""

        while kill -0 "$claude_pid" 2>/dev/null; do
            sleep "$check_interval"
            elapsed=$((elapsed + check_interval))

            # Check for project file modifications (skip once detected)
            if [[ -z "$write_seen" ]]; then
                local changed
                changed=$(find "$project_dir" \
                    -path "$project_dir/.ralph" -prune -o \
                    -path "$project_dir/.git" -prune -o \
                    -path "$project_dir/node_modules" -prune -o \
                    -path "$project_dir/.next" -prune -o \
                    -path "$project_dir/dist" -prune -o \
                    -path "$project_dir/build" -prune -o \
                    -path "$project_dir/__pycache__" -prune -o \
                    -path "$project_dir/.turbo" -prune -o \
                    -newer "$marker" -type f -print -quit 2>/dev/null)

                if [[ -n "$changed" ]]; then
                    touch "$ralph_dir/.write_heartbeat_seen"
                    write_seen=true
                fi
            fi

            # Timeout: re-check PID is alive (may have exited during sleep),
            # then write marker BEFORE kill to eliminate race with wait
            if [[ $elapsed -ge $timeout_secs && -z "$write_seen" ]]; then
                if kill -0 "$claude_pid" 2>/dev/null; then
                    echo "true" > "$ralph_dir/.write_heartbeat_triggered"
                    kill "$claude_pid" 2>/dev/null  # GNU timeout propagates SIGTERM to child
                fi
                exit 0
            fi
        done
    ) &

    echo $! > "$ralph_dir/.write_heartbeat_pid"
}

# Stop the heartbeat monitor and clean up marker files.
# Safe to call even if no monitor is running.
stop_write_heartbeat() {
    if [[ -z "${RALPH_DIR:-}" ]]; then
        echo "Error: RALPH_DIR is not set" >&2
        return 1
    fi
    local ralph_dir="$RALPH_DIR"
    local pid_file="$ralph_dir/.write_heartbeat_pid"

    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            wait "$pid" 2>/dev/null || true
        fi
        rm -f "$pid_file"
    fi

    rm -f "$ralph_dir/.heartbeat_marker" "$ralph_dir/.write_heartbeat_seen"
}

# Check whether the most recent execution was killed by the heartbeat.
# Returns 0 (true) if the timeout marker exists.
# Does NOT delete the marker — the caller is responsible for cleanup.
was_write_heartbeat_timeout() {
    if [[ -z "${RALPH_DIR:-}" ]]; then
        echo "Error: RALPH_DIR is not set" >&2
        return 1
    fi
    local ralph_dir="$RALPH_DIR"
    [[ -f "$ralph_dir/.write_heartbeat_triggered" ]]
}
