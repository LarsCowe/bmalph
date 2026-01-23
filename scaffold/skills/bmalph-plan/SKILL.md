# BMALPH - Planning Phase

## Description
Interactive planning skill with tri-modal support. Adopt the PM (John) persona and work through Phase 2 tasks.

## Trigger
- `/bmalph-plan` - Create mode (default)
- `/bmalph-plan validate` - Validate existing planning artifacts
- `/bmalph-plan edit` - Edit existing artifacts with compliance enforcement

## Modes

### Create Mode (default)
Generate planning artifacts from analysis inputs.

When invoked:
1. Read `bmalph/agents/pm.md` and adopt that persona
2. Read `bmalph/artifacts/analysis/` for Phase 1 inputs
3. Read `bmalph/config.json` for project details
4. Work through the progressive disclosure steps:
   - Step 1: Initialize planning context
   - Step 2: PRD creation
   - Step 3: User stories & epics
   - Step 4: MVP scope & task planning
   - Step 5: Self-validation

**Process:**
1. Show current progress in Phase 2
2. Continue from where the last step left off
3. Work collaboratively with the user
4. Write outputs to `bmalph/artifacts/planning/`
5. Generate `bmalph/state/phase-4-tasks.json`
6. Update progress

### Validate Mode
Review existing planning artifacts against quality criteria.

When invoked with `validate`:
1. Read `bmalph/agents/pm.md` and adopt reviewer perspective
2. Read all artifacts in `bmalph/artifacts/planning/`
3. Read Phase 1 artifacts for traceability checking
4. Evaluate against Phase 2 quality criteria:
   - Every requirement traced to a story
   - Acceptance criteria are clear and verifiable
   - Stories meet INVEST criteria
   - MVP is achievable and delivers core value
   - Dependencies between stories are mapped
   - Tasks cover all MVP stories
5. Produce a validation report:
   - **PASS/FAIL** verdict per artifact
   - Traceability gaps (requirements without stories)
   - Issues found with severity
   - Specific fix suggestions
6. Write report to `bmalph/artifacts/planning/validation-report.md`

### Edit Mode
Modify existing artifacts while maintaining structure and compliance.

When invoked with `edit`:
1. Read `bmalph/agents/pm.md` and adopt that persona
2. Read all artifacts in `bmalph/artifacts/planning/`
3. Ask the user what changes are needed
4. Apply changes while enforcing:
   - Story ID continuity
   - Acceptance criteria format consistency
   - Cross-reference integrity (requirements → stories → tasks)
   - MVP scope coherence (can't add without justification)
   - Task dependency graph validity
5. Cascade changes: if a story changes, update related tasks
6. After edits, run mini-validation
7. Report changes and side effects

## Outputs
- `bmalph/artifacts/planning/prd.md`
- `bmalph/artifacts/planning/user-stories.md`
- `bmalph/artifacts/planning/mvp-scope.md`
- `bmalph/state/phase-4-tasks.json`
- `bmalph/artifacts/planning/validation-report.md` (validate mode)

## Completion
When all phase-2 work is done, inform the user and suggest `/bmalph-design`.
