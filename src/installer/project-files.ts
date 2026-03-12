import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  atomicWriteFile,
  exists,
  parseGitignoreLines,
  replaceSection,
} from "../utils/file-system.js";
import { isEnoent } from "../utils/errors.js";
import { CONFIG_FILE, SKILLS_DIR, STATE_DIR } from "../utils/constants.js";
import type { Platform } from "../platform/types.js";
import { getDefaultPlatform } from "./metadata.js";
import { isTemplateCustomized } from "./template-files.js";
import type { PreviewInstallResult, PreviewUpgradeResult } from "./types.js";

export async function updateGitignore(projectDir: string): Promise<void> {
  const gitignorePath = join(projectDir, ".gitignore");
  let existing = "";

  try {
    existing = await readFile(gitignorePath, "utf-8");
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  const existingLines = parseGitignoreLines(existing);

  const entries = [".ralph/logs/", "_bmad-output/"];
  const newEntries = entries.filter((e) => !existingLines.has(e));

  if (newEntries.length === 0) return;

  const suffix =
    existing.length > 0 && !existing.endsWith("\n")
      ? "\n" + newEntries.join("\n") + "\n"
      : newEntries.join("\n") + "\n";

  await atomicWriteFile(gitignorePath, existing + suffix);
}

/**
 * Merge the BMAD instructions snippet into the platform's instructions file.
 * Creates the file if it doesn't exist, replaces an existing BMAD section on upgrade.
 */
export async function mergeInstructionsFile(
  projectDir: string,
  platform?: Platform
): Promise<void> {
  const p = platform ?? (await getDefaultPlatform());
  const instructionsPath = join(projectDir, p.instructionsFile);
  const snippet = p.generateInstructionsSnippet();
  const marker = p.instructionsSectionMarker;

  // Ensure parent directory exists for nested paths (e.g. .cursor/rules/)
  await mkdir(dirname(instructionsPath), { recursive: true });

  let existing = "";
  try {
    existing = await readFile(instructionsPath, "utf-8");
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  if (existing.includes(marker)) {
    await atomicWriteFile(instructionsPath, replaceSection(existing, marker, "\n" + snippet));
    return;
  }

  await atomicWriteFile(instructionsPath, existing + snippet);
}

export async function isInitialized(projectDir: string): Promise<boolean> {
  return exists(join(projectDir, CONFIG_FILE));
}

export async function previewInstall(
  projectDir: string,
  platform?: Platform
): Promise<PreviewInstallResult> {
  const p = platform ?? (await getDefaultPlatform());
  const wouldCreate: string[] = [];
  const wouldModify: string[] = [];
  const wouldSkip: string[] = [];

  // Directories that would be created
  const dirsToCreate = [
    `${STATE_DIR}/`,
    ".ralph/specs/",
    ".ralph/logs/",
    ".ralph/docs/generated/",
    "_bmad/",
  ];

  if (p.commandDelivery.kind === "directory") {
    dirsToCreate.push(`${p.commandDelivery.dir}/`);
  } else if (p.commandDelivery.kind === "skills") {
    dirsToCreate.push(`${SKILLS_DIR}/`);
  }

  for (const dir of dirsToCreate) {
    if (await exists(join(projectDir, dir))) {
      if (
        dir === "_bmad/" ||
        (p.commandDelivery.kind === "directory" && dir === `${p.commandDelivery.dir}/`) ||
        (p.commandDelivery.kind === "skills" && dir === `${SKILLS_DIR}/`)
      ) {
        wouldModify.push(dir);
      }
    } else {
      wouldCreate.push(dir);
    }
  }

  const filesToCheck = [
    { path: ".ralph/PROMPT.md", isTemplate: true },
    { path: ".ralph/@AGENT.md", isTemplate: true },
    { path: ".ralph/ralph_loop.sh", isTemplate: false },
    { path: CONFIG_FILE, isTemplate: false },
  ];

  for (const file of filesToCheck) {
    if (await exists(join(projectDir, file.path))) {
      if (file.isTemplate) {
        wouldModify.push(file.path);
      }
    } else {
      wouldCreate.push(file.path);
    }
  }

  if (await exists(join(projectDir, ".gitignore"))) {
    wouldModify.push(".gitignore");
  } else {
    wouldCreate.push(".gitignore");
  }

  try {
    const content = await readFile(join(projectDir, p.instructionsFile), "utf-8");
    if (content.includes(p.instructionsSectionMarker)) {
      wouldSkip.push(`${p.instructionsFile} (already integrated)`);
    } else {
      wouldModify.push(p.instructionsFile);
    }
  } catch (err) {
    if (isEnoent(err)) {
      wouldCreate.push(p.instructionsFile);
    } else {
      throw err;
    }
  }

  return { wouldCreate, wouldModify, wouldSkip };
}

export async function previewUpgrade(
  projectDir: string,
  platform?: Platform
): Promise<PreviewUpgradeResult> {
  const p = platform ?? (await getDefaultPlatform());
  const managedPaths: Array<{ path: string; isDir: boolean; templateName?: string }> = [
    { path: "_bmad/", isDir: true },
    { path: ".ralph/ralph_loop.sh", isDir: false },
    { path: ".ralph/ralph_import.sh", isDir: false },
    { path: ".ralph/ralph_monitor.sh", isDir: false },
    { path: ".ralph/lib/", isDir: true },
    { path: ".ralph/PROMPT.md", isDir: false, templateName: "PROMPT.md" },
    { path: ".ralph/@AGENT.md", isDir: false, templateName: "AGENT.md" },
    { path: ".ralph/RALPH-REFERENCE.md", isDir: false },
    { path: ".gitignore", isDir: false },
  ];

  if (p.commandDelivery.kind === "directory") {
    managedPaths.push({ path: `${p.commandDelivery.dir}/`, isDir: true });
  } else if (p.commandDelivery.kind === "skills") {
    managedPaths.push({ path: `${SKILLS_DIR}/`, isDir: true });
  }

  const wouldUpdate: string[] = [];
  const wouldCreate: string[] = [];
  const wouldPreserve: string[] = [];

  for (const { path: pathStr, templateName } of managedPaths) {
    const fullPath = join(projectDir, pathStr.replace(/\/$/, ""));
    if (await exists(fullPath)) {
      if (templateName && (await isTemplateCustomized(fullPath, templateName))) {
        wouldPreserve.push(pathStr);
      } else {
        wouldUpdate.push(pathStr);
      }
    } else {
      wouldCreate.push(pathStr);
    }
  }

  return { wouldUpdate, wouldCreate, wouldPreserve };
}
