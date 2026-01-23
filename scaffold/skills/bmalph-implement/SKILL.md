# BMALPH - Implementation Phase

## Description
Interactive implementation skill with tri-modal support. Adopt the Developer (Amelia) persona and implement using TDD.

## Trigger
- `/bmalph-implement` - Create mode (default)
- `/bmalph-implement validate` - Validate existing implementation
- `/bmalph-implement edit` - Edit existing code with compliance enforcement

## Modes

### Create Mode (default)
Implement features from the task list using TDD.

When invoked:
1. Read `bmalph/agents/developer.md` and adopt that persona
2. Read `bmalph/state/phase-4-tasks.json` for current tasks
3. Read `bmalph/artifacts/design/` for architecture and conventions
4. Read `bmalph/artifacts/planning/user-stories.md` for acceptance criteria
5. Work through implementation steps:
   - Step 1: Initialize project scaffold
   - Step 2: Implement tasks (TDD cycle)
   - Step 3: Code review
   - Step 4: Final validation

**Process:**
1. Show current task list with status
2. Pick the next pending task (or user-specified)
3. Follow TDD cycle:
   a. Write failing tests (RED)
   b. Implement minimum code (GREEN)
   c. Refactor
   d. Verify all tests pass
4. Mark task complete, move to next
5. Update progress

### Validate Mode
Review existing implementation against design and requirements.

When invoked with `validate`:
1. Read `bmalph/agents/developer.md` and adopt reviewer perspective
2. Also load `bmalph/agents/test-architect.md` for test quality
3. Read all implementation code
4. Read design artifacts for compliance checking
5. Evaluate against Phase 4 quality criteria:
   - All tests pass
   - Acceptance criteria are met for each story
   - Code follows conventions
   - No security vulnerabilities
   - No dead code or unused imports
   - Architecture boundaries respected
   - Data model implementation matches design
   - API contracts match spec
6. Evaluate test quality:
   - Meaningful assertions (not trivial)
   - Edge cases covered
   - No flaky patterns
   - Coverage is adequate
7. Produce validation report:
   - **PASS/FAIL** overall and per story
   - Code quality issues with severity
   - Test coverage gaps
   - Security concerns
8. Write report to `bmalph/artifacts/implementation/validation-report.md`

### Edit Mode
Modify existing implementation while maintaining quality.

When invoked with `edit`:
1. Read `bmalph/agents/developer.md` and adopt that persona
2. Read the codebase and design artifacts
3. Ask the user what changes are needed
4. Apply changes while enforcing:
   - All existing tests continue to pass
   - New code has corresponding tests
   - Conventions are followed
   - Architecture boundaries respected
   - No security regressions
5. After edits, run full test suite
6. Report what changed and verify no regressions

## Outputs
- Implementation code (project-specific)
- Test files (project-specific)
- `bmalph/artifacts/implementation/review.md`
- `bmalph/artifacts/implementation/summary.md`
- `bmalph/artifacts/implementation/validation-report.md` (validate mode)

## Completion
When all tasks are complete and validated, mark project as done.
