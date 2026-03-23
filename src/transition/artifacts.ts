import { join, relative } from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { debug } from "../utils/logger.js";
import { exists } from "../utils/file-system.js";
import { isEnoent } from "../utils/errors.js";

interface BmadConfig {
  planning_artifacts?: string;
}

async function getPlanningArtifactsFromConfig(projectDir: string): Promise<string | null> {
  const configPath = join(projectDir, "_bmad/config.yaml");
  try {
    const content = await readFile(configPath, "utf-8");
    const config = parse(content) as BmadConfig;
    if (config.planning_artifacts) {
      const path = config.planning_artifacts.trim();
      debug(`Found planning_artifacts in config: ${path}`);
      return path;
    }
  } catch (err) {
    if (!isEnoent(err)) {
      debug(`Error reading _bmad/config.yaml: ${String(err)}`);
    }
  }
  return null;
}

export async function findArtifactsDir(projectDir: string): Promise<string | null> {
  const configPath = await getPlanningArtifactsFromConfig(projectDir);
  if (configPath) {
    const fullPath = join(projectDir, configPath);
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
