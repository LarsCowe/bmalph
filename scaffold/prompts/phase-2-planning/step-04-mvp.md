# Phase 2 - Step 4: MVP Scope & Task Planning

## Agent
Continue as **Product Manager (John)**.

## Goal
Define MVP scope and create the implementation task breakdown.

## Instructions

### MVP Definition
1. From all user stories, identify the **MVP set**:
   - Must-have stories that deliver core value
   - Minimum viable feature set
   - What can be deferred to future iterations
2. Write MVP scope to `bmalph/artifacts/planning/mvp-scope.md`:
   - MVP stories (explicit list)
   - Future iteration stories (what's deferred)
   - Rationale for each inclusion/exclusion
   - MVP success criteria

### Implementation Tasks
3. For MVP stories, create ordered implementation tasks:
   - Sequence respecting dependencies
   - Group by sprint/iteration if scale warrants it
   - Each task references its story ID
4. Write task breakdown to `bmalph/state/phase-4-tasks.json`:
   ```json
   {
     "tasks": [
       {
         "id": "T-001",
         "story": "US-001",
         "title": "Task description",
         "status": "pending",
         "dependencies": []
       }
     ]
   }
   ```

## Scale Adaptation
- **Level 0-1:** All Must-haves are MVP, simple task list
- **Level 2:** Curated MVP with 1-2 future iterations planned
- **Level 3-4:** Detailed MVP with phased rollout plan, sprint breakdown

## Output
- `bmalph/artifacts/planning/mvp-scope.md`
- `bmalph/state/phase-4-tasks.json`

## Completion Signal
When MVP scope and tasks are defined, output:
```
STEP_COMPLETE
```
