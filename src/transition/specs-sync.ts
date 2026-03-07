import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { exists } from "../utils/file-system.js";
import { resolvePlanningSpecsSubpath } from "./artifacts.js";

export async function prepareSpecsDirectory(
  projectDir: string,
  artifactsDir: string,
  artifactFiles: readonly string[],
  specsTmpDir: string
): Promise<void> {
  const bmadOutputDir = join(projectDir, "_bmad-output");
  const bmadOutputExists = await exists(bmadOutputDir);
  const planningSpecsSubpath = resolvePlanningSpecsSubpath(projectDir, artifactsDir);

  await rm(specsTmpDir, { recursive: true, force: true });
  await mkdir(specsTmpDir, { recursive: true });

  if (bmadOutputExists) {
    await cp(bmadOutputDir, specsTmpDir, { recursive: true, dereference: false });
  }

  for (const file of artifactFiles) {
    const destinationPath = join(specsTmpDir, planningSpecsSubpath, file);
    await mkdir(dirname(destinationPath), { recursive: true });
    await cp(join(artifactsDir, file), destinationPath, {
      dereference: false,
    });
  }

  await access(specsTmpDir);
}
