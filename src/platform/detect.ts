import type { PlatformId } from "./types.js";
import { exists } from "../utils/file-system.js";
import { join } from "node:path";

interface DetectionResult {
  detected: PlatformId | null;
  candidates: PlatformId[];
}

const STRONG_DETECTION_MARKERS: Array<{ platform: PlatformId; markers: string[] }> = [
  { platform: "claude-code", markers: [".claude"] },
  { platform: "opencode", markers: [".opencode"] },
  { platform: "cursor", markers: [".cursor"] },
  { platform: "windsurf", markers: [".windsurf"] },
  { platform: "copilot", markers: [".github/copilot-instructions.md"] },
  { platform: "aider", markers: [".aider.conf.yml"] },
  { platform: "antigravity", markers: [".agents"] },
];

const ROOT_INSTRUCTION_MARKERS: Array<{ marker: string; candidates: PlatformId[] }> = [
  { marker: "AGENTS.md", candidates: ["codex", "opencode", "cursor", "antigravity"] },
  { marker: "CLAUDE.md", candidates: ["claude-code", "cursor"] },
];

export async function detectPlatform(projectDir: string): Promise<DetectionResult> {
  const strongCandidates: PlatformId[] = [];
  const weakCandidates: PlatformId[] = [];

  for (const { platform, markers } of STRONG_DETECTION_MARKERS) {
    for (const marker of markers) {
      if (await exists(join(projectDir, marker))) {
        strongCandidates.push(platform);
        break;
      }
    }
  }

  const strongExclusivePlatforms: PlatformId[] = ["cursor", "opencode"];
  for (const platform of strongExclusivePlatforms) {
    if (strongCandidates.includes(platform) && strongCandidates.length === 1) {
      return { detected: platform, candidates: [platform] };
    }
  }

  for (const { marker, candidates: inferred } of ROOT_INSTRUCTION_MARKERS) {
    if (!(await exists(join(projectDir, marker)))) {
      continue;
    }

    for (const candidate of inferred) {
      if (!weakCandidates.includes(candidate)) {
        weakCandidates.push(candidate);
      }
    }
  }

  const candidates = [...strongCandidates];
  for (const candidate of weakCandidates) {
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  const detected = candidates.length === 1 ? (candidates[0] ?? null) : null;
  return { detected, candidates };
}
