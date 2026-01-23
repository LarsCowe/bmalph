# BMALPH - Unified AI Development Framework

## Description
Main orchestration skill for the BMALPH framework. Use `/bmalph` to interact with the framework.

## Commands
- `/bmalph` - Show status and available actions
- `/bmalph init` - Initialize bmalph in this project (if not already done)
- `/bmalph status` - Show current phase, step, and progress
- `/bmalph start` - Start the autonomous loop
- `/bmalph resume` - Resume from last checkpoint

## Behavior

When invoked, check the current state:

1. **Not initialized:** Guide the user through initialization
2. **Initialized, not started:** Show options to start or configure
3. **Running/Paused:** Show status and offer to resume or use phase-specific skills

### Status Display

```
BMALPH Status
─────────────
Project:    {{name}}
Level:      {{level}}
Phase:      {{phase}}/4 ({{phase_label}})
Step:       {{step}}/{{total_steps}}
Iteration:  {{iteration}}
Status:     {{status}}

Phase skills (tri-modal: create | validate | edit):
  /bmalph-analyze    - Phase 1: Analysis
  /bmalph-plan       - Phase 2: Planning
  /bmalph-design     - Phase 3: Design
  /bmalph-implement  - Phase 4: Implementation
  /bmalph-quick      - Quick Flow (level 0-2)

Examples:
  /bmalph-analyze           Create analysis artifacts
  /bmalph-analyze validate  Review existing analysis
  /bmalph-analyze edit      Modify analysis artifacts
```

### Agents

| Agent | Persona | Phase |
|-------|---------|-------|
| Analyst | Mary | 1 |
| PM | John | 2 |
| UX Designer | Sally | 2-3 |
| Architect | Winston | 3 |
| Test Architect | Murat | 3-4 |
| Scrum Master | Bob | 4 |
| Developer | Amelia | 4 |
| Quick Flow | Barry | All |

## Files
- Config: `bmalph/config.json`
- State: `bmalph/state/current-phase.json`
- Progress: `bmalph/state/progress.txt`
- Artifacts: `bmalph/artifacts/`
- Agents: `bmalph/agents/`
- Prompts: `bmalph/prompts/`
