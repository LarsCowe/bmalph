#!/usr/bin/env bash

# metrics.sh - Append-only JSONL loop performance metrics (#129)
# Writes one record per loop iteration to .ralph/logs/metrics.jsonl
# for post-hoc analysis of duration, token usage, cost, and file changes.

METRICS_FILE="$RALPH_DIR/logs/metrics.jsonl"

# Run identity — set once per Ralph run, shared across all loops
METRICS_RUN_ID=""

# Initialize metrics for a new run. Call once in main() before the loop.
# Sets METRICS_RUN_ID only on first call (idempotent).
init_metrics() {
    if [[ -z "$METRICS_RUN_ID" ]]; then
        METRICS_RUN_ID="$(get_iso_timestamp)"
    fi
}

# Append a single metrics record after a loop iteration.
# Best-effort — never fails the loop (all writes guarded with || true).
#
# Args:
#   $1 = loop_number (integer)
#   $2 = files_changed (integer, raw git-derived count before QG mutation)
#   $3 = has_errors (true/false)
#   $4 = exit_signal (true/false, raw before QG mutation)
#   $5 = loop_outcome (success|read_only_timeout|error|circuit_breaker_trip)
#   $6 = quality_gate_result (optional, null if not run)
append_loop_metrics() {
    local loop_number=$1
    local files_changed=$2
    local has_errors=$3
    local exit_signal=$4
    local loop_outcome=$5
    local qg_result=${6:-null}

    # Defensive normalization: ensure booleans are valid JSON and integers are clean
    [[ "$has_errors" == "true" ]] && has_errors="true" || has_errors="false"
    [[ "$exit_signal" == "true" ]] && exit_signal="true" || exit_signal="false"
    files_changed=$((files_changed + 0))

    # Derive was_read_only_timeout from outcome
    local was_read_only_timeout=false
    [[ "$loop_outcome" == "read_only_timeout" ]] && was_read_only_timeout=true

    # Extract usage data from response analysis (written by analyze_response)
    local analysis_file="$RALPH_DIR/.response_analysis"
    local input_tokens=null output_tokens=null
    local cache_read=null cache_creation=null
    local cost=null duration=null duration_api=null num_turns=null
    local reported_files=0 has_perm_denials=false session_id=""

    if [[ -f "$analysis_file" ]]; then
        input_tokens=$(jq '.analysis.input_tokens // null' "$analysis_file" 2>/dev/null || echo null)
        output_tokens=$(jq '.analysis.output_tokens // null' "$analysis_file" 2>/dev/null || echo null)
        cache_read=$(jq '.analysis.cache_read_tokens // null' "$analysis_file" 2>/dev/null || echo null)
        cache_creation=$(jq '.analysis.cache_creation_tokens // null' "$analysis_file" 2>/dev/null || echo null)
        cost=$(jq '.analysis.total_cost_usd // null' "$analysis_file" 2>/dev/null || echo null)
        duration=$(jq '.analysis.duration_ms // null' "$analysis_file" 2>/dev/null || echo null)
        duration_api=$(jq '.analysis.duration_api_ms // null' "$analysis_file" 2>/dev/null || echo null)
        num_turns=$(jq '.analysis.num_turns // null' "$analysis_file" 2>/dev/null || echo null)
        reported_files=$(jq '.analysis.files_modified // 0' "$analysis_file" 2>/dev/null || echo 0)
        reported_files=$((reported_files + 0))
        has_perm_denials=$(jq '.analysis.has_permission_denials // false' "$analysis_file" 2>/dev/null || echo false)
        session_id=$(jq -r '.analysis.session_id // ""' "$analysis_file" 2>/dev/null || echo "")
    fi

    # Read circuit breaker state
    local cb_state="UNKNOWN"
    if [[ -n "${CB_STATE_FILE:-}" && -f "$CB_STATE_FILE" ]]; then
        cb_state=$(jq -r '.state // "UNKNOWN"' "$CB_STATE_FILE" 2>/dev/null || echo "UNKNOWN")
    fi

    # Driver identity
    local driver="${PLATFORM_DRIVER:-unknown}"

    # Ensure qg_result is valid JSON (number or null)
    if [[ "$qg_result" == "null" || "$qg_result" =~ ^-?[0-9]+$ ]]; then
        : # valid
    else
        qg_result="null"
    fi

    # Append single JSONL line — best-effort, never fail
    jq -n --compact-output \
        --arg run_id "$METRICS_RUN_ID" \
        --argjson loop "$loop_number" \
        --arg timestamp "$(get_iso_timestamp)" \
        --arg driver "$driver" \
        --arg session_id "$session_id" \
        --arg loop_outcome "$loop_outcome" \
        --argjson duration_ms "$duration" \
        --argjson duration_api_ms "$duration_api" \
        --argjson input_tokens "$input_tokens" \
        --argjson output_tokens "$output_tokens" \
        --argjson cache_read_tokens "$cache_read" \
        --argjson cache_creation_tokens "$cache_creation" \
        --argjson total_cost_usd "$cost" \
        --argjson num_turns "$num_turns" \
        --argjson files_changed "$files_changed" \
        --argjson reported_files_modified "$reported_files" \
        --argjson has_errors "$has_errors" \
        --argjson exit_signal "$exit_signal" \
        --argjson was_read_only_timeout "$was_read_only_timeout" \
        --argjson quality_gate_result "$qg_result" \
        --argjson has_permission_denials "$has_perm_denials" \
        --arg circuit_breaker_state "$cb_state" \
        '{
            run_id: $run_id,
            loop: $loop,
            timestamp: $timestamp,
            driver: $driver,
            session_id: $session_id,
            loop_outcome: $loop_outcome,
            duration_ms: $duration_ms,
            duration_api_ms: $duration_api_ms,
            input_tokens: $input_tokens,
            output_tokens: $output_tokens,
            cache_read_tokens: $cache_read_tokens,
            cache_creation_tokens: $cache_creation_tokens,
            total_cost_usd: $total_cost_usd,
            num_turns: $num_turns,
            files_changed: $files_changed,
            reported_files_modified: $reported_files_modified,
            has_errors: $has_errors,
            exit_signal: $exit_signal,
            was_read_only_timeout: $was_read_only_timeout,
            quality_gate_result: $quality_gate_result,
            has_permission_denials: $has_permission_denials,
            circuit_breaker_state: $circuit_breaker_state
        }' >> "$METRICS_FILE" 2>/dev/null || true
}

export -f init_metrics
export -f append_loop_metrics
