import type { Platform } from "./types.js";
import { buildPlatformDoctorChecks } from "./doctor-checks.js";

export const codexPlatform: Platform = {
  id: "codex",
  displayName: "OpenAI Codex",
  tier: "full",
  instructionsFile: "AGENTS.md",
  commandDelivery: { kind: "inline" },
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: () => `
## BMAD-METHOD Integration

Run the BMAD master agent to navigate phases. Ask for help to discover all available agents and workflows.

### Phases

| Phase | Focus | Key Agents |
|-------|-------|-----------|
| 1. Analysis | Understand the problem | Analyst agent |
| 2. Planning | Define the solution | Product Manager agent |
| 3. Solutioning | Design the architecture | Architect agent |
| 4. Implementation | Build it | Developer agent, then Ralph autonomous loop |

### Workflow

1. Work through Phases 1-3 using BMAD agents and workflows
2. Use the bmalph-implement transition to prepare Ralph format, then start Ralph

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
`,
  getDoctorChecks() {
    return buildPlatformDoctorChecks(this);
  },
};
