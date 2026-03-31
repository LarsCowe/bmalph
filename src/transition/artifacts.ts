import { join, relative, resolve, sep } from "node:path";
import { debug, warn } from "../utils/logger.js";
import { isDirectory } from "../utils/file-system.js";
import { readBmadConfig } from "../utils/config.js";

export async function findArtifactsDir(projectDir: string): Promise<string | null> {
  const bmadConfig = await readBmadConfig(projectDir);
  const trimmed = bmadConfig?.planning_artifacts?.trim();
  if (trimmed) {
    const resolved = resolve(projectDir, trimmed);
    debug(`Checking config-specified artifacts dir: ${resolved}`);

    const projectRoot = resolve(projectDir);
    if (!resolved.startsWith(projectRoot + sep) && resolved !== projectRoot) {
      warn(`planning_artifacts path escapes project directory, ignoring: ${trimmed}`);
    } else if (await isDirectory(resolved)) {
      debug(`Found artifacts at: ${resolved}`);
      return resolved;
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
    if (await isDirectory(fullPath)) {
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
