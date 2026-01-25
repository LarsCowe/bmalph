# Ralph Reference Guide

This reference guide provides essential information for troubleshooting and understanding Ralph's autonomous development loop.

## Table of Contents

1. [Configuration Files](#configuration-files)
2. [Session Management](#session-management)
3. [Circuit Breaker](#circuit-breaker)
4. [Exit Detection](#exit-detection)
5. [Troubleshooting](#troubleshooting)

---

## Configuration Files

Ralph uses several files within the `.ralph/` directory:

| File | Purpose |
|------|---------|
| `.ralph/PROMPT.md` | Main prompt that drives each loop iteration |
| `.ralph/@fix_plan.md` | Prioritized task list that Ralph follows |
| `.ralph/@AGENT.md` | Build and run instructions maintained by Ralph |
| `.ralph/status.json` | Real-time status tracking (JSON format) |
| `.ralph/logs/` | Execution logs for each loop iteration |
| `.ralph/.ralph_session` | Current session state |
| `.ralph/.circuit_breaker_state` | Circuit breaker state |

### Rate Limiting

- Default: 100 API calls per hour (configurable via `--calls` flag)
- Automatic hourly reset with countdown display
- Call tracking persists across script restarts

---

## Session Management

Ralph maintains session continuity across loop iterations.

### Session Files

| File | Purpose |
|------|---------|
| `.ralph/.ralph_session` | Current session ID and timestamps |
| `.ralph/.ralph_session_history` | History of last 50 session transitions |
| `.ralph/.claude_session_id` | Claude Code CLI session persistence |

### Session Lifecycle

Sessions are automatically reset when:
- Circuit breaker opens (stagnation detected)
- Manual interrupt (Ctrl+C / SIGINT)
- Project completion (graceful exit)
- Manual circuit breaker reset (`ralph --reset-circuit`)
- Manual session reset (`ralph --reset-session`)

### Session Expiration

Sessions expire after 24 hours. When expired:
- A new session is created automatically
- Previous context is not preserved
- Session history records the transition

### Session State Structure

```json
{
  "session_id": "uuid-string",
  "created_at": "ISO-timestamp",
  "last_used": "ISO-timestamp",
  "reset_at": "ISO-timestamp (if reset)",
  "reset_reason": "reason string (if reset)"
}
```

---

## Circuit Breaker

The circuit breaker prevents runaway loops by detecting stagnation.

### States

| State | Description | Action |
|-------|-------------|--------|
| **CLOSED** | Normal operation | Loop continues |
| **HALF_OPEN** | Monitoring after recovery | Testing if issue resolved |
| **OPEN** | Halted due to stagnation | Loop stops |

### Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| `CB_NO_PROGRESS_THRESHOLD` | 3 | Open circuit after N loops with no file changes |
| `CB_SAME_ERROR_THRESHOLD` | 5 | Open circuit after N loops with repeated errors |
| `CB_OUTPUT_DECLINE_THRESHOLD` | 70% | Open circuit if output declines by >N% |

### Circuit Breaker State Structure

```json
{
  "state": "CLOSED|HALF_OPEN|OPEN",
  "consecutive_no_progress": 0,
  "consecutive_same_error": 0,
  "last_progress_loop": 5,
  "total_opens": 0,
  "reason": "string (when OPEN)",
  "current_loop": 10
}
```

### Recovery

To reset the circuit breaker:
```bash
ralph --reset-circuit
```

---

## Exit Detection

Ralph uses multiple mechanisms to detect when to exit the loop.

### Exit Conditions

| Condition | Threshold | Description |
|-----------|-----------|-------------|
| Consecutive done signals | 2 | Exit on repeated completion signals |
| Test-only loops | 3 | Exit if too many test-only iterations |
| Fix plan complete | All [x] | Exit when all tasks are marked complete |
| EXIT_SIGNAL + completion_indicators | Both | Dual verification for project completion |

### EXIT_SIGNAL Gate

The `completion_indicators` exit condition requires dual verification:

| completion_indicators | EXIT_SIGNAL | Result |
|-----------------------|-------------|--------|
| >= 2 | `true` | **Exit** ("project_complete") |
| >= 2 | `false` | **Continue** (Claude still working) |
| >= 2 | missing | **Continue** (defaults to false) |
| < 2 | `true` | **Continue** (threshold not met) |

**Rationale:** Natural language patterns like "done" or "complete" can trigger false positives during productive work. By requiring Claude's explicit EXIT_SIGNAL confirmation, Ralph avoids exiting mid-iteration.

### RALPH_STATUS Block

Claude should include this status block at the end of each response:

```
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <number>
FILES_MODIFIED: <number>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <one line summary of what to do next>
---END_RALPH_STATUS---
```

### When to Set EXIT_SIGNAL: true

Set EXIT_SIGNAL to **true** when ALL conditions are met:
1. All items in @fix_plan.md are marked [x]
2. All tests are passing (or no tests exist for valid reasons)
3. No errors or warnings in the last execution
4. All requirements from specs/ are implemented
5. Nothing meaningful left to implement

---

## Troubleshooting

### Common Issues

#### Ralph exits too early

**Symptoms:** Loop stops before work is complete

**Causes:**
- EXIT_SIGNAL set to true prematurely
- completion_indicators triggered by natural language
- All @fix_plan.md items marked complete

**Solutions:**
1. Ensure EXIT_SIGNAL is only true when genuinely complete
2. Add remaining tasks to @fix_plan.md
3. Check `.ralph/.response_analysis` for exit reasons

#### Ralph doesn't exit when complete

**Symptoms:** Loop continues with busywork

**Causes:**
- EXIT_SIGNAL not being set to true
- @fix_plan.md has unmarked items
- completion_indicators threshold not met

**Solutions:**
1. Ensure RALPH_STATUS block is included in responses
2. Set EXIT_SIGNAL: true when all work is done
3. Mark all completed items in @fix_plan.md

#### Circuit breaker opens unexpectedly

**Symptoms:** "OPEN - stagnation detected" message

**Causes:**
- Same error recurring across loops
- No file changes for multiple loops
- Output volume declining significantly

**Solutions:**
1. Check `.ralph/logs/` for the recurring error
2. Fix the underlying issue causing the error
3. Reset circuit breaker: `ralph --reset-circuit`

#### Session expires mid-project

**Symptoms:** Context lost, session age > 24h

**Causes:**
- Long gaps between loop iterations
- Session not being refreshed

**Solutions:**
1. Sessions are designed to expire after 24h
2. Start a new session with `ralph --reset-session`
3. Context will be rebuilt from @fix_plan.md and specs/

### Diagnostic Commands

```bash
# Check Ralph status
ralph --status

# Check circuit breaker state
ralph --circuit-status

# Reset circuit breaker
ralph --reset-circuit

# Reset session
ralph --reset-session
```

### Log Files

Loop execution logs are stored in `.ralph/logs/`:
- Each loop iteration creates a timestamped log file
- Logs contain Claude's output and status information
- Use logs to diagnose issues with specific iterations

### Status File Structure

`.ralph/status.json`:
```json
{
  "timestamp": "ISO-timestamp",
  "loop_count": 10,
  "calls_made_this_hour": 25,
  "max_calls_per_hour": 100,
  "last_action": "description",
  "status": "running|paused|complete",
  "exit_reason": "reason (if exited)",
  "next_reset": "timestamp for rate limit reset"
}
```

---

## Error Detection

Ralph uses two-stage error filtering to eliminate false positives.

### Stage 1: JSON Field Filtering
Filters out JSON field patterns like `"is_error": false` that contain the word "error" but aren't actual errors.

### Stage 2: Actual Error Detection
Detects real error messages:
- Error prefixes: `Error:`, `ERROR:`, `error:`
- Context-specific: `]: error`, `Link: error`
- Occurrences: `Error occurred`, `failed with error`
- Exceptions: `Exception`, `Fatal`, `FATAL`

### Multi-line Error Matching
Ralph verifies ALL error lines appear in ALL recent history files before declaring a stuck loop, preventing false negatives when multiple distinct errors occur.

---

## Further Reading

- [BMAD-METHOD Documentation](https://github.com/bmad-code-org/BMAD-METHOD)
- [Ralph Repository](https://github.com/snarktank/ralph)
