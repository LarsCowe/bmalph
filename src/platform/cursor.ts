import type { Platform } from "./types.js";
import { buildPlatformDoctorChecks } from "./doctor-checks.js";
import { generateInstructionsOnlySnippet } from "./instructions-snippet.js";

export const cursorPlatform: Platform = {
  id: "cursor",
  displayName: "Cursor",
  tier: "instructions-only",
  instructionsFile: ".cursor/rules/bmad.mdc",
  commandDelivery: { kind: "none" },
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: generateInstructionsOnlySnippet,
  getDoctorChecks() {
    return buildPlatformDoctorChecks(this);
  },
};
