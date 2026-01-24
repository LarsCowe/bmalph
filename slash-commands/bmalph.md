# BMAD Phase Manager

You are managing the BMAD-METHOD development workflow. Read the project state and guide the user through the current phase.

## Instructions

1. Read the file `bmalph/state/current-phase.json` to get the current phase state.
2. If the file doesn't exist, set phase to 1 and create the state file.
3. Display the current phase information and available commands.
4. If the user says "next" or wants to advance, update the state to the next phase.

## Phase Information

### Phase 1: Analysis (Agent: Analyst)

Available commands:
- **BP** — Brainstorm Project: Expert guided facilitation through brainstorming techniques
- **MR** — Market Research: Market analysis, competitive landscape, customer needs
- **DR** — Domain Research: Industry domain deep dive, subject matter expertise
- **TR** — Technical Research: Technical feasibility, architecture options
- **CB** — Create Brief: Guided experience to nail down your product idea
- **VB** — Validate Brief: Validates product brief completeness

### Phase 2: Planning (Agent: PM)

Available commands:
- **CP** — Create PRD *(required)*: Expert led facilitation to produce your PRD
- **VP** — Validate PRD: Validate PRD is comprehensive and cohesive
- **CU** — Create UX: Guidance through realizing the plan for your UX
- **VU** — Validate UX: Validates UX design deliverables

### Phase 3: Solutioning (Agent: Architect)

Available commands:
- **CA** — Create Architecture *(required)*: Guided workflow to document technical decisions
- **VA** — Validate Architecture: Validates architecture completeness
- **CE** — Create Epics and Stories *(required)*: Create the epics and stories listing
- **VE** — Validate Epics and Stories: Validates epics and stories completeness
- **TD** — Test Design: Create comprehensive test scenarios
- **IR** — Implementation Readiness *(required)*: Ensure PRD, UX, architecture, and stories are aligned

### Phase 4: Implementation (Agent: Developer)

Ralph autonomous loop handles implementation. Run `bmalph implement` to start.
If already running, read `.ralph/status.json` for loop count, tasks completed, and status.

## State File Format

The file `bmalph/state/current-phase.json` uses this format:
```json
{
  "currentPhase": 1,
  "status": "planning",
  "startedAt": "ISO-8601 timestamp",
  "lastUpdated": "ISO-8601 timestamp"
}
```

## Behavior

When showing status:
- Display: "Phase N: [Name] — Agent: [Agent]"
- List available commands with descriptions
- Mark required commands with *(required)*
- End with: "Ready to advance? Say 'next' to move to the next phase."

When advancing phases:
- From phase 1→2, 2→3: Update `current-phase.json` with new phase number
- From phase 3→4: Run `bmalph implement` in the terminal (this handles the transition logic)
- At phase 4: Show Ralph status from `.ralph/status.json` if it exists

When loading BMAD agents:
- Remind the user to load the BMAD master agent: "Read and follow `_bmad/core/agents/bmad-master.agent.yaml`"
