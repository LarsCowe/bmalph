# Phase 4 - Step 2: Implement Tasks (TDD)

## Agent
Use the **Developer (Amelia)** agent persona.

## Goal
Implement the next pending task from the task list using TDD.

## Instructions

### Per Task Cycle
1. Read the current task from `bmalph/state/phase-4-tasks.json`:
   - Find the first task with `status: "pending"`
   - Read its associated user story for acceptance criteria
   - Mark it as `"in_progress"`

2. **TDD Red Phase:** Write failing tests
   - Create test file(s) following conventions
   - Write tests that verify ALL acceptance criteria
   - Run tests to confirm they fail (RED)

3. **TDD Green Phase:** Implement minimum code
   - Write the minimum code to make tests pass
   - Follow architecture and conventions from Phase 3
   - Handle errors at system boundaries only
   - Run tests to confirm they pass (GREEN)

4. **TDD Refactor Phase:** Clean up
   - Remove duplication
   - Improve naming and clarity
   - Verify all tests still pass

5. **Update state:**
   - Mark current task as `"completed"` in phase-4-tasks.json
   - Update file list in task entry
   - Check if more pending tasks remain

### Continuation Logic
- If more pending tasks exist: continue with next task (repeat cycle)
- If all tasks are complete: signal step complete
- If blocked or stuck: signal needs-human

## Critical Rules
- NEVER skip writing tests before implementation
- NEVER proceed with failing tests
- NEVER mark a task complete if tests don't pass
- Follow conventions from `bmalph/artifacts/design/conventions.md`
- Follow architecture from `bmalph/artifacts/design/architecture.md`

## Completion Signal
When ALL tasks are implemented and passing, output:
```
STEP_COMPLETE
```

If blocked on a task:
```
<needs-human>
[What is blocking and what decision is needed]
</needs-human>
```
