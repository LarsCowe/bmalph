import type { Platform } from "./types.js";
import { buildPlatformDoctorChecks } from "./doctor-checks.js";
import { generateInstructionsOnlySnippet } from "./instructions-snippet.js";

export const copilotPlatform: Platform = {
  id: "copilot",
  displayName: "GitHub Copilot",
  tier: "instructions-only",
  instructionsFile: ".github/copilot-instructions.md",
  commandDelivery: { kind: "none" },
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: generateInstructionsOnlySnippet,
  getDoctorChecks() {
    return buildPlatformDoctorChecks(this);
  },
};
