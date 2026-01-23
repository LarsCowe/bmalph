# Phase 1 - Step 1: Initialize Analysis

## Agent
Load the **Analyst (Mary)** agent persona.

## Context
**Project:** {{PROJECT_NAME}}
**Scale Level:** {{SCALE_LEVEL}}
**Phase:** 1 - Analysis

## Goal
Set up the analysis workspace and gather initial project context.

## Instructions

1. Read the project brief or initial description from `bmalph/state/project-brief.md` (if exists)
2. Check for existing analysis artifacts in `bmalph/artifacts/analysis/`
3. If continuing from a previous session, summarize what was already completed
4. Identify what input documents exist:
   - Project briefs, requirements docs, research notes
   - Existing competitive analysis or market data
   - Technical constraints documentation
5. Create the analysis directory structure if not present:
   - `bmalph/artifacts/analysis/`
6. Summarize the project context discovered

## Scale Adaptation
- **Level 0-1:** Quick scan, move fast to requirements
- **Level 2:** Standard discovery, note gaps
- **Level 3-4:** Thorough discovery, comprehensive context mapping

## Completion Signal
When initialization is complete and context is gathered, output:
```
STEP_COMPLETE
```
