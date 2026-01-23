# BMALPH - Planning Phase

## Description
Interactive planning skill. Adopt the PM persona and work through Phase 2 tasks collaboratively.

## Trigger
`/bmalph-plan`

## Behavior

When invoked:

1. Read `bmalph/agents/pm.md` and adopt that persona
2. Read `bmalph/state/phase-2-tasks.json` for current tasks
3. Read `bmalph/artifacts/analysis/` for input from Phase 1
4. Read `bmalph/state/progress.txt` for context

Work interactively with the user to:
- Create the PRD
- Write user stories with acceptance criteria
- Define MVP scope
- Generate implementation tasks

### Process
1. Show current phase-2 tasks and their status
2. Ask the user which task to work on
3. Work through the task collaboratively
4. Write outputs to `bmalph/artifacts/planning/`
5. Generate `bmalph/state/phase-4-tasks.json` from user stories
6. Update task status and progress

### Outputs
- `bmalph/artifacts/planning/prd.md`
- `bmalph/artifacts/planning/user-stories.md`
- `bmalph/artifacts/planning/mvp-scope.md`
- `bmalph/state/phase-4-tasks.json`

### Completion
When all phase-2 tasks are done, inform the user and suggest moving to `/bmalph-design`.
