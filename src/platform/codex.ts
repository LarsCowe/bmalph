import type { Platform } from "./types.js";
import { readFile } from "fs/promises";
import { join } from "path";
import { isEnoent, formatError } from "../utils/errors.js";

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
  getDoctorChecks: () => [
    {
      id: "instructions-file",
      label: "AGENTS.md contains BMAD snippet",
      check: async (projectDir: string) => {
        try {
          const content = await readFile(join(projectDir, "AGENTS.md"), "utf-8");
          if (content.includes("BMAD-METHOD Integration")) {
            return { passed: true };
          }
          return {
            passed: false,
            detail: "missing BMAD-METHOD Integration section",
            hint: "Run: bmalph init",
          };
        } catch (err) {
          if (isEnoent(err)) {
            return { passed: false, detail: "AGENTS.md not found", hint: "Run: bmalph init" };
          }
          return { passed: false, detail: formatError(err), hint: "Check file permissions" };
        }
      },
    },
  ],
};
