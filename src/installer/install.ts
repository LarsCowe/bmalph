import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../utils/file-system.js";
import { STATE_DIR } from "../utils/constants.js";
import type { Platform } from "../platform/types.js";
import { deliverCommands, generateSkills } from "./commands.js";
import { installBmadAssets } from "./bmad-assets.js";
import {
  getBundledBmadDir,
  getBundledRalphDir,
  getDefaultPlatform,
  getPackageVersion,
  getSlashCommandsDir,
} from "./metadata.js";
import { updateGitignore } from "./project-files.js";
import { installRalphAssets } from "./ralph-assets.js";
import type { UpgradeResult } from "./types.js";

export async function copyBundledAssets(
  projectDir: string,
  platform?: Platform
): Promise<UpgradeResult> {
  const p = platform ?? (await getDefaultPlatform());
  const bmadDir = getBundledBmadDir();
  const ralphDir = getBundledRalphDir();
  const slashCommandsDir = getSlashCommandsDir();

  if (!(await exists(bmadDir))) {
    throw new Error(`BMAD source directory not found at ${bmadDir}. Package may be corrupted.`);
  }
  if (!(await exists(ralphDir))) {
    throw new Error(`Ralph source directory not found at ${ralphDir}. Package may be corrupted.`);
  }
  if (!(await exists(slashCommandsDir))) {
    throw new Error(
      `Slash commands directory not found at ${slashCommandsDir}. Package may be corrupted.`
    );
  }

  const classified = await installBmadAssets(projectDir, bmadDir, slashCommandsDir, p);

  if (p.commandDelivery.kind === "skills") {
    await generateSkills(projectDir, classified);
  }

  const ralphAssets = await installRalphAssets(projectDir, ralphDir, p, await getPackageVersion());
  const commandPaths = await deliverCommands(projectDir, p, slashCommandsDir);

  await updateGitignore(projectDir);

  return {
    updatedPaths: ["_bmad/", ...ralphAssets.updatedPaths, ...commandPaths, ".gitignore"],
  };
}

export async function installProject(projectDir: string, platform?: Platform): Promise<void> {
  await mkdir(join(projectDir, STATE_DIR), { recursive: true });
  await mkdir(join(projectDir, ".ralph/specs"), { recursive: true });
  await mkdir(join(projectDir, ".ralph/logs"), { recursive: true });
  await mkdir(join(projectDir, ".ralph/docs/generated"), { recursive: true });

  await copyBundledAssets(projectDir, platform);
}
