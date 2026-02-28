import { readdir } from "node:fs/promises";
import { relative } from "node:path";
import { findArtifactsDir } from "./artifacts.js";

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

interface ArtifactRule {
  pattern: RegExp;
  phase: number;
  name: string;
  required: boolean;
}

const ARTIFACT_RULES: ArtifactRule[] = [
  { pattern: /brief/i, phase: 1, name: "Product Brief", required: false },
  { pattern: /market/i, phase: 1, name: "Market Research", required: false },
  { pattern: /domain/i, phase: 1, name: "Domain Research", required: false },
  { pattern: /tech.*research/i, phase: 1, name: "Technical Research", required: false },
  { pattern: /prd/i, phase: 2, name: "PRD", required: true },
  { pattern: /ux/i, phase: 2, name: "UX Design", required: false },
  { pattern: /architect/i, phase: 3, name: "Architecture", required: true },
  { pattern: /epic|stor/i, phase: 3, name: "Epics & Stories", required: true },
  { pattern: /readiness/i, phase: 3, name: "Readiness Report", required: true },
];

export function classifyArtifact(filename: string): ArtifactClassification | null {
  for (const rule of ARTIFACT_RULES) {
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

  for (const rule of ARTIFACT_RULES) {
    if (rule.required && !foundNames.has(rule.name)) {
      missing.push(rule.name);
    }
  }

  return missing;
}

export function suggestNext(phases: PhaseArtifacts, detectedPhase: number): string {
  const foundNames = new Set([...phases[1], ...phases[2], ...phases[3]].map((a) => a.name));

  if (detectedPhase <= 1 && phases[1].length === 0) {
    return "Run /analyst to start analysis";
  }

  if (!foundNames.has("PRD")) {
    return "Run /create-prd to create the PRD";
  }

  if (!foundNames.has("Architecture")) {
    return "Run /architect to create architecture";
  }

  if (!foundNames.has("Epics & Stories")) {
    return "Run /create-epics-stories to define epics and stories";
  }

  if (!foundNames.has("Readiness Report")) {
    return "Run /architect to generate readiness report";
  }

  return "Run: bmalph implement";
}

export async function scanProjectArtifacts(
  projectDir: string
): Promise<ProjectArtifactScan | null> {
  const artifactsDir = await findArtifactsDir(projectDir);
  if (!artifactsDir) {
    return null;
  }

  const files = await readdir(artifactsDir);
  const phases = scanArtifacts(files);
  const detectedPhase = detectPhase(phases);
  const missing = getMissing(phases);
  const nextAction = suggestNext(phases, detectedPhase);
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
