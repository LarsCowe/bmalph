import { join, relative } from "node:path";
import { debug } from "../utils/logger.js";
import { exists } from "../utils/file-system.js";
import { readBmadConfig } from "../utils/config.js";

export async function findArtifactsDir(projectDir: string): Promise<string | null> {
  const bmadConfig = await readBmadConfig(projectDir);
  if (bmadConfig?.planning_artifacts) {
    const fullPath = join(projectDir, bmadConfig.planning_artifacts.trim());
    debug(`Checking config-specified artifacts dir: ${fullPath}`);
    if (await exists(fullPath)) {
      debug(`Found artifacts at: ${fullPath}`);
      return fullPath;
    }
  }

  const candidates = [
    "_bmad-output/planning-artifacts",
    "_bmad-output/planning_artifacts",
    "docs/planning",
  ];

  for (const candidate of candidates) {
    const fullPath = join(projectDir, candidate);
    debug(`Checking artifacts dir: ${fullPath}`);
    if (await exists(fullPath)) {
      debug(`Found artifacts at: ${fullPath}`);
      return fullPath;
    }
  }
  debug(`No artifacts found. Checked: ${candidates.join(", ")}`);
  return null;
}

export function resolvePlanningSpecsSubpath(projectDir: string, artifactsDir: string): string {
  const bmadOutputDir = join(projectDir, "_bmad-output");
  const relativePath = relative(bmadOutputDir, artifactsDir).replace(/\\/g, "/");

  if (!relativePath || relativePath === "." || relativePath === "..") {
    return "";
  }

  if (relativePath.startsWith("../")) {
    return "";
  }

  return relativePath;
}
