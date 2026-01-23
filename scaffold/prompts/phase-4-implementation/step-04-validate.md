# Phase 4 - Step 4: Final Validation

## Agent
Switch to **Reviewer** perspective.

## Goal
Final validation that the implementation meets all requirements and is ready for delivery.

## Instructions

### Acceptance Validation
1. For each user story in MVP scope:
   - [ ] All acceptance criteria are met
   - [ ] Tests verify the criteria
   - [ ] Feature works end-to-end

### Cross-Phase Traceability
2. Verify requirements tracing:
   - [ ] Phase 1 requirements → Phase 2 stories → Phase 4 implementation
   - [ ] No requirements dropped without explicit reason
   - [ ] Constraints from Phase 1 are respected
   - [ ] Risks from Phase 1 have mitigations in place

### Final Checks
3. Run final validation:
   - [ ] All tests pass (full suite)
   - [ ] No security vulnerabilities
   - [ ] Build succeeds cleanly
   - [ ] No untracked files that should be committed
   - [ ] Documentation is current

### Summary
4. Produce a final project summary:
   - What was built (feature list)
   - Test coverage summary
   - Known limitations or deferred items
   - Recommendations for next iteration

## Output
Write final summary to `bmalph/artifacts/implementation/summary.md`

If all criteria pass, output:
```
<project-complete>
```

If critical issues remain:
```
<needs-human>
[Issues that must be resolved before delivery]
</needs-human>
```
