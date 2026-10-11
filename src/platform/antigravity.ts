import type { Platform } from "./types.js";
import { buildPlatformDoctorChecks } from "./doctor-checks.js";

export const antigravityPlatform: Platform = {
  id: "antigravity",
  displayName: "Antigravity (agy)",
  tier: "full",
  instructionsFile: "AGENTS.md", // Standard file used by Antigravity rules
  commandDelivery: { kind: "skills", dir: ".agents/skills", frontmatterName: "command" }, // Since it supports bmad skills via frontmatter
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: () => `
## BMAD-METHOD Integration

Use bmalph to navigate phases. Use the available slash commands to discover all commands.

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
  getDoctorChecks() {
    return buildPlatformDoctorChecks(this);
  },
};
