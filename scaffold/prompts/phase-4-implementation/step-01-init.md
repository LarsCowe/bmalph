# Phase 4 - Step 1: Initialize Implementation

## Agent
Load the **Scrum Master (Bob)** agent persona for planning, then hand off to **Developer (Amelia)**.

## Context
**Project:** {{PROJECT_NAME}}
**Scale Level:** {{SCALE_LEVEL}}
**Phase:** 4 - Implementation

## Goal
Load design artifacts, verify the task list, and prepare for implementation.

## Instructions

1. Read all design artifacts:
   - `bmalph/artifacts/design/architecture.md`
   - `bmalph/artifacts/design/data-model.md`
   - `bmalph/artifacts/design/api-design.md` (if exists)
   - `bmalph/artifacts/design/conventions.md`
2. Read the task breakdown:
   - `bmalph/state/phase-4-tasks.json`
   - `bmalph/artifacts/planning/user-stories.md`
3. Verify implementation readiness:
   - All tasks have clear descriptions
   - Dependencies are sequenced correctly
   - First task has no blockers
4. Set up the project structure according to conventions:
   - Create directory structure as defined in architecture
   - Initialize build tools, linters, test framework
   - Create initial configuration files
5. Mark the first task as in-progress

## Scale Adaptation
- **Level 0-1:** Minimal setup, start coding immediately
- **Level 2:** Standard project scaffold with build tools
- **Level 3-4:** Full scaffold with CI config, pre-commit hooks, complete toolchain

## Completion Signal
When project is scaffolded and ready for implementation, output:
```
STEP_COMPLETE
```
