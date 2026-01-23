# BMALPH - Unified AI Development Framework

## Description
Main orchestration skill for the BMALPH framework. Use `/bmalph` to interact with the framework.

## Commands
- `/bmalph` - Show status and available actions
- `/bmalph init` - Initialize bmalph in this project (if not already done)
- `/bmalph status` - Show current phase, iteration, and progress
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
Iteration:  {{iteration}}
Status:     {{status}}

Available actions:
  /bmalph-analyze    - Work on analysis interactively
  /bmalph-plan       - Work on planning interactively
  /bmalph-design     - Work on design interactively
  /bmalph-implement  - Work on implementation interactively
  /bmalph-quick      - Quick flow for simple projects
```

## Files
- Config: `bmalph/config.json`
- State: `bmalph/state/current-phase.json`
- Progress: `bmalph/state/progress.txt`
- Artifacts: `bmalph/artifacts/`
