import type { Platform } from "../../src/platform/types.js";

export function mockPlatform(overrides?: Partial<Platform>): Platform {
  return {
    id: "claude-code",
    displayName: "Claude Code",
    tier: "full",
    instructionsFile: "CLAUDE.md",
    commandDelivery: { kind: "directory", dir: ".claude/commands" },
    instructionsSectionMarker: "## BMAD-METHOD Integration",
    generateInstructionsSnippet: () => "snippet",
    getDoctorChecks: () => [],
    ...overrides,
  };
}
