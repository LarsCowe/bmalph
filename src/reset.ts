import { readdir, readFile, rm } from "node:fs/promises";
import { join, posix } from "node:path";
import { getSlashCommandsDir } from "./installer.js";
import {
  exists,
  atomicWriteFile,
  parseGitignoreLines,
  replaceSection,
} from "./utils/file-system.js";
import { isEnoent } from "./utils/errors.js";
import {
  BMAD_DIR,
  RALPH_DIR,
  BMALPH_DIR,
  BMAD_OUTPUT_DIR,
  GITIGNORE_ENTRIES,
  SKILLS_PREFIX,
} from "./utils/constants.js";
import type { Platform } from "./platform/types.js";
import type { DryRunAction } from "./utils/dryrun.js";

export interface ResetPlan {
  directories: string[];
  commandFiles: string[];
  instructionsCleanup: {
    path: string;
    sectionsToRemove: string[];
  } | null;
  gitignoreLines: string[];
  warnings: Array<{ path: string; message: string }>;
}

export async function buildResetPlan(projectDir: string, platform: Platform): Promise<ResetPlan> {
  const plan: ResetPlan = {
    directories: [],
    commandFiles: [],
    instructionsCleanup: null,
    gitignoreLines: [],
    warnings: [],
  };

  // Check which managed directories exist
  for (const dir of [BMAD_DIR, RALPH_DIR, BMALPH_DIR]) {
    if (await exists(join(projectDir, dir))) {
      plan.directories.push(dir);
    }
  }

  // Check for slash commands to remove (directory delivery only)
  if (platform.commandDelivery.kind === "directory") {
    const commandsDir = join(projectDir, platform.commandDelivery.dir);
    if (await exists(commandsDir)) {
      const bundledNames = await getBundledCommandNames();
      try {
        const existingFiles = await readdir(commandsDir);
        for (const file of existingFiles) {
          if (file.endsWith(".md") && bundledNames.has(file)) {
            plan.commandFiles.push(posix.join(platform.commandDelivery.dir, file));
          }
        }
      } catch (err) {
        if (!isEnoent(err)) throw err;
      }
    }
  }

  // Check for skills to remove (skills delivery only)
  if (platform.commandDelivery.kind === "skills") {
    try {
      const existingDirs = await readdir(join(projectDir, platform.commandDelivery.dir));
      for (const dir of existingDirs) {
        if (dir.startsWith(SKILLS_PREFIX)) {
          plan.commandFiles.push(posix.join(platform.commandDelivery.dir, dir));
        }
      }
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }
  }

  // Check instructions file for BMAD sections
  try {
    const content = await readFile(join(projectDir, platform.instructionsFile), "utf-8");
    const sectionsToRemove: string[] = [];

    if (content.includes(platform.instructionsSectionMarker)) {
      sectionsToRemove.push(platform.instructionsSectionMarker);
    }

    if (sectionsToRemove.length > 0) {
      plan.instructionsCleanup = {
        path: platform.instructionsFile,
        sectionsToRemove,
      };
    }
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  // Check .gitignore for bmalph entries
  try {
    const content = await readFile(join(projectDir, ".gitignore"), "utf-8");
    const existingLines = parseGitignoreLines(content);
    for (const entry of GITIGNORE_ENTRIES) {
      if (existingLines.has(entry)) {
        plan.gitignoreLines.push(entry);
      }
    }
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  // Warn about _bmad-output/
  if (await exists(join(projectDir, BMAD_OUTPUT_DIR))) {
    plan.warnings.push({
      path: `${BMAD_OUTPUT_DIR}/`,
      message: "Contains user planning artifacts — not removed by reset",
    });
  }

  return plan;
}

async function getBundledCommandNames(): Promise<Set<string>> {
  const slashCommandsDir = getSlashCommandsDir();
  try {
    const files = await readdir(slashCommandsDir);
    return new Set(files.filter((f) => f.endsWith(".md")));
  } catch (err) {
    if (!isEnoent(err)) throw err;
    return new Set();
  }
}

export async function executeResetPlan(projectDir: string, plan: ResetPlan): Promise<void> {
  // Delete managed directories
  for (const dir of plan.directories) {
    await rm(join(projectDir, dir), { recursive: true, force: true });
  }

  // Delete slash command files and skill directories
  for (const file of plan.commandFiles) {
    await rm(join(projectDir, file), { recursive: true, force: true });
  }

  // Clean instructions file
  if (plan.instructionsCleanup) {
    const filePath = join(projectDir, plan.instructionsCleanup.path);
    try {
      let content = await readFile(filePath, "utf-8");

      for (const marker of plan.instructionsCleanup.sectionsToRemove) {
        content = replaceSection(content, marker, "");
      }

      content = content.trim();

      if (content.length === 0) {
        await rm(filePath, { force: true });
      } else {
        await atomicWriteFile(filePath, content + "\n");
      }
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }
  }

  // Clean .gitignore
  if (plan.gitignoreLines.length > 0) {
    const filePath = join(projectDir, ".gitignore");
    try {
      const content = await readFile(filePath, "utf-8");
      const cleaned = removeGitignoreLines(content, plan.gitignoreLines);
      await atomicWriteFile(filePath, cleaned);
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }
  }
}

export function removeGitignoreLines(content: string, linesToRemove: string[]): string {
  const removeSet = new Set(linesToRemove);
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter((line) => !removeSet.has(line.trim()));
  return filtered.join(eol);
}

export function planToDryRunActions(plan: ResetPlan): DryRunAction[] {
  const actions: DryRunAction[] = [];

  for (const dir of plan.directories) {
    actions.push({ type: "delete", path: `${dir}/` });
  }

  for (const file of plan.commandFiles) {
    actions.push({ type: "delete", path: file });
  }

  if (plan.instructionsCleanup) {
    actions.push({ type: "modify", path: plan.instructionsCleanup.path });
  }

  if (plan.gitignoreLines.length > 0) {
    actions.push({ type: "modify", path: ".gitignore" });
  }

  for (const warning of plan.warnings) {
    actions.push({ type: "warn", path: warning.path, reason: warning.message });
  }

  return actions;
}
