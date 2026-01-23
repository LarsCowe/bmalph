# Phase 2 - Step 1: Initialize Planning

## Agent
Load the **Product Manager (John)** agent persona.

## Context
**Project:** {{PROJECT_NAME}}
**Scale Level:** {{SCALE_LEVEL}}
**Phase:** 2 - Planning

## Goal
Load analysis artifacts and set up the planning workspace.

## Instructions

1. Read all Phase 1 artifacts:
   - `bmalph/artifacts/analysis/requirements.md`
   - `bmalph/artifacts/analysis/constraints.md`
   - `bmalph/artifacts/analysis/research.md`
   - `bmalph/artifacts/analysis/risks.md`
2. Summarize key findings that will drive planning:
   - Core requirements (Must-haves)
   - Critical constraints
   - Top risks to mitigate
3. Create the planning directory if not present:
   - `bmalph/artifacts/planning/`
4. Identify the project type and scope indicators:
   - Consumer vs. B2B
   - New product vs. enhancement
   - Technical complexity level

## Scale Adaptation
- **Level 0-1:** Quick summary, move to PRD fast
- **Level 2:** Standard context review
- **Level 3-4:** Comprehensive analysis of requirements landscape before planning

## Completion Signal
When planning context is established, output:
```
STEP_COMPLETE
```
