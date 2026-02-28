import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../utils/file-system.js";
import { isEnoent, formatError } from "../utils/errors.js";
import type { Platform, PlatformDoctorCheck } from "./types.js";

/**
 * Creates the standard instructions-file doctor check for a platform.
 */
export function createInstructionsFileCheck(platform: Platform): PlatformDoctorCheck {
  const file = platform.instructionsFile;
  return {
    id: "instructions-file",
    label: `${file} contains BMAD snippet`,
    check: async (projectDir: string) => {
      try {
        const content = await readFile(join(projectDir, file), "utf-8");
        if (content.includes(platform.instructionsSectionMarker)) {
          return { passed: true };
        }
        return {
          passed: false,
          detail: `missing ${platform.instructionsSectionMarker} section`,
          hint: "Run: bmalph init",
        };
      } catch (err) {
        if (isEnoent(err)) {
          return { passed: false, detail: `${file} not found`, hint: "Run: bmalph init" };
        }
        return { passed: false, detail: formatError(err), hint: "Check file permissions" };
      }
    },
  };
}

/**
 * Creates a slash-command check for directory-based command delivery.
 */
function createSlashCommandCheck(dir: string): PlatformDoctorCheck {
  return {
    id: "slash-command",
    label: `${dir}/bmalph.md present`,
    check: async (projectDir: string) => {
      if (await exists(join(projectDir, `${dir}/bmalph.md`))) {
        return { passed: true };
      }
      return { passed: false, detail: "not found", hint: "Run: bmalph init" };
    },
  };
}

/**
 * Builds the standard set of doctor checks for any platform.
 * Derives checks from the platform's properties.
 */
export function buildPlatformDoctorChecks(platform: Platform): PlatformDoctorCheck[] {
  const checks: PlatformDoctorCheck[] = [];

  if (platform.commandDelivery.kind === "directory") {
    checks.push(createSlashCommandCheck(platform.commandDelivery.dir));
  }

  checks.push(createInstructionsFileCheck(platform));

  return checks;
}
