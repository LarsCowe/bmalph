# Phase 3 - Step 1: Initialize Design

## Agent
Load the **Architect (Winston)** agent persona.

## Context
**Project:** {{PROJECT_NAME}}
**Scale Level:** {{SCALE_LEVEL}}
**Phase:** 3 - Design

## Goal
Load planning artifacts and establish the design context.

## Instructions

1. Read Phase 2 artifacts:
   - `bmalph/artifacts/planning/prd.md`
   - `bmalph/artifacts/planning/user-stories.md`
   - `bmalph/artifacts/planning/mvp-scope.md`
2. Read relevant Phase 1 artifacts:
   - `bmalph/artifacts/analysis/constraints.md`
   - `bmalph/artifacts/analysis/risks.md`
3. Identify key technical decisions needed:
   - Platform/runtime choices
   - Framework/library selection
   - Infrastructure requirements
   - Integration points
4. Create the design directory if not present:
   - `bmalph/artifacts/design/`
5. Summarize the design challenge:
   - What must be built (from PRD)
   - What constrains us (from constraints)
   - What risks the architecture must mitigate

## Scale Adaptation
- **Level 0-1:** Quick context load, focus on key decisions
- **Level 2:** Standard review of all planning artifacts
- **Level 3-4:** Deep analysis of requirements landscape, identify all decision points

## Completion Signal
When design context is established, output:
```
STEP_COMPLETE
```
