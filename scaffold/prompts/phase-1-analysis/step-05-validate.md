# Phase 1 - Step 5: Self-Validation

## Agent
Switch to **Reviewer** perspective.

## Goal
Validate all Phase 1 artifacts for completeness and quality before phase transition.

## Instructions

1. Read all Phase 1 artifacts:
   - `bmalph/artifacts/analysis/research.md`
   - `bmalph/artifacts/analysis/requirements.md`
   - `bmalph/artifacts/analysis/constraints.md`
   - `bmalph/artifacts/analysis/risks.md`

2. Validate against quality criteria:
   - [ ] Every requirement is testable/verifiable
   - [ ] Assumptions are explicitly labeled
   - [ ] No conflicting requirements remain unresolved
   - [ ] Priority is assigned to each requirement
   - [ ] Non-functional requirements are quantified where possible
   - [ ] Constraints are documented with source and impact
   - [ ] Risks have likelihood, impact, and mitigation

3. Check for consistency:
   - Requirements align with research findings
   - Constraints don't conflict with requirements
   - Risks are addressed in constraints or requirements
   - No orphan items (everything connects)

4. If issues found:
   - Fix minor issues directly
   - For significant gaps, note them and fix in artifacts

5. Produce a brief validation summary

## Output
If all criteria pass, output:
```
PHASE_COMPLETE
```

If critical issues remain that need human input:
```
<needs-human>
[Specific issues that need resolution]
</needs-human>
```
