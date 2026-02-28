/**
 * Shared instructions snippet for instructions-only platforms.
 * Used by: cursor, windsurf, copilot, aider.
 */
export function generateInstructionsOnlySnippet(): string {
  return `
## BMAD-METHOD Integration

Ask the BMAD master agent to navigate phases. Ask for help to discover all available agents and workflows.

### Phases

| Phase | Focus | Key Agents |
|-------|-------|-----------|
| 1. Analysis | Understand the problem | Analyst agent |
| 2. Planning | Define the solution | Product Manager agent |
| 3. Solutioning | Design the architecture | Architect agent |

### Workflow

Work through Phases 1-3 using BMAD agents and workflows interactively.

> **Note:** Ralph (Phase 4 — autonomous implementation) is not supported on this platform.

### Available Agents

| Agent | Role |
|-------|------|
| Analyst | Research, briefs, discovery |
| Architect | Technical design, architecture |
| Product Manager | PRDs, epics, stories |
| Scrum Master | Sprint planning, status, coordination |
| Developer | Implementation, coding |
| UX Designer | User experience, wireframes |
| QA Engineer | Test automation, quality assurance |
`;
}
