# BMALPH - Quick Flow

## Description
Streamlined flow for Level 0-2 projects. Adopt the Quick Flow (Barry) persona. Combines spec creation with direct implementation using minimal ceremony.

## Trigger
- `/bmalph-quick` - Create mode (default)
- `/bmalph-quick validate` - Validate existing quick-flow artifacts
- `/bmalph-quick edit` - Edit existing artifacts/code with compliance enforcement

## Modes

### Create Mode (default)
Fast-track from spec to implementation.

When invoked:
1. Read `bmalph/agents/quick-flow.md` and adopt that persona
2. Read `bmalph/config.json` for project details
3. Determine project level:

**Level 0 (Trivial):**
- Single-shot execution
- Understand the request, implement directly, done

**Level 1 (Simple):**
- Write a brief tech spec to `bmalph/artifacts/analysis/tech-spec.md`
- Implement with TDD (1-5 iterations)

**Level 2 (Standard - Quick path):**
- Write a more detailed tech spec with stories
- Implement stories sequentially with TDD
- Self-review at the end

**Process:**
1. Assess complexity and confirm level with user
2. If level > 2, redirect to `/bmalph` for the full flow
3. Write tech spec (level 1-2)
4. Implement with TDD
5. Self-review code quality
6. Update progress

### Validate Mode
Review existing quick-flow implementation.

When invoked with `validate`:
1. Read `bmalph/agents/quick-flow.md` and adopt reviewer perspective
2. Read tech spec and implementation
3. Evaluate:
   - Tech spec is complete enough for the scope
   - All tests pass
   - Code is clean and maintainable
   - No security issues
   - Works end-to-end as specified
4. Produce brief validation summary
5. Write to `bmalph/artifacts/analysis/validation-report.md`

### Edit Mode
Modify existing quick-flow artifacts or code.

When invoked with `edit`:
1. Read `bmalph/agents/quick-flow.md` and adopt that persona
2. Read existing spec and implementation
3. Ask user what changes are needed
4. Apply changes maintaining:
   - Test coverage (update tests for changed behavior)
   - Spec-to-code alignment
   - Code quality standards
5. Run tests after edits
6. Report changes

## Outputs
- `bmalph/artifacts/analysis/tech-spec.md` (level 1-2)
- Implementation code
- `bmalph/state/progress.txt`

## Completion
Mark project as complete when done.
