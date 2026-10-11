import type { Platform, PlatformId } from "./types.js";
import { claudeCodePlatform } from "./claude-code.js";
import { codexPlatform } from "./codex.js";
import { opencodePlatform } from "./opencode.js";
import { cursorPlatform } from "./cursor.js";
import { windsurfPlatform } from "./windsurf.js";
import { copilotPlatform } from "./copilot.js";
import { aiderPlatform } from "./aider.js";
import { antigravityPlatform } from "./antigravity.js";

const PLATFORMS: ReadonlyMap<PlatformId, Platform> = new Map([
  ["claude-code", claudeCodePlatform],
  ["codex", codexPlatform],
  ["opencode", opencodePlatform],
  ["cursor", cursorPlatform],
  ["windsurf", windsurfPlatform],
  ["copilot", copilotPlatform],
  ["aider", aiderPlatform],
  ["antigravity", antigravityPlatform],
]);

export function getPlatform(id: PlatformId): Platform {
  const platform = PLATFORMS.get(id);
  if (!platform) {
    throw new Error(`Unknown platform: ${id}`);
  }
  return platform;
}

export function getAllPlatforms(): Platform[] {
  return [...PLATFORMS.values()];
}

export function isPlatformId(value: string): value is PlatformId {
  return PLATFORMS.has(value as PlatformId);
}

export function getFullTierPlatformNames(): string {
  return getAllPlatforms()
    .filter((p) => p.tier === "full")
    .map((p) => p.displayName)
    .join(", ");
}
