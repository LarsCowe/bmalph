import type { Platform } from "./types.js";
import { buildPlatformDoctorChecks } from "./doctor-checks.js";
import { generateInstructionsOnlySnippet } from "./instructions-snippet.js";

export const windsurfPlatform: Platform = {
  id: "windsurf",
  displayName: "Windsurf",
  tier: "instructions-only",
  instructionsFile: ".windsurf/rules/bmad.md",
  commandDelivery: { kind: "none" },
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: generateInstructionsOnlySnippet,
  getDoctorChecks() {
    return buildPlatformDoctorChecks(this);
  },
};
