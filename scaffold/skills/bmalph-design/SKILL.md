# BMALPH - Design Phase

## Description
Interactive design skill with tri-modal support. Adopt the Architect (Winston) persona and work through Phase 3 tasks.

## Trigger
- `/bmalph-design` - Create mode (default)
- `/bmalph-design validate` - Validate existing design artifacts
- `/bmalph-design edit` - Edit existing artifacts with compliance enforcement

## Modes

### Create Mode (default)
Generate design artifacts from planning inputs.

When invoked:
1. Read `bmalph/agents/architect.md` and adopt that persona
2. Read `bmalph/artifacts/planning/` for Phase 2 inputs
3. Read `bmalph/artifacts/analysis/constraints.md` for constraints
4. Read `bmalph/config.json` for project details
5. Work through the progressive disclosure steps:
   - Step 1: Initialize design context
   - Step 2: Architecture design
   - Step 3: Data model & API design
   - Step 4: Coding conventions
   - Step 5: Self-validation & implementation readiness

**Process:**
1. Show current progress in Phase 3
2. Continue from where the last step left off
3. Work collaboratively with the user
4. Write outputs to `bmalph/artifacts/design/`
5. Update progress

### Validate Mode
Review existing design artifacts against quality criteria.

When invoked with `validate`:
1. Read `bmalph/agents/architect.md` and adopt reviewer perspective
2. Also load `bmalph/agents/test-architect.md` for quality gate assessment
3. Read all artifacts in `bmalph/artifacts/design/`
4. Read Phase 2 artifacts for traceability checking
5. Evaluate against Phase 3 quality criteria:
   - Architecture addresses all non-functional requirements
   - Component boundaries are clear and justified
   - Technology choices have rationale
   - Data model supports all user stories
   - API design covers required endpoints
   - Coding conventions are complete
   - Security considerations are addressed
6. Run implementation readiness assessment:
   - Every story is implementable with this architecture
   - No technical gaps that block development
   - Constraints are respected
7. Produce validation report with:
   - **PASS/FAIL** verdict per artifact
   - Implementation readiness assessment
   - Issues with severity
   - Specific fix suggestions
8. Write report to `bmalph/artifacts/design/validation-report.md`

### Edit Mode
Modify existing artifacts while maintaining structure and compliance.

When invoked with `edit`:
1. Read `bmalph/agents/architect.md` and adopt that persona
2. Read all artifacts in `bmalph/artifacts/design/`
3. Ask the user what changes are needed
4. Apply changes while enforcing:
   - Architecture decision consistency (don't contradict existing ADRs)
   - Data model integrity (relationships must remain valid)
   - API contract compatibility (don't break existing contracts)
   - Convention consistency (changes apply uniformly)
   - Cross-reference integrity with planning artifacts
5. After edits, verify implementation readiness still holds
6. Report changes, affected components, and side effects

## Outputs
- `bmalph/artifacts/design/architecture.md`
- `bmalph/artifacts/design/data-model.md`
- `bmalph/artifacts/design/api-design.md`
- `bmalph/artifacts/design/conventions.md`
- `bmalph/artifacts/design/validation-report.md` (validate mode)

## Completion
When all phase-3 work is done, run implementation readiness check and suggest `/bmalph-implement`.
