import { cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { debug, warn } from "../utils/logger.js";
import { atomicWriteFile, exists } from "../utils/file-system.js";
import { formatError, isEnoent } from "../utils/errors.js";
import { CONFIG_FILE, BMAD_CONFIG_FILE } from "../utils/constants.js";
import type { Platform } from "../platform/types.js";
import { classifyCommands, generateCommandIndex } from "./commands.js";
import type { ClassifiedCommand } from "./types.js";

interface BmadSwapContext {
  dest: string;
  backup: string;
  staged: string;
  hasBackup: boolean;
}

export async function installBmadAssets(
  projectDir: string,
  bundledBmadDir: string,
  slashCommandsDir: string,
  platform: Platform
): Promise<ClassifiedCommand[]> {
  const bmadSwap = await prepareBmadSwap(projectDir, bundledBmadDir);

  // Swap in.
  try {
    await rename(bmadSwap.staged, bmadSwap.dest);
  } catch (err) {
    // Restore original on failure.
    debug(`Rename failed, restoring original: ${formatError(err)}`);
    try {
      await rename(bmadSwap.backup, bmadSwap.dest);
    } catch (restoreErr) {
      if (!isEnoent(restoreErr)) {
        debug(`Could not restore _bmad.old: ${formatError(restoreErr)}`);
      }
    }
    throw err;
  }

  const classified = await (async (): Promise<ClassifiedCommand[]> => {
    try {
      return await finalizeBmadInstall(projectDir, slashCommandsDir, platform);
    } catch (err) {
      return await rollbackBmadFinalization(bmadSwap, err);
    }
  })();

  await commitBmadSwap(bmadSwap);

  return classified;
}

export async function generateManifests(projectDir: string): Promise<void> {
  const configDir = join(projectDir, "_bmad/_config");
  await mkdir(configDir, { recursive: true });

  const coreHelpPath = join(projectDir, "_bmad/core/module-help.csv");
  const bmmHelpPath = join(projectDir, "_bmad/bmm/module-help.csv");

  // Validate CSV files exist before reading
  if (!(await exists(coreHelpPath))) {
    throw new Error(
      `Core module-help.csv not found at ${coreHelpPath}. BMAD installation may be incomplete.`
    );
  }
  if (!(await exists(bmmHelpPath))) {
    throw new Error(
      `BMM module-help.csv not found at ${bmmHelpPath}. BMAD installation may be incomplete.`
    );
  }

  const coreContent = await readFile(coreHelpPath, "utf-8");
  const bmmContent = await readFile(bmmHelpPath, "utf-8");

  // Extract header from core (first line) and data lines from both
  const coreLines = coreContent.trimEnd().split(/\r?\n/);
  const bmmLines = bmmContent.trimEnd().split(/\r?\n/);

  if (!coreLines[0]?.trim()) {
    throw new Error(`Core module-help.csv is empty at ${coreHelpPath}`);
  }
  if (!bmmLines[0]?.trim()) {
    throw new Error(`BMM module-help.csv is empty at ${bmmHelpPath}`);
  }

  const normalize = (line: string): string => line.replace(/,+$/, "");

  const header = normalize(coreLines[0]);
  const bmmHeader = normalize(bmmLines[0]);

  // Validate headers match (warn if mismatch but continue)
  if (header && bmmHeader && header !== bmmHeader) {
    warn(`CSV header mismatch detected. BMAD modules may have incompatible formats.`);
    debug(
      `CSV header mismatch details - core: "${header.slice(0, 50)}...", bmm: "${bmmHeader.slice(0, 50)}..."`
    );
  }

  const coreData = coreLines
    .slice(1)
    .filter((l) => l.trim())
    .map(normalize);
  const bmmData = bmmLines
    .slice(1)
    .filter((l) => l.trim())
    .map(normalize);

  const combined = [header, ...coreData, ...bmmData].join("\n") + "\n";

  await atomicWriteFile(join(configDir, "task-manifest.csv"), combined);
  await atomicWriteFile(join(configDir, "workflow-manifest.csv"), combined);
  await atomicWriteFile(join(configDir, "bmad-help.csv"), combined);
}

async function prepareBmadSwap(
  projectDir: string,
  bundledBmadDir: string
): Promise<BmadSwapContext> {
  const dest = join(projectDir, "_bmad");
  const backup = join(projectDir, "_bmad.old");
  const staged = join(projectDir, "_bmad.new");
  const destExists = await exists(dest);
  const backupExists = await exists(backup);
  let hasBackup = false;

  if (destExists && backupExists) {
    throw new Error(
      "Found both _bmad and _bmad.old from a previous failed install or upgrade. " +
        "Restore or remove one of them before retrying."
    );
  }

  if (backupExists) {
    hasBackup = true;
    debug("Found existing _bmad.old from previous failed rollback, preserving backup");
  } else if (destExists) {
    try {
      await rename(dest, backup);
      hasBackup = true;
    } catch (err) {
      if (!isEnoent(err)) throw err;
      debug("_bmad disappeared before it could be preserved, continuing without backup");
    }
  } else {
    debug("No existing _bmad to preserve (first install)");
  }

  // Stage new content.
  await rm(staged, { recursive: true, force: true });
  await cp(bundledBmadDir, staged, { recursive: true, dereference: false });

  return { dest, backup, staged, hasBackup };
}

async function finalizeBmadInstall(
  projectDir: string,
  slashCommandsDir: string,
  platform: Platform
): Promise<ClassifiedCommand[]> {
  await generateManifests(projectDir);

  const classified = await classifyCommands(projectDir, slashCommandsDir);
  await generateCommandIndex(projectDir, classified);

  const projectName = await deriveProjectName(projectDir);
  const escapedName = projectName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  await atomicWriteFile(
    join(projectDir, BMAD_CONFIG_FILE),
    `# BMAD Configuration - Generated by bmalph
platform: ${platform.id}
project_name: "${escapedName}"
output_folder: _bmad-output
user_name: BMad
communication_language: English
document_output_language: English
user_skill_level: intermediate
planning_artifacts: _bmad-output/planning-artifacts
implementation_artifacts: _bmad-output/implementation-artifacts
project_knowledge: docs
modules:
  - bmm
`
  );

  return classified;
}

async function rollbackBmadFinalization(swap: BmadSwapContext, error: unknown): Promise<never> {
  debug(`BMAD finalization failed after swap: ${formatError(error)}`);

  try {
    await rm(swap.dest, { recursive: true, force: true });

    if (swap.hasBackup) {
      await rename(swap.backup, swap.dest);
    }
  } catch (rollbackErr) {
    throw new Error(
      "BMAD finalization failed after swap and rollback also failed. " +
        `Original error: ${formatError(error)}. ` +
        `Rollback error: ${formatError(rollbackErr)}`,
      {
        cause: rollbackErr,
      }
    );
  }

  if (swap.hasBackup) {
    throw new Error(
      "BMAD finalization failed after swap; previous BMAD installation was restored.",
      {
        cause: error,
      }
    );
  }

  throw new Error(
    "BMAD finalization failed after swap; incomplete BMAD installation was cleaned up.",
    {
      cause: error,
    }
  );
}

async function commitBmadSwap(swap: BmadSwapContext): Promise<void> {
  if (!swap.hasBackup) return;
  await rm(swap.backup, { recursive: true, force: true });
}

async function deriveProjectName(projectDir: string): Promise<string> {
  try {
    const configPath = join(projectDir, CONFIG_FILE);
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw) as { name?: string };
    if (config.name) return config.name;
  } catch (err) {
    if (!isEnoent(err)) {
      warn(`Could not read ${CONFIG_FILE}: ${formatError(err)}`);
    }
  }
  return basename(projectDir);
}
