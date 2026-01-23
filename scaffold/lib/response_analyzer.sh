#!/usr/bin/env bash
# Response Analyzer for BMALPH
# Analyzes Claude output for phase/step completion signals and progress indicators.

# Signal patterns
PHASE_COMPLETE_SIGNAL="PHASE_COMPLETE"
STEP_COMPLETE_SIGNAL="STEP_COMPLETE"
NEEDS_HUMAN_SIGNAL="<needs-human>"
PROJECT_COMPLETE_SIGNAL="<project-complete>"

RESPONSE_ANALYSIS_FILE="$STATE_DIR/.response_analysis"

# Detect output format (json or text)
detect_output_format() {
  local output_file=$1

  if [[ ! -f "$output_file" || ! -s "$output_file" ]]; then
    echo "text"
    return
  fi

  local first_char
  first_char=$(head -c 1 "$output_file" 2>/dev/null | tr -d '[:space:]')

  if [[ "$first_char" != "{" && "$first_char" != "[" ]]; then
    echo "text"
    return
  fi

  if python3 -c "import json; json.load(open('$output_file'))" 2>/dev/null; then
    echo "json"
  else
    echo "text"
  fi
}

# Parse JSON response and extract bmalph-relevant signals
parse_json_response() {
  local output_file=$1
  local result_file="${2:-$STATE_DIR/.json_parse_result}"

  if [[ ! -f "$output_file" ]]; then
    return 1
  fi

  python3 << PYEOF > "$result_file"
import json, sys

try:
    with open("$output_file") as f:
        data = json.load(f)

    # Handle array format (Claude CLI output)
    if isinstance(data, list):
        result_items = [x for x in data if x.get("type") == "result"]
        data = result_items[-1] if result_items else {}

    # Extract fields
    result = {
        "phase_complete": False,
        "step_complete": False,
        "needs_human": False,
        "project_complete": False,
        "exit_signal": False,
        "files_modified": 0,
        "has_errors": False,
        "work_summary": "",
        "session_id": ""
    }

    # Check result text for signals
    result_text = data.get("result", "")
    if isinstance(result_text, str):
        result["phase_complete"] = "$PHASE_COMPLETE_SIGNAL" in result_text
        result["step_complete"] = "$STEP_COMPLETE_SIGNAL" in result_text
        result["needs_human"] = "<needs-human>" in result_text
        result["project_complete"] = "<project-complete>" in result_text

    # Check metadata
    meta = data.get("metadata", {})
    if isinstance(meta, dict):
        result["files_modified"] = meta.get("files_changed", 0)
        result["has_errors"] = meta.get("has_errors", False)
        result["session_id"] = data.get("sessionId", meta.get("session_id", ""))

    # Check flat format fields
    result["exit_signal"] = data.get("exit_signal", False)
    if not result["work_summary"]:
        result["work_summary"] = str(data.get("result", ""))[:200]

    json.dump(result, sys.stdout, indent=2)
except Exception as e:
    json.dump({"error": str(e)}, sys.stdout)
    sys.exit(1)
PYEOF
}

# Analyze response for all signal types
analyze_response() {
  local output_file=$1
  local loop_number=$2

  if [[ ! -f "$output_file" ]]; then
    return 1
  fi

  local output_format
  output_format=$(detect_output_format "$output_file")

  local phase_complete=false
  local step_complete=false
  local needs_human=false
  local project_complete=false
  local has_errors=false
  local files_modified=0

  if [[ "$output_format" == "json" ]]; then
    if parse_json_response "$output_file" "$STATE_DIR/.json_parse_result" 2>/dev/null; then
      phase_complete=$(python3 -c "import json; print(str(json.load(open('$STATE_DIR/.json_parse_result')).get('phase_complete', False)).lower())")
      step_complete=$(python3 -c "import json; print(str(json.load(open('$STATE_DIR/.json_parse_result')).get('step_complete', False)).lower())")
      needs_human=$(python3 -c "import json; print(str(json.load(open('$STATE_DIR/.json_parse_result')).get('needs_human', False)).lower())")
      project_complete=$(python3 -c "import json; print(str(json.load(open('$STATE_DIR/.json_parse_result')).get('project_complete', False)).lower())")
      has_errors=$(python3 -c "import json; print(str(json.load(open('$STATE_DIR/.json_parse_result')).get('has_errors', False)).lower())")
      files_modified=$(python3 -c "import json; print(json.load(open('$STATE_DIR/.json_parse_result')).get('files_modified', 0))")
      rm -f "$STATE_DIR/.json_parse_result"
    fi
  else
    # Text-based signal detection
    if grep -q "$PHASE_COMPLETE_SIGNAL" "$output_file" 2>/dev/null; then
      phase_complete=true
    fi
    if grep -q "$STEP_COMPLETE_SIGNAL" "$output_file" 2>/dev/null; then
      step_complete=true
    fi
    if grep -q "$NEEDS_HUMAN_SIGNAL" "$output_file" 2>/dev/null; then
      needs_human=true
    fi
    if grep -q "$PROJECT_COMPLETE_SIGNAL" "$output_file" 2>/dev/null; then
      project_complete=true
    fi
  fi

  # Check git for file changes
  if command -v git &>/dev/null && git rev-parse --git-dir >/dev/null 2>&1; then
    local git_changes
    git_changes=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
    if [[ $git_changes -gt 0 ]]; then
      files_modified=$git_changes
    fi
  fi

  # Write analysis result
  cat > "$RESPONSE_ANALYSIS_FILE" << EOF
{
  "loop_number": $loop_number,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "phase_complete": $phase_complete,
  "step_complete": $step_complete,
  "needs_human": $needs_human,
  "project_complete": $project_complete,
  "has_errors": $has_errors,
  "files_modified": $files_modified
}
EOF

  return 0
}

# Check analysis result for a specific signal
check_signal() {
  local signal=$1
  if [[ ! -f "$RESPONSE_ANALYSIS_FILE" ]]; then
    echo "false"
    return
  fi
  python3 -c "import json; print(str(json.load(open('$RESPONSE_ANALYSIS_FILE')).get('$signal', False)).lower())" 2>/dev/null || echo "false"
}
