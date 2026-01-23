# Phase 2 - Step 3: User Stories & Epics

## Agent
Continue as **Product Manager (John)**.

## Goal
Break down PRD requirements into implementable user stories grouped by epics.

## Instructions

1. Group related requirements into **Epics** (logical feature areas)
2. For each epic, create **User Stories** in the format:
   ```
   As a [persona],
   I want to [action],
   So that [benefit].

   **Acceptance Criteria:**
   - Given [context], when [action], then [result]
   - ...

   **Priority:** Must/Should/Could
   **Dependencies:** [story IDs]
   **Estimated Complexity:** S/M/L/XL
   ```
3. Ensure stories are:
   - **Independent** - Can be developed separately
   - **Negotiable** - Not overly prescriptive
   - **Valuable** - Delivers user value
   - **Estimable** - Clear enough to size
   - **Small** - Implementable in reasonable scope
   - **Testable** - Acceptance criteria are verifiable
4. Map every PRD requirement to at least one story
5. Identify dependencies between stories

## Scale Adaptation
- **Level 0-1:** 3-8 stories, minimal ceremony
- **Level 2:** 8-20 stories with full INVEST criteria
- **Level 3-4:** 20+ stories, dependency graph, full acceptance criteria

## Output
Write stories to `bmalph/artifacts/planning/user-stories.md`

## Completion Signal
When stories are documented, output:
```
STEP_COMPLETE
```
