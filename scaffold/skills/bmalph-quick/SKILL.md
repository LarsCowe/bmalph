# BMALPH - Quick Flow

## Description
Streamlined flow for Level 0-1 projects. Combines brief analysis with direct implementation.

## Trigger
`/bmalph-quick`

## Behavior

For trivial (level 0) or simple (level 1) projects, skip the full 4-phase process:

### Level 0 (Trivial)
Single-shot execution:
1. Understand the request
2. Implement directly
3. Done - no loop needed

### Level 1 (Simple)
Quick flow (1-5 iterations):
1. **Brief Spec** (1 iteration): Document what needs to be built in 1-2 paragraphs
2. **Implement** (1-4 iterations): Build it with TDD

### Process
1. Read `bmalph/config.json` for project details
2. If level > 1, redirect to `/bmalph` for the full flow
3. For level 0: Execute the task directly
4. For level 1:
   a. Write a brief spec to `bmalph/artifacts/analysis/brief-spec.md`
   b. Confirm with user
   c. Implement with TDD
   d. Update progress

### Outputs
- `bmalph/artifacts/analysis/brief-spec.md` (level 1 only)
- Implementation code
- `bmalph/state/progress.txt`

### Completion
Mark project as complete when done.
