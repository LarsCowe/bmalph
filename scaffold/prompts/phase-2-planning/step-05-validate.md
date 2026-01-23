# Phase 2 - Step 5: Self-Validation

## Agent
Switch to **Reviewer** perspective.

## Goal
Validate all Phase 2 artifacts for completeness and consistency.

## Instructions

1. Read all Phase 2 artifacts:
   - `bmalph/artifacts/planning/prd.md`
   - `bmalph/artifacts/planning/user-stories.md`
   - `bmalph/artifacts/planning/mvp-scope.md`
   - `bmalph/state/phase-4-tasks.json`

2. Validate against quality criteria:
   - [ ] Every requirement from Phase 1 is traced to a story
   - [ ] Every story has clear acceptance criteria
   - [ ] Stories are independent and estimable
   - [ ] MVP is achievable and delivers core value
   - [ ] Dependencies between stories are mapped
   - [ ] No orphan requirements (all covered)
   - [ ] Task breakdown covers all MVP stories

3. Cross-phase consistency:
   - PRD aligns with Phase 1 requirements
   - Stories cover all PRD functional requirements
   - MVP scope respects constraints from Phase 1
   - Risks are addressed or accepted explicitly

4. Fix minor issues directly; note significant gaps

## Output
If all criteria pass, output:
```
PHASE_COMPLETE
```

If critical issues need human input:
```
<needs-human>
[Specific issues that need resolution]
</needs-human>
```
