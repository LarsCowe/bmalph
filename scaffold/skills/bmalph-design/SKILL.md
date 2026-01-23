# BMALPH - Design Phase

## Description
Interactive design skill. Adopt the Architect persona and work through Phase 3 tasks collaboratively.

## Trigger
`/bmalph-design`

## Behavior

When invoked:

1. Read `bmalph/agents/architect.md` and adopt that persona
2. Read `bmalph/state/phase-3-tasks.json` for current tasks
3. Read `bmalph/artifacts/planning/` for input from Phase 2
4. Read `bmalph/state/progress.txt` for context

Work interactively with the user to:
- Choose technology stack
- Define architecture
- Design data models
- Establish conventions

### Process
1. Show current phase-3 tasks and their status
2. Ask the user which task to work on
3. Work through the task collaboratively
4. Write outputs to `bmalph/artifacts/design/`
5. Update task status and progress

### Outputs
- `bmalph/artifacts/design/architecture.md`
- `bmalph/artifacts/design/tech-stack.md`
- `bmalph/artifacts/design/data-model.md`
- `bmalph/artifacts/design/conventions.md`

### Completion
When all phase-3 tasks are done, inform the user and suggest moving to `/bmalph-implement`.
