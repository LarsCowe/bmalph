# BMALPH - Implementation Phase

## Description
Interactive implementation skill. Adopt the Developer persona and work through Phase 4 tasks using TDD.

## Trigger
`/bmalph-implement`

## Behavior

When invoked:

1. Read `bmalph/agents/developer.md` and adopt that persona
2. Read `bmalph/state/phase-4-tasks.json` for current tasks
3. Read `bmalph/artifacts/design/` for architecture and conventions
4. Read `bmalph/state/progress.txt` for context

Work interactively with the user to implement features using TDD:
- Write tests first
- Implement to make tests pass
- Refactor

### Process
1. Show current phase-4 tasks and their status
2. Ask the user which task to work on
3. Follow TDD cycle:
   a. Write failing tests based on acceptance criteria
   b. Implement minimum code to pass
   c. Refactor for quality
   d. Verify all tests pass
4. Update task status and progress

### Quality Checks
- Run tests after each implementation
- Follow conventions from `bmalph/artifacts/design/conventions.md`
- No security vulnerabilities
- Clean, focused commits

### Completion
When all phase-4 tasks are done, run final tests and inform the user the project is complete.
