import type { PlatformId } from "./types.js";
import { exists } from "../utils/file-system.js";
import { join } from "path";

interface DetectionResult {
  detected: PlatformId | null;
  candidates: PlatformId[];
}

const DETECTION_MARKERS: Array<{ platform: PlatformId; markers: string[] }> = [
  { platform: "claude-code", markers: [".claude"] },
  { platform: "codex", markers: ["AGENTS.md"] },
  { platform: "cursor", markers: [".cursor"] },
  { platform: "windsurf", markers: [".windsurf"] },
  { platform: "copilot", markers: [".github/copilot-instructions.md"] },
  { platform: "aider", markers: [".aider.conf.yml"] },
];

export async function detectPlatform(projectDir: string): Promise<DetectionResult> {
  const candidates: PlatformId[] = [];

  for (const { platform, markers } of DETECTION_MARKERS) {
    for (const marker of markers) {
      if (await exists(join(projectDir, marker))) {
        candidates.push(platform);
        break;
      }
    }
  }

  const detected = candidates.length === 1 ? (candidates[0] ?? null) : null;
  return { detected, candidates };
}
