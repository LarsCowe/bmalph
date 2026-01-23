# BMALPH - Analysis Phase

## Description
Interactive analysis skill with tri-modal support. Adopt the Analyst (Mary) persona and work through Phase 1 tasks.

## Trigger
- `/bmalph-analyze` - Create mode (default)
- `/bmalph-analyze validate` - Validate existing analysis artifacts
- `/bmalph-analyze edit` - Edit existing artifacts with compliance enforcement

## Modes

### Create Mode (default)
Generate analysis artifacts from scratch.

When invoked:
1. Read `bmalph/agents/analyst.md` and adopt that persona
2. Read `bmalph/config.json` for project details
3. Read `bmalph/state/progress.txt` for context
4. Work through the progressive disclosure steps:
   - Step 1: Initialize context
   - Step 2: Research
   - Step 3: Requirements
   - Step 4: Constraints & Risks
   - Step 5: Self-validation

**Process:**
1. Show current progress in Phase 1
2. Continue from where the last step left off (or start fresh)
3. Work collaboratively with the user through each step
4. Write outputs to `bmalph/artifacts/analysis/`
5. Update `bmalph/state/progress.txt`

### Validate Mode
Review existing analysis artifacts against quality criteria.

When invoked with `validate`:
1. Read `bmalph/agents/analyst.md` and adopt reviewer perspective
2. Read all artifacts in `bmalph/artifacts/analysis/`
3. Evaluate against Phase 1 quality criteria:
   - Every requirement is testable/verifiable
   - Assumptions are explicitly labeled
   - No conflicting requirements unresolved
   - Priority assigned to each requirement
   - NFRs are quantified
   - Constraints have source and impact
   - Risks have likelihood, impact, mitigation
4. Produce a validation report:
   - **PASS/FAIL** verdict per artifact
   - Issues found (severity: blocker/warning/note)
   - Specific fix suggestions
5. Write report to `bmalph/artifacts/analysis/validation-report.md`

### Edit Mode
Modify existing artifacts while maintaining structure and compliance.

When invoked with `edit`:
1. Read `bmalph/agents/analyst.md` and adopt that persona
2. Read all artifacts in `bmalph/artifacts/analysis/`
3. Ask the user what changes are needed
4. Apply changes while enforcing:
   - Structure consistency (don't break artifact format)
   - Requirement ID continuity (don't renumber)
   - Cross-reference integrity (update dependencies)
   - Quality criteria compliance (new content meets standards)
5. After edits, run a mini-validation to confirm nothing broke
6. Report what changed and any side effects

## Outputs
- `bmalph/artifacts/analysis/requirements.md`
- `bmalph/artifacts/analysis/constraints.md`
- `bmalph/artifacts/analysis/research.md`
- `bmalph/artifacts/analysis/risks.md`
- `bmalph/artifacts/analysis/validation-report.md` (validate mode)

## Completion
When all phase-1 work is done, inform the user and suggest `/bmalph-plan`.
