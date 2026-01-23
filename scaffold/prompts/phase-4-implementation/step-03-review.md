# Phase 4 - Step 3: Code Review

## Agent
Switch to **Reviewer** perspective with **Test Architect (Murat)** quality lens.

## Goal
Comprehensive code review of all implementation work.

## Instructions

### Code Quality Review
1. Review all implemented code against conventions:
   - [ ] Code follows project conventions
   - [ ] Naming is consistent and clear
   - [ ] No dead code or unused imports
   - [ ] Error handling is appropriate
   - [ ] No security vulnerabilities (OWASP top 10)
   - [ ] No hardcoded secrets or credentials

### Test Coverage Review
2. Review test quality:
   - [ ] All acceptance criteria have corresponding tests
   - [ ] Tests are meaningful (not trivial assertions)
   - [ ] Edge cases are covered
   - [ ] Test structure follows conventions (AAA pattern)
   - [ ] No flaky test patterns

### Architecture Compliance
3. Verify adherence to design:
   - [ ] Component boundaries are respected
   - [ ] Data flow matches architecture diagram
   - [ ] API contracts match design spec
   - [ ] Data model implementation matches design

### Fix Issues
4. For issues found:
   - **Blockers:** Fix immediately (security, failing tests, convention violations)
   - **Warnings:** Fix if straightforward, document otherwise
   - **Notes:** Document for future improvement

5. Run full test suite after any fixes

## Output
Write review results to `bmalph/artifacts/implementation/review.md`

## Completion Signal
When review is complete and all blockers are fixed, output:
```
STEP_COMPLETE
```
