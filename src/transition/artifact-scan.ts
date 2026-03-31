import { readdir } from "node:fs/promises";
import { relative } from "node:path";
import { findArtifactsDir } from "./artifacts.js";
import { ARTIFACT_DEFINITIONS } from "../utils/artifact-definitions.js";
import { getPlatform } from "../platform/registry.js";
import {
  getPlatformAnalysisHint,
  getPlatformArchitectureHint,
  getPlatformEpicsStoriesHint,
  getPlatformMasterAgentHint,
  getPlatformPrdHint,
  getPlatformReadinessHint,
} from "../platform/guidance.js";
import type { PlatformId } from "../platform/types.js";

export interface ArtifactClassification {
  phase: number;
  name: string;
  required: boolean;
}

export interface ScannedArtifact extends ArtifactClassification {
  filename: string;
}

export interface PhaseArtifacts {
  1: ScannedArtifact[];
  2: ScannedArtifact[];
  3: ScannedArtifact[];
}

export interface ProjectArtifactScan {
  directory: string;
  found: string[];
  detectedPhase: number;
  missing: string[];
  phases: PhaseArtifacts;
  nextAction: string;
}

export function classifyArtifact(filename: string): ArtifactClassification | null {
  for (const rule of ARTIFACT_DEFINITIONS) {
    if (rule.pattern.test(filename)) {
      return { phase: rule.phase, name: rule.name, required: rule.required };
    }
  }
  return null;
}

export function scanArtifacts(files: string[]): PhaseArtifacts {
  const phases: PhaseArtifacts = { 1: [], 2: [], 3: [] };

  for (const file of files) {
    const classification = classifyArtifact(file);
    if (classification) {
      const phaseKey = classification.phase as 1 | 2 | 3;
      phases[phaseKey].push({ ...classification, filename: file });
    }
  }

  return phases;
}

export function detectPhase(phases: PhaseArtifacts): number {
  for (const phase of [3, 2, 1] as const) {
    if (phases[phase].length > 0) {
      return phase;
    }
  }
  return 1;
}

export function getMissing(phases: PhaseArtifacts): string[] {
  const missing: string[] = [];
  const foundNames = new Set([...phases[1], ...phases[2], ...phases[3]].map((a) => a.name));

  for (const rule of ARTIFACT_DEFINITIONS) {
    if (rule.required && !foundNames.has(rule.name)) {
      missing.push(rule.name);
    }
  }

  return missing;
}

export function suggestNext(
  phases: PhaseArtifacts,
  detectedPhase: number,
  platformId?: PlatformId
): string {
  const foundNames = new Set([...phases[1], ...phases[2], ...phases[3]].map((a) => a.name));
  const platform = platformId ? getPlatform(platformId) : null;

  if (platform && platform.commandDelivery.kind === "index") {
    const allPlanningArtifactsPresent =
      foundNames.has("PRD") &&
      foundNames.has("Architecture") &&
      foundNames.has("Epics & Stories") &&
      foundNames.has("Readiness Report");

    if (!allPlanningArtifactsPresent) {
      return getPlatformMasterAgentHint(platform);
    }
  }

  if (detectedPhase <= 1 && phases[1].length === 0) {
    return platform ? getPlatformAnalysisHint(platform) : "Run /analyst to start analysis";
  }

  if (!foundNames.has("PRD")) {
    return platform ? getPlatformPrdHint(platform) : "Run /create-prd to create the PRD";
  }

  if (!foundNames.has("Architecture")) {
    return platform
      ? getPlatformArchitectureHint(platform)
      : "Run /architect to create architecture";
  }

  if (!foundNames.has("Epics & Stories")) {
    return platform
      ? getPlatformEpicsStoriesHint(platform)
      : "Run /create-epics-stories to define epics and stories";
  }

  if (!foundNames.has("Readiness Report")) {
    return platform
      ? getPlatformReadinessHint(platform)
      : "Run /implementation-readiness to generate readiness report";
  }

  return "Run: bmalph implement";
}

export async function scanProjectArtifacts(
  projectDir: string,
  platformId?: PlatformId
): Promise<ProjectArtifactScan | null> {
  const artifactsDir = await findArtifactsDir(projectDir);
  if (!artifactsDir) {
    return null;
  }

  const files = await readdir(artifactsDir);
  const phases = scanArtifacts(files);
  const detectedPhase = detectPhase(phases);
  const missing = getMissing(phases);
  const nextAction = suggestNext(phases, detectedPhase, platformId);
  const relativeDir = relative(projectDir, artifactsDir).replace(/\\/g, "/");

  const found = files.filter((f) => classifyArtifact(f) !== null);

  return {
    directory: relativeDir,
    found,
    detectedPhase,
    missing,
    phases,
    nextAction,
  };
}
