import type { Platform } from "./types.js";
import { readFile } from "fs/promises";
import { join } from "path";
import { exists } from "../utils/file-system.js";
import { isEnoent, formatError } from "../utils/errors.js";

export const claudeCodePlatform: Platform = {
  id: "claude-code",
  displayName: "Claude Code",
  tier: "full",
  instructionsFile: "CLAUDE.md",
  commandDelivery: { kind: "directory", dir: ".claude/commands" },
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: () => `
## BMAD-METHOD Integration

Use \`/bmalph\` to navigate phases. Use \`/bmad-help\` to discover all commands. Use \`/bmalph-status\` for a quick overview.

### Phases

| Phase | Focus | Key Commands |
|-------|-------|-------------|
| 1. Analysis | Understand the problem | \`/create-brief\`, \`/brainstorm-project\`, \`/market-research\` |
| 2. Planning | Define the solution | \`/create-prd\`, \`/create-ux\` |
| 3. Solutioning | Design the architecture | \`/create-architecture\`, \`/create-epics-stories\`, \`/implementation-readiness\` |
| 4. Implementation | Build it | \`/sprint-planning\`, \`/create-story\`, then \`/bmalph-implement\` for Ralph |

### Workflow

1. Work through Phases 1-3 using BMAD agents and workflows (interactive, command-driven)
2. Run \`/bmalph-implement\` to transition planning artifacts into Ralph format, then start Ralph

### Management Commands

| Command | Description |
|---------|-------------|
| \`/bmalph-status\` | Show current phase, Ralph progress, version info |
| \`/bmalph-implement\` | Transition planning artifacts → prepare Ralph loop |
| \`/bmalph-upgrade\` | Update bundled assets to match current bmalph version |
| \`/bmalph-doctor\` | Check project health and report issues |
| \`/bmalph-reset\` | Reset state (soft or hard reset with confirmation) |

### Available Agents

| Command | Agent | Role |
|---------|-------|------|
| \`/analyst\` | Analyst | Research, briefs, discovery |
| \`/architect\` | Architect | Technical design, architecture |
| \`/pm\` | Product Manager | PRDs, epics, stories |
| \`/sm\` | Scrum Master | Sprint planning, status, coordination |
| \`/dev\` | Developer | Implementation, coding |
| \`/ux-designer\` | UX Designer | User experience, wireframes |
| \`/qa\` | QA Engineer | Test automation, quality assurance |
`,
  getDoctorChecks: () => [
    {
      id: "slash-command",
      label: ".claude/commands/bmalph.md present",
      check: async (projectDir: string) => {
        if (await exists(join(projectDir, ".claude/commands/bmalph.md"))) {
          return { passed: true };
        }
        return { passed: false, detail: "not found", hint: "Run: bmalph init" };
      },
    },
    {
      id: "instructions-file",
      label: "CLAUDE.md contains BMAD snippet",
      check: async (projectDir: string) => {
        try {
          const content = await readFile(join(projectDir, "CLAUDE.md"), "utf-8");
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
            return { passed: false, detail: "CLAUDE.md not found", hint: "Run: bmalph init" };
          }
          return { passed: false, detail: formatError(err), hint: "Check file permissions" };
        }
      },
    },
  ],
};
