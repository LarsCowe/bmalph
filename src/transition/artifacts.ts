import { readFile, access } from "fs/promises";
import { join } from "path";
import { debug } from "../utils/logger.js";

export async function findArtifactsDir(projectDir: string): Promise<string | null> {
  const candidates = [
    "_bmad-output/planning-artifacts",
    "_bmad-output/planning_artifacts",
    "docs/planning",
  ];

  for (const candidate of candidates) {
    const fullPath = join(projectDir, candidate);
    debug(`Checking artifacts dir: ${fullPath}`);
    try {
      await access(fullPath);
      debug(`Found artifacts at: ${fullPath}`);
      return fullPath;
    } catch {
      continue;
    }
  }
  debug(`No artifacts found. Checked: ${candidates.join(", ")}`);
  return null;
}

export async function validateArtifacts(files: string[], artifactsDir: string): Promise<string[]> {
  const warnings: string[] = [];

  const hasPrd = files.some((f) => /prd/i.test(f));
  if (!hasPrd) {
    warnings.push("No PRD document found in planning artifacts");
  }

  const hasArchitecture = files.some((f) => /architect/i.test(f));
  if (!hasArchitecture) {
    warnings.push("No architecture document found in planning artifacts");
  }

  // Check readiness report for NO-GO
  const readinessFile = files.find((f) => /readiness/i.test(f));
  if (readinessFile) {
    try {
      const content = await readFile(join(artifactsDir, readinessFile), "utf-8");
      if (/NO[-\s]?GO/i.test(content)) {
        warnings.push("Readiness report indicates NO-GO status");
      }
    } catch {
      // Cannot read readiness file, skip
    }
  }

  return warnings;
}
