import { join } from "node:path";
import { debug } from "../utils/logger.js";
import { exists } from "../utils/file-system.js";

export async function findArtifactsDir(projectDir: string): Promise<string | null> {
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
