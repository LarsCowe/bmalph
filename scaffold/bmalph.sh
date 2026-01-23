#!/usr/bin/env bash
set -euo pipefail

# BMALPH Execution Loop v2
# Combines Ralph's battle-tested loop engine with BMAD phase methodology.
# - Outer loop: phase progression (1→4)
# - Middle loop: step-by-step progressive disclosure per phase
# - Inner loop: Ralph-style iterations per step

# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_DIR="${BMALPH_PROJECT_DIR:-$(pwd)}"
BMALPH_DIR="$PROJECT_DIR/bmalph"
STATE_DIR="$BMALPH_DIR/state"
LOG_DIR="$STATE_DIR/logs"
AGENTS_DIR="$BMALPH_DIR/agents"
PROMPTS_DIR="$BMALPH_DIR/prompts"
CONFIG_FILE="$BMALPH_DIR/config.json"
PROGRESS_FILE="$STATE_DIR/progress.txt"

# Rate limiting & session
MAX_CALLS_PER_HOUR="${BMALPH_MAX_CALLS_PER_HOUR:-100}"
TIMEOUT_MINUTES="${BMALPH_TIMEOUT_MINUTES:-15}"
OUTPUT_FORMAT="${BMALPH_OUTPUT_FORMAT:-json}"
USE_CONTINUE="${BMALPH_USE_CONTINUE:-true}"
MAX_ITERATIONS_PER_STEP="${BMALPH_MAX_ITERATIONS_PER_STEP:-10}"

# Start phase (CLI argument)
START_PHASE=${1:-1}

# Rate limit tracking
CALL_COUNT_FILE="$STATE_DIR/.call_count"
TIMESTAMP_FILE="$STATE_DIR/.last_reset"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# ============================================================================
# LOGGING
# ============================================================================

log_info() { echo -e "${BLUE}[bmalph]${NC} $1"; echo "[$(date '+%H:%M:%S')] INFO: $1" >> "$LOG_DIR/bmalph.log" 2>/dev/null || true; }
log_success() { echo -e "${GREEN}[bmalph]${NC} $1"; echo "[$(date '+%H:%M:%S')] OK: $1" >> "$LOG_DIR/bmalph.log" 2>/dev/null || true; }
log_warn() { echo -e "${YELLOW}[bmalph]${NC} $1"; echo "[$(date '+%H:%M:%S')] WARN: $1" >> "$LOG_DIR/bmalph.log" 2>/dev/null || true; }
log_error() { echo -e "${RED}[bmalph]${NC} $1"; echo "[$(date '+%H:%M:%S')] ERROR: $1" >> "$LOG_DIR/bmalph.log" 2>/dev/null || true; }
log_loop() { echo -e "${PURPLE}[bmalph]${NC} $1"; echo "[$(date '+%H:%M:%S')] LOOP: $1" >> "$LOG_DIR/bmalph.log" 2>/dev/null || true; }

# ============================================================================
# INITIALIZATION
# ============================================================================

mkdir -p "$STATE_DIR" "$LOG_DIR"

# Source library components
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

if [[ -d "$LIB_DIR" ]]; then
  source "$LIB_DIR/circuit_breaker.sh"
  source "$LIB_DIR/response_analyzer.sh"
  source "$LIB_DIR/session_manager.sh"
fi

# Read config
read_config_value() {
  local key="$1"
  python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['$key'])" 2>/dev/null || echo ""
}

PROJECT_NAME=$(read_config_value "name")
PROJECT_DESC=$(read_config_value "description")
SCALE_LEVEL=$(read_config_value "level")

# ============================================================================
# PHASE & STEP MAPPING
# ============================================================================

get_phase_label() {
  case $1 in
    1) echo "Analysis" ;;
    2) echo "Planning" ;;
    3) echo "Design" ;;
    4) echo "Implementation" ;;
  esac
}

get_agent_file() {
  local phase=$1
  case $phase in
    1) echo "$AGENTS_DIR/analyst.md" ;;
    2) echo "$AGENTS_DIR/pm.md" ;;
    3) echo "$AGENTS_DIR/architect.md" ;;
    4) echo "$AGENTS_DIR/developer.md" ;;
  esac
}

get_phase_dir() {
  case $1 in
    1) echo "phase-1-analysis" ;;
    2) echo "phase-2-planning" ;;
    3) echo "phase-3-design" ;;
    4) echo "phase-4-implementation" ;;
  esac
}

# List step files for a phase (sorted)
get_step_files() {
  local phase=$1
  local phase_dir
  phase_dir=$(get_phase_dir "$phase")
  local steps_path="$PROMPTS_DIR/$phase_dir"

  if [[ -d "$steps_path" ]]; then
    find "$steps_path" -name "step-*.md" -type f 2>/dev/null | sort
  fi
}

# ============================================================================
# RATE LIMITING
# ============================================================================

init_call_tracking() {
  local current_hour
  current_hour=$(date +%Y%m%d%H)
  local last_reset=""

  if [[ -f "$TIMESTAMP_FILE" ]]; then
    last_reset=$(cat "$TIMESTAMP_FILE")
  fi

  if [[ "$current_hour" != "$last_reset" ]]; then
    echo "0" > "$CALL_COUNT_FILE"
    echo "$current_hour" > "$TIMESTAMP_FILE"
  fi
}

can_make_call() {
  local calls=0
  if [[ -f "$CALL_COUNT_FILE" ]]; then
    calls=$(cat "$CALL_COUNT_FILE")
  fi
  [[ $calls -lt $MAX_CALLS_PER_HOUR ]]
}

increment_call_counter() {
  local calls=0
  if [[ -f "$CALL_COUNT_FILE" ]]; then
    calls=$(cat "$CALL_COUNT_FILE")
  fi
  calls=$((calls + 1))
  echo "$calls" > "$CALL_COUNT_FILE"
}

wait_for_rate_reset() {
  local calls
  calls=$(cat "$CALL_COUNT_FILE" 2>/dev/null || echo "0")
  log_warn "Rate limit reached ($calls/$MAX_CALLS_PER_HOUR). Waiting for reset..."

  local wait_secs=$(( (60 - $(date +%M)) * 60 ))
  log_info "Sleeping ${wait_secs}s until next hour..."
  sleep "$wait_secs"

  echo "0" > "$CALL_COUNT_FILE"
  echo "$(date +%Y%m%d%H)" > "$TIMESTAMP_FILE"
  log_success "Rate limit reset."
}

# ============================================================================
# PROMPT ASSEMBLY
# ============================================================================

build_step_prompt() {
  local phase=$1
  local step_file=$2
  local iteration=$3
  local prompt=""

  # 1. Agent persona
  local agent_file
  agent_file=$(get_agent_file "$phase")
  if [[ -f "$agent_file" ]]; then
    prompt+="$(cat "$agent_file")"
    prompt+=$'\n\n---\n\n'
  fi

  # 2. Step content with variable substitution
  if [[ -f "$step_file" ]]; then
    local template
    template=$(cat "$step_file")
    template="${template//\{\{PROJECT_NAME\}\}/$PROJECT_NAME}"
    template="${template//\{\{PROJECT_DESCRIPTION\}\}/$PROJECT_DESC}"
    template="${template//\{\{SCALE_LEVEL\}\}/$SCALE_LEVEL}"
    prompt+="$template"
    prompt+=$'\n\n---\n\n'
  fi

  # 3. Progress context
  if [[ -f "$PROGRESS_FILE" ]]; then
    prompt+="## Progress So Far"$'\n\n'
    prompt+="$(tail -50 "$PROGRESS_FILE")"
    prompt+=$'\n\n'
  fi

  # 4. Available artifacts
  local phase_dir
  case $phase in
    1) phase_dir="analysis" ;;
    2) phase_dir="planning" ;;
    3) phase_dir="design" ;;
    4) phase_dir="implementation" ;;
  esac

  local artifacts_dir="$BMALPH_DIR/artifacts"
  if [[ -d "$artifacts_dir" ]]; then
    local prior_artifacts=""
    # Include artifacts from completed phases
    for prior_phase in $(seq 1 $((phase - 1))); do
      local prior_dir
      case $prior_phase in
        1) prior_dir="analysis" ;;
        2) prior_dir="planning" ;;
        3) prior_dir="design" ;;
        4) prior_dir="implementation" ;;
      esac
      if [[ -d "$artifacts_dir/$prior_dir" ]]; then
        local files
        files=$(ls "$artifacts_dir/$prior_dir" 2>/dev/null || true)
        if [[ -n "$files" ]]; then
          prior_artifacts+="- $prior_dir/: $files"$'\n'
        fi
      fi
    done
    if [[ -n "$prior_artifacts" ]]; then
      prompt+="## Available Artifacts"$'\n\n'
      prompt+="$prior_artifacts"
      prompt+=$'\n\n'
    fi
  fi

  # 5. Iteration context
  prompt+="## Context"$'\n\n'
  prompt+="- Phase: $phase ($(get_phase_label "$phase"))"$'\n'
  prompt+="- Step: $(basename "$step_file")"$'\n'
  prompt+="- Iteration: $iteration"$'\n'
  prompt+="- Scale Level: $SCALE_LEVEL"$'\n'
  prompt+=$'\n'
  prompt+="When you complete this step's objectives, include \`STEP_COMPLETE: true\` in your response."$'\n'
  prompt+="When all steps in this phase are done, include \`PHASE_COMPLETE: true\` in your response."$'\n'

  echo "$prompt"
}

# ============================================================================
# CLAUDE EXECUTION
# ============================================================================

execute_claude() {
  local prompt=$1
  local output_file="$LOG_DIR/claude_$(date +%Y%m%d_%H%M%S).log"

  init_call_tracking
  if ! can_make_call; then
    wait_for_rate_reset
  fi

  local timeout_secs=$((TIMEOUT_MINUTES * 60))

  # Build Claude command
  local -a cmd_args=("claude")

  if [[ "$OUTPUT_FORMAT" == "json" ]]; then
    cmd_args+=("--output-format" "json")
  fi

  if [[ "$USE_CONTINUE" == "true" ]]; then
    local session_id
    session_id=$(get_session_id)
    if [[ -n "$session_id" ]]; then
      cmd_args+=("--continue" "$session_id")
    fi
  fi

  cmd_args+=("--print" "-p" "$prompt")

  log_loop "Executing Claude..."

  # Execute with timeout (cross-platform)
  local timeout_cmd="timeout"
  if [[ "$(uname)" == "Darwin" ]] && command -v gtimeout &>/dev/null; then
    timeout_cmd="gtimeout"
  fi

  if command -v "$timeout_cmd" &>/dev/null; then
    "$timeout_cmd" "${timeout_secs}s" "${cmd_args[@]}" > "$output_file" 2>&1 || true
  else
    "${cmd_args[@]}" > "$output_file" 2>&1 || true
  fi

  increment_call_counter

  # Extract session ID from output
  if [[ "$USE_CONTINUE" == "true" ]]; then
    extract_session_from_output "$output_file"
  fi

  echo "$output_file"
}

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

update_state() {
  local phase=$1
  local iteration=$2
  local status=$3
  local step="${4:-}"

  local started_at
  started_at=$(python3 -c "
import json, sys
try:
    with open('$STATE_DIR/current-phase.json') as f:
        print(json.load(f).get('startedAt', ''))
except:
    print('')
" 2>/dev/null || echo "")

  if [[ -z "$started_at" ]]; then
    started_at=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  fi

  cat > "$STATE_DIR/current-phase.json" << EOF
{
  "currentPhase": $phase,
  "iteration": $iteration,
  "status": "$status",
  "currentStep": "$step",
  "startedAt": "$started_at",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF
}

init_phase_tasks() {
  local phase=$1
  local task_file="$STATE_DIR/phase-${phase}-tasks.json"

  if [[ ! -f "$task_file" ]]; then
    case $phase in
      1)
        cat > "$task_file" << 'EOF'
[
  {"id": "1.1", "title": "Gather and document requirements", "status": "pending", "priority": 1},
  {"id": "1.2", "title": "Research domain and market context", "status": "pending", "priority": 2},
  {"id": "1.3", "title": "Identify constraints and dependencies", "status": "pending", "priority": 3},
  {"id": "1.4", "title": "Assess risks and mitigations", "status": "pending", "priority": 4},
  {"id": "1.5", "title": "Validate analysis completeness", "status": "pending", "priority": 5}
]
EOF
        ;;
      2)
        cat > "$task_file" << 'EOF'
[
  {"id": "2.1", "title": "Create Product Requirements Document", "status": "pending", "priority": 1},
  {"id": "2.2", "title": "Write user stories with acceptance criteria", "status": "pending", "priority": 2},
  {"id": "2.3", "title": "Define MVP scope", "status": "pending", "priority": 3},
  {"id": "2.4", "title": "Generate implementation task list", "status": "pending", "priority": 4},
  {"id": "2.5", "title": "Validate planning artifacts", "status": "pending", "priority": 5}
]
EOF
        ;;
      3)
        cat > "$task_file" << 'EOF'
[
  {"id": "3.1", "title": "Define technology stack and architecture", "status": "pending", "priority": 1},
  {"id": "3.2", "title": "Design data model", "status": "pending", "priority": 2},
  {"id": "3.3", "title": "Design API contracts", "status": "pending", "priority": 3},
  {"id": "3.4", "title": "Establish coding conventions", "status": "pending", "priority": 4},
  {"id": "3.5", "title": "Validate design completeness", "status": "pending", "priority": 5}
]
EOF
        ;;
      4)
        if [[ ! -f "$task_file" ]]; then
          cat > "$task_file" << 'EOF'
[
  {"id": "4.1", "title": "Set up project structure and dependencies", "status": "pending", "priority": 1},
  {"id": "4.2", "title": "Implement core functionality (TDD)", "status": "pending", "priority": 2},
  {"id": "4.3", "title": "Code review and quality checks", "status": "pending", "priority": 3},
  {"id": "4.4", "title": "Validate implementation", "status": "pending", "priority": 4}
]
EOF
        fi
        ;;
    esac
  fi
}

# ============================================================================
# QUALITY GATE
# ============================================================================

run_quality_gate() {
  local phase=$1
  log_info "Running quality gate for phase $phase..."

  local gate_file="$PROMPTS_DIR/quality-gate.md"
  if [[ ! -f "$gate_file" ]]; then
    log_warn "Quality gate template not found, skipping"
    return 0
  fi

  local gate_prompt
  gate_prompt=$(cat "$gate_file")
  gate_prompt="${gate_prompt//\{\{PROJECT_NAME\}\}/$PROJECT_NAME}"
  gate_prompt="${gate_prompt//\{\{CURRENT_PHASE\}\}/$phase}"
  gate_prompt="${gate_prompt//\{\{SCALE_LEVEL\}\}/$SCALE_LEVEL}"

  # Run quality gate as separate Claude invocation
  local output
  output=$(echo "$gate_prompt" | claude --print 2>/dev/null || true)

  if echo "$output" | grep -q "<quality-gate-pass>"; then
    log_success "Quality gate PASSED for phase $phase"
    return 0
  else
    log_warn "Quality gate FAILED for phase $phase"
    return 1
  fi
}

# Implementation readiness gate (between phase 3→4)
run_implementation_readiness() {
  local gate_file="$PROMPTS_DIR/implementation-readiness.md"
  if [[ ! -f "$gate_file" ]]; then
    return 0
  fi

  log_info "Running implementation readiness check..."

  local gate_prompt
  gate_prompt=$(cat "$gate_file")
  gate_prompt="${gate_prompt//\{\{PROJECT_NAME\}\}/$PROJECT_NAME}"

  local output
  output=$(echo "$gate_prompt" | claude --print 2>/dev/null || true)

  if echo "$output" | grep -q "<ready-for-implementation>"; then
    log_success "Implementation readiness: PASS"
    return 0
  else
    log_warn "Implementation readiness: NOT READY"
    echo "$output" | grep -i "blocker\|missing\|required" | head -5 || true
    return 1
  fi
}

# ============================================================================
# HUMAN CHECKPOINT
# ============================================================================

human_checkpoint() {
  local phase=$1
  local next_phase=$((phase + 1))

  echo ""
  log_success "Phase $phase ($(get_phase_label "$phase")) completed!"
  echo ""

  if [[ $next_phase -le 4 ]]; then
    log_info "Ready to transition to Phase $next_phase ($(get_phase_label "$next_phase"))"
    echo ""
    read -rp "$(echo -e "${YELLOW}Approve transition? (y/n/q): ${NC}")" answer
    case $answer in
      y|Y|yes)
        log_info "Transitioning to phase $next_phase..."
        return 0
        ;;
      q|Q|quit)
        update_state "$phase" 0 "paused"
        log_info "Paused. Run 'bmalph resume' to continue."
        exit 0
        ;;
      *)
        update_state "$phase" 0 "paused"
        log_info "Paused at phase $phase. Run 'bmalph resume' to continue."
        exit 0
        ;;
    esac
  else
    log_success "All phases complete!"
    update_state 4 0 "completed"
    exit 0
  fi
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup() {
  log_info "BMALPH loop interrupted. Cleaning up..."
  if command -v reset_session &>/dev/null; then
    reset_session "interrupted"
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM

# ============================================================================
# MAIN LOOP
# ============================================================================

# Initialize
if [[ ! -f "$PROGRESS_FILE" ]]; then
  echo "# BMALPH Progress Log" > "$PROGRESS_FILE"
  echo "Project: $PROJECT_NAME" >> "$PROGRESS_FILE"
  echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
fi

init_session
init_circuit_breaker

log_info "Starting BMALPH loop"
log_info "Project: $PROJECT_NAME (Level $SCALE_LEVEL)"
log_info "Rate limit: $MAX_CALLS_PER_HOUR calls/hour | Timeout: ${TIMEOUT_MINUTES}m"
echo ""

# Outer loop: phase progression
for phase in $(seq "$START_PHASE" 4); do
  log_info "=== Phase $phase: $(get_phase_label "$phase") ==="

  init_phase_tasks "$phase"
  update_state "$phase" 0 "running"

  # Reset circuit breaker for new phase
  reset_circuit_breaker "Phase $phase start"

  # Get steps for this phase
  mapfile -t step_files < <(get_step_files "$phase")

  if [[ ${#step_files[@]} -eq 0 ]]; then
    # Fallback: no step files, treat as single-step phase
    log_warn "No step files found for phase $phase, using legacy mode"
    step_files=("$PROMPTS_DIR/phase-${phase}-iteration.md")
  fi

  # Middle loop: step progression
  for step_file in "${step_files[@]}"; do
    local step_name
    step_name=$(basename "$step_file" .md)
    log_info "  Step: $step_name"

    local step_done=false
    local iteration=0

    # Inner loop: Ralph-style iterations per step
    while [[ "$step_done" != "true" && $iteration -lt $MAX_ITERATIONS_PER_STEP ]]; do
      iteration=$((iteration + 1))
      update_state "$phase" "$iteration" "running" "$step_name"

      # Check circuit breaker
      if should_halt_execution; then
        log_error "Circuit breaker open - halting phase $phase"
        reset_session "circuit_breaker"
        update_state "$phase" "$iteration" "halted" "$step_name"
        echo ""
        log_error "Execution halted. Review logs and run 'bmalph resume' after fixing."
        exit 1
      fi

      log_loop "Phase $phase, $step_name, Iteration $iteration"

      # Build and execute prompt
      local prompt
      prompt=$(build_step_prompt "$phase" "$step_file" "$iteration")
      local output_file
      output_file=$(execute_claude "$prompt")

      # Analyze response
      if [[ -f "$output_file" ]]; then
        analyze_response "$output_file" "$iteration"

        # Check signals
        local step_signal
        step_signal=$(check_signal "step_complete")
        local phase_signal
        phase_signal=$(check_signal "phase_complete")
        local human_signal
        human_signal=$(check_signal "needs_human")
        local project_signal
        project_signal=$(check_signal "project_complete")

        # Handle signals
        if [[ "$project_signal" == "true" ]]; then
          log_success "Project complete!"
          update_state 4 "$iteration" "completed"
          echo "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$PROGRESS_FILE"
          exit 0
        fi

        if [[ "$human_signal" == "true" ]]; then
          log_warn "Human input needed."
          update_state "$phase" "$iteration" "paused" "$step_name"
          read -rp "$(echo -e "${YELLOW}Continue after addressing? (y/q): ${NC}")" answer
          if [[ "$answer" == "q" ]]; then
            exit 0
          fi
          continue
        fi

        if [[ "$phase_signal" == "true" ]]; then
          log_success "Phase $phase signaled complete"
          step_done=true
          break 2  # Break out of both step and iteration loops
        fi

        if [[ "$step_signal" == "true" ]]; then
          log_success "Step $step_name complete (iteration $iteration)"
          step_done=true
        fi

        # Record result in circuit breaker
        local files_changed=0
        local has_errors="false"
        if command -v git &>/dev/null && git rev-parse --git-dir >/dev/null 2>&1; then
          files_changed=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
        fi
        if grep -qiE '(Error:|Exception|FATAL|failed)' "$output_file" 2>/dev/null; then
          has_errors="true"
        fi

        record_loop_result "$iteration" "$files_changed" "$has_errors" || {
          log_error "Circuit breaker tripped in step $step_name"
          break
        }
      fi

      # Brief pause between iterations
      sleep 3
    done

    if [[ $iteration -ge $MAX_ITERATIONS_PER_STEP && "$step_done" != "true" ]]; then
      log_warn "Max iterations ($MAX_ITERATIONS_PER_STEP) for step $step_name"
    fi

    # Log step completion to progress
    echo "- Phase $phase, $step_name: done ($(date '+%H:%M'))" >> "$PROGRESS_FILE"
  done

  # Phase complete
  log_success "All steps done for phase $phase"

  # Quality gate (skip for level 0-1)
  if [[ "$SCALE_LEVEL" -ge 2 ]]; then
    run_quality_gate "$phase" || {
      log_warn "Quality gate failed. Running remediation iteration..."
      local remediation_prompt
      remediation_prompt=$(build_step_prompt "$phase" "${step_files[-1]}" "remediation")
      execute_claude "$remediation_prompt" >/dev/null
    }
  fi

  # Implementation readiness gate (between phase 3→4)
  if [[ "$phase" -eq 3 && "$SCALE_LEVEL" -ge 2 ]]; then
    run_implementation_readiness || {
      log_warn "Not ready for implementation. Review artifacts."
    }
  fi

  # Reset session for new phase context
  reset_session "Phase $phase complete"

  # Human checkpoint
  human_checkpoint "$phase"
done

log_success "BMALPH loop finished!"
