# Start Implementation

Transition from BMAD planning (Phase 3) to Ralph implementation (Phase 4).

## Prerequisites

- bmalph must be initialized (`bmalph/config.json` must exist)
- Stories must exist in `_bmad-output/planning-artifacts/`

## Steps

### 1. Validate Prerequisites

Check that:
- `bmalph/config.json` exists
- `.ralph/ralph_loop.sh` exists
- `_bmad-output/planning-artifacts/` exists with story files

If any are missing, report the error and suggest running the required commands.

### 2. Parse Stories

Read `_bmad-output/planning-artifacts/stories.md` (or any file matching `*stor*.md` or `*epic*.md`):
- Extract epics: `## Epic N: Title`
- Extract stories: `### Story N.M: Title`
- Parse acceptance criteria (Given/When/Then blocks)

### 3. Generate `.ralph/@fix_plan.md`

Create an ordered list of stories as checkboxes:

```markdown
# Ralph Fix Plan

## Stories to Implement

### [Epic Title]
> Goal: [Epic description]

- [ ] Story 1.1: [Title]
  > [Description line 1]
  > AC: Given..., When..., Then...

## Completed

## Notes
- Follow TDD methodology (red-green-refactor)
- One story per Ralph loop iteration
- Update this file after completing each story
```

**Important:** If existing `@fix_plan.md` has completed items `[x]`, preserve their completion status in the new file.

### 4. Generate `.ralph/PROJECT_CONTEXT.md`

Extract from planning artifacts:
- Project goals from PRD (Executive Summary, Vision, Goals sections)
- Success metrics from PRD
- Architecture constraints from architecture document
- Technical risks from architecture document
- Scope boundaries from PRD
- Target users from PRD
- Non-functional requirements from PRD

Format as:

```markdown
# [Project Name] — Project Context

## Project Goals
[extracted content]

## Success Metrics
[extracted content]

## Architecture Constraints
[extracted content]

## Technical Risks
[extracted content]

## Scope Boundaries
[extracted content]

## Target Users
[extracted content]

## Non-Functional Requirements
[extracted content]
```

### 5. Copy Specs to `.ralph/specs/`

Copy the entire `_bmad-output/` tree to `.ralph/specs/`:
- This includes `planning-artifacts/`, `implementation-artifacts/`, etc.
- Preserve directory structure

If specs existed before, generate `SPECS_CHANGELOG.md`:
```markdown
# Specs Changelog

Last updated: [timestamp]

## Added
- [new files]

## Modified
- [changed files]

## Removed
- [deleted files]
```

### 6. Update State

Update `bmalph/state/current-phase.json`:
```json
{
  "currentPhase": 4,
  "status": "implementing",
  "startedAt": "[original or now]",
  "lastUpdated": "[now]"
}
```

### 7. Report Results

Output:
- Number of stories found
- Any warnings (missing PRD, architecture, NO-GO status in readiness report)
- Whether fix_plan progress was preserved

### 8. Instruct User

Display:

```
Transition complete. To start the Ralph autonomous loop:

    bash .ralph/ralph_loop.sh

Or in a separate terminal for background execution:

    nohup bash .ralph/ralph_loop.sh > .ralph/logs/ralph.log 2>&1 &
```

## Warnings to Check

- No PRD document found
- No architecture document found
- Readiness report indicates NO-GO status
- No stories parsed from the epics file
