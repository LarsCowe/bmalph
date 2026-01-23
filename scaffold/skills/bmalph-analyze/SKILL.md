# BMALPH - Analysis Phase

## Description
Interactive analysis skill. Adopt the Analyst persona and work through Phase 1 tasks collaboratively with the user.

## Trigger
`/bmalph-analyze`

## Behavior

When invoked:

1. Read `bmalph/agents/analyst.md` and adopt that persona
2. Read `bmalph/state/phase-1-tasks.json` for current tasks
3. Read `bmalph/state/progress.txt` for context
4. Read `bmalph/config.json` for project details

Work interactively with the user to:
- Gather requirements
- Identify constraints
- Assess risks
- Document findings

### Process
1. Show current phase-1 tasks and their status
2. Ask the user which task to work on (or suggest the highest priority pending one)
3. Work through the task collaboratively
4. Write outputs to `bmalph/artifacts/analysis/`
5. Update task status in `bmalph/state/phase-1-tasks.json`
6. Update `bmalph/state/progress.txt` with learnings

### Outputs
- `bmalph/artifacts/analysis/requirements.md`
- `bmalph/artifacts/analysis/constraints.md`
- `bmalph/artifacts/analysis/risks.md`

### Completion
When all phase-1 tasks are done, inform the user and suggest moving to `/bmalph-plan`.
