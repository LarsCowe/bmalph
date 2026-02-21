/**
 * Platform abstraction layer for bmalph.
 *
 * Controls how `bmalph init/upgrade/doctor` install instruction files,
 * deliver slash commands, and run health checks per platform.
 */

/** Supported platform identifiers. */
export type PlatformId = "claude-code" | "codex" | "cursor" | "windsurf" | "copilot" | "aider";

/** Full platforms support Phases 1-4 (planning + Ralph implementation). */
/** Instructions-only platforms support Phases 1-3 (planning only). */
export type PlatformTier = "full" | "instructions-only";

/** How slash commands are delivered to the platform. */
export type CommandDelivery =
  | { kind: "directory"; dir: string }
  | { kind: "inline" }
  | { kind: "none" };

/** Result of a single platform-specific doctor check. */
export interface PlatformDoctorCheck {
  id: string;
  label: string;
  check: (projectDir: string) => Promise<{ passed: boolean; detail?: string; hint?: string }>;
}

/** Platform definition controlling install, upgrade, and doctor behavior. */
export interface Platform {
  readonly id: PlatformId;
  readonly displayName: string;
  readonly tier: PlatformTier;
  readonly instructionsFile: string;
  readonly commandDelivery: CommandDelivery;
  readonly instructionsSectionMarker: string;
  readonly generateInstructionsSnippet: () => string;
  readonly getDoctorChecks: () => PlatformDoctorCheck[];
}
