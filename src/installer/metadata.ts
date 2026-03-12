import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { debug } from "../utils/logger.js";
import { formatError, isEnoent } from "../utils/errors.js";
import type { Platform } from "../platform/types.js";
import type { BundledVersions } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getPackageVersion(): Promise<string> {
  const pkgPath = join(__dirname, "..", "..", "package.json");
  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch (err) {
    if (!isEnoent(err)) {
      debug(`Failed to read package.json: ${formatError(err)}`);
    }
    return "unknown";
  }
}

export async function getBundledVersions(): Promise<BundledVersions> {
  const versionsPath = join(__dirname, "..", "..", "bundled-versions.json");
  try {
    const versions = JSON.parse(await readFile(versionsPath, "utf-8"));
    if (!versions || typeof versions.bmadCommit !== "string") {
      throw new Error("Invalid bundled-versions.json structure: missing bmadCommit");
    }
    return {
      bmadCommit: versions.bmadCommit,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid bundled-versions.json")) {
      throw err;
    }
    throw new Error(`Failed to read bundled-versions.json at ${versionsPath}`, { cause: err });
  }
}

export function getBundledBmadDir(): string {
  return join(__dirname, "..", "..", "bmad");
}

export function getBundledRalphDir(): string {
  return join(__dirname, "..", "..", "ralph");
}

export function getSlashCommandsDir(): string {
  return join(__dirname, "..", "..", "slash-commands");
}

/**
 * Lazily loads the default (claude-code) platform to avoid circular imports
 * and keep backward compatibility for callers that don't pass a platform.
 */
export async function getDefaultPlatform(): Promise<Platform> {
  const { claudeCodePlatform } = await import("../platform/claude-code.js");
  return claudeCodePlatform;
}
