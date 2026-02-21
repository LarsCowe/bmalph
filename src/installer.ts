import { cp, mkdir, readFile, readdir, rm, chmod, rename } from "fs/promises";
import { readFileSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { debug, warn } from "./utils/logger.js";
import { formatError, isEnoent } from "./utils/errors.js";
import { exists, atomicWriteFile } from "./utils/file-system.js";
import { STATE_DIR, CONFIG_FILE } from "./utils/constants.js";
import type { Platform } from "./platform/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getPackageVersion(): string {
  const pkgPath = join(__dirname, "..", "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export interface BundledVersions {
  bmadCommit: string;
}

export function getBundledVersions(): BundledVersions {
  const versionsPath = join(__dirname, "..", "bundled-versions.json");
  try {
    const versions = JSON.parse(readFileSync(versionsPath, "utf-8"));
    if (!versions || typeof versions.bmadCommit !== "string") {
      throw new Error("Invalid bundled-versions.json structure: missing bmadCommit");
    }
    return {
      bmadCommit: versions.bmadCommit,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid bundled-versions.json")) {
      throw err;
    }
    throw new Error(`Failed to read bundled-versions.json at ${versionsPath}`, { cause: err });
  }
}

export function getBundledBmadDir(): string {
  return join(__dirname, "..", "bmad");
}

export function getBundledRalphDir(): string {
  return join(__dirname, "..", "ralph");
}

export function getSlashCommandsDir(): string {
  return join(__dirname, "..", "slash-commands");
}

export interface UpgradeResult {
  updatedPaths: string[];
}

export interface PreviewInstallResult {
  wouldCreate: string[];
  wouldModify: string[];
  wouldSkip: string[];
}

export interface PreviewUpgradeResult {
  wouldUpdate: string[];
  wouldCreate: string[];
  wouldPreserve: string[];
}

const TEMPLATE_PLACEHOLDERS: Record<string, string> = {
  "PROMPT.md": "[YOUR PROJECT NAME]",
  "AGENT.md": "pip install -r requirements.txt",
};

async function isTemplateCustomized(filePath: string, templateName: string): Promise<boolean> {
  const placeholder = TEMPLATE_PLACEHOLDERS[templateName];
  if (!placeholder) return false;

  try {
    const content = await readFile(filePath, "utf-8");
    return !content.includes(placeholder);
  } catch (err) {
    if (isEnoent(err)) return false;
    throw err;
  }
}

/**
 * Lazily loads the default (claude-code) platform to avoid circular imports
 * and keep backward compatibility for callers that don't pass a platform.
 */
async function getDefaultPlatform(): Promise<Platform> {
  const { claudeCodePlatform } = await import("./platform/claude-code.js");
  return claudeCodePlatform;
}

/**
 * Deliver slash commands based on the platform's command delivery strategy.
 *
 * - "directory": Copy command files to a directory (e.g., .claude/commands/)
 * - "inline": Merge command content as sections in the instructions file
 * - "none": Skip command delivery entirely
 */
async function deliverCommands(
  projectDir: string,
  platform: Platform,
  slashCommandsDir: string
): Promise<string[]> {
  const delivery = platform.commandDelivery;

  if (delivery.kind === "none") {
    return [];
  }

  const slashFiles = await readdir(slashCommandsDir);
  const bundledCommandNames = new Set(slashFiles.filter((f) => f.endsWith(".md")));

  if (delivery.kind === "directory") {
    const commandsDir = join(projectDir, delivery.dir);
    await mkdir(commandsDir, { recursive: true });

    // Clean stale bmalph-owned commands before copying (preserve user-created commands)
    try {
      const existingCommands = await readdir(commandsDir);
      for (const file of existingCommands) {
        if (file.endsWith(".md") && bundledCommandNames.has(file)) {
          await rm(join(commandsDir, file), { force: true });
        }
      }
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }

    for (const file of bundledCommandNames) {
      await cp(join(slashCommandsDir, file), join(commandsDir, file), { dereference: false });
    }

    return [`${delivery.dir}/`];
  }

  if (delivery.kind === "inline") {
    // Merge command content as sections in the instructions file
    const instructionsPath = join(projectDir, platform.instructionsFile);
    let existing = "";
    try {
      existing = await readFile(instructionsPath, "utf-8");
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }

    const commandSections: string[] = [];
    for (const file of [...bundledCommandNames].sort()) {
      const commandName = file.replace(/\.md$/, "");
      const content = await readFile(join(slashCommandsDir, file), "utf-8");
      commandSections.push(`### Command: ${commandName}\n\n${content.trim()}`);
    }

    const inlineMarker = "## BMAD Commands";
    const commandsBlock = `\n${inlineMarker}\n\n${commandSections.join("\n\n---\n\n")}\n`;

    if (existing.includes(inlineMarker)) {
      // Replace existing commands section
      const sectionStart = existing.indexOf(inlineMarker);
      const before = existing.slice(0, sectionStart);
      const afterSection = existing.slice(sectionStart);
      const nextHeadingMatch = afterSection.match(/\n## (?!BMAD Commands)/);
      const after = nextHeadingMatch ? afterSection.slice(nextHeadingMatch.index!) : "";
      await atomicWriteFile(instructionsPath, before.trimEnd() + commandsBlock + after);
    } else {
      await atomicWriteFile(instructionsPath, existing + commandsBlock);
    }

    return [platform.instructionsFile];
  }

  return [];
}

export async function copyBundledAssets(
  projectDir: string,
  platform?: Platform
): Promise<UpgradeResult> {
  const p = platform ?? (await getDefaultPlatform());
  const bmadDir = getBundledBmadDir();
  const ralphDir = getBundledRalphDir();
  const slashCommandsDir = getSlashCommandsDir();

  // Validate source directories exist
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

  // Atomic copy: rename-aside pattern to prevent data loss
  const bmadDest = join(projectDir, "_bmad");
  const bmadOld = join(projectDir, "_bmad.old");
  const bmadNew = join(projectDir, "_bmad.new");

  // Clean leftover from previous failed attempt
  await rm(bmadOld, { recursive: true, force: true });

  // Move original aside (tolerate ENOENT on first install)
  try {
    await rename(bmadDest, bmadOld);
  } catch (err) {
    if (!isEnoent(err)) throw err;
    debug("No existing _bmad to preserve (first install)");
  }

  // Stage new content
  await rm(bmadNew, { recursive: true, force: true });
  await cp(bmadDir, bmadNew, { recursive: true, dereference: false });

  // Swap in
  try {
    await rename(bmadNew, bmadDest);
  } catch (err) {
    // Restore original on failure
    debug(`Rename failed, restoring original: ${formatError(err)}`);
    try {
      await rename(bmadOld, bmadDest);
    } catch (restoreErr) {
      if (!isEnoent(restoreErr)) {
        debug(`Could not restore _bmad.old: ${formatError(restoreErr)}`);
      }
    }
    throw err;
  }

  // Clean up backup
  await rm(bmadOld, { recursive: true, force: true });

  // Generate combined manifest from module-help.csv files
  await generateManifests(projectDir);

  // Generate _bmad/config.yaml with platform-specific value
  const projectName = await deriveProjectName(projectDir);
  const escapedName = projectName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  await atomicWriteFile(
    join(projectDir, "_bmad/config.yaml"),
    `# BMAD Configuration - Generated by bmalph
platform: ${p.id}
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

  // Copy Ralph templates → .ralph/
  await mkdir(join(projectDir, ".ralph"), { recursive: true });

  // Preserve customized PROMPT.md and @AGENT.md on upgrade
  const promptCustomized = await isTemplateCustomized(
    join(projectDir, ".ralph/PROMPT.md"),
    "PROMPT.md"
  );
  const agentCustomized = await isTemplateCustomized(
    join(projectDir, ".ralph/@AGENT.md"),
    "AGENT.md"
  );

  if (!promptCustomized) {
    await cp(join(ralphDir, "templates/PROMPT.md"), join(projectDir, ".ralph/PROMPT.md"), {
      dereference: false,
    });
  }
  if (!agentCustomized) {
    await cp(join(ralphDir, "templates/AGENT.md"), join(projectDir, ".ralph/@AGENT.md"), {
      dereference: false,
    });
  }
  await cp(join(ralphDir, "RALPH-REFERENCE.md"), join(projectDir, ".ralph/RALPH-REFERENCE.md"), {
    dereference: false,
  });

  // Copy .ralphrc from template (skip if user has customized it)
  const ralphrcDest = join(projectDir, ".ralph/.ralphrc");
  if (!(await exists(ralphrcDest))) {
    // Read template and inject platform driver
    let ralphrcContent = await readFile(join(ralphDir, "templates/ralphrc.template"), "utf-8");
    // Replace default PLATFORM_DRIVER value with the actual platform id
    ralphrcContent = ralphrcContent.replace(
      /PLATFORM_DRIVER="\$\{PLATFORM_DRIVER:-[^"]*\}"/,
      `PLATFORM_DRIVER="\${PLATFORM_DRIVER:-${p.id}}"`
    );
    await atomicWriteFile(ralphrcDest, ralphrcContent);
  }

  // Copy Ralph loop and lib → .ralph/
  // Add version marker to ralph_loop.sh
  const loopContent = await readFile(join(ralphDir, "ralph_loop.sh"), "utf-8");
  const markerLine = `# bmalph-version: ${getPackageVersion()}`;
  // Use .* to handle empty version (edge case) and EOF without newline
  const markedContent = loopContent.includes("# bmalph-version:")
    ? loopContent.replace(/# bmalph-version:.*/, markerLine)
    : loopContent.replace(/^(#!.+\r?\n)/, `$1${markerLine}\n`);
  await atomicWriteFile(join(projectDir, ".ralph/ralph_loop.sh"), markedContent);
  await chmod(join(projectDir, ".ralph/ralph_loop.sh"), 0o755);
  await rm(join(projectDir, ".ralph/lib"), { recursive: true, force: true });
  await cp(join(ralphDir, "lib"), join(projectDir, ".ralph/lib"), {
    recursive: true,
    dereference: false,
  });

  // Copy Ralph utilities → .ralph/
  await cp(join(ralphDir, "ralph_import.sh"), join(projectDir, ".ralph/ralph_import.sh"), {
    dereference: false,
  });
  await chmod(join(projectDir, ".ralph/ralph_import.sh"), 0o755);
  await cp(join(ralphDir, "ralph_monitor.sh"), join(projectDir, ".ralph/ralph_monitor.sh"), {
    dereference: false,
  });
  await chmod(join(projectDir, ".ralph/ralph_monitor.sh"), 0o755);

  // Copy Ralph drivers → .ralph/drivers/
  const driversDir = join(ralphDir, "drivers");
  if (await exists(driversDir)) {
    const destDriversDir = join(projectDir, ".ralph/drivers");
    await rm(destDriversDir, { recursive: true, force: true });
    await cp(driversDir, destDriversDir, { recursive: true, dereference: false });
    // Make driver scripts executable
    try {
      const driverFiles = await readdir(destDriversDir);
      for (const file of driverFiles) {
        if (file.endsWith(".sh")) {
          await chmod(join(destDriversDir, file), 0o755);
        }
      }
    } catch {
      // Non-fatal if chmod fails
    }
  }

  // Deliver slash commands based on platform strategy
  const commandPaths = await deliverCommands(projectDir, p, slashCommandsDir);

  // Update .gitignore
  await updateGitignore(projectDir);

  const updatedPaths = [
    "_bmad/",
    ".ralph/ralph_loop.sh",
    ".ralph/ralph_import.sh",
    ".ralph/ralph_monitor.sh",
    ".ralph/lib/",
    ...(!promptCustomized ? [".ralph/PROMPT.md"] : []),
    ...(!agentCustomized ? [".ralph/@AGENT.md"] : []),
    ".ralph/RALPH-REFERENCE.md",
    ...commandPaths,
    ".gitignore",
  ];

  return { updatedPaths };
}

export async function installProject(projectDir: string, platform?: Platform): Promise<void> {
  // Create user directories (not overwritten by upgrade)
  await mkdir(join(projectDir, STATE_DIR), { recursive: true });
  await mkdir(join(projectDir, ".ralph/specs"), { recursive: true });
  await mkdir(join(projectDir, ".ralph/logs"), { recursive: true });
  await mkdir(join(projectDir, ".ralph/docs/generated"), { recursive: true });

  await copyBundledAssets(projectDir, platform);
}

async function deriveProjectName(projectDir: string): Promise<string> {
  try {
    const configPath = join(projectDir, CONFIG_FILE);
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (config.name) return config.name;
  } catch (err) {
    if (!isEnoent(err)) {
      warn(`Could not read ${CONFIG_FILE}: ${formatError(err)}`);
    }
  }
  return basename(projectDir);
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

async function updateGitignore(projectDir: string): Promise<void> {
  const gitignorePath = join(projectDir, ".gitignore");
  let existing = "";

  try {
    existing = await readFile(gitignorePath, "utf-8");
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  // Split into lines for exact comparison (avoid substring matching issues)
  const existingLines = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

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

  let existing = "";
  try {
    existing = await readFile(instructionsPath, "utf-8");
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  if (existing.includes(marker)) {
    // Replace stale section with current content, preserving content after it
    const sectionStart = existing.indexOf(marker);
    const before = existing.slice(0, sectionStart);
    const afterSection = existing.slice(sectionStart);
    // Find the next level-2 heading after the section start
    const markerEscaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextHeadingMatch = afterSection.match(new RegExp(`\\n## (?!${markerEscaped.slice(3)})`));
    const after = nextHeadingMatch ? afterSection.slice(nextHeadingMatch.index!) : "";
    await atomicWriteFile(instructionsPath, before.trimEnd() + "\n" + snippet + after);
    return;
  }

  await atomicWriteFile(instructionsPath, existing + snippet);
}

/**
 * @deprecated Use `mergeInstructionsFile(projectDir)` instead.
 * Kept for backward compatibility during migration.
 */
export async function mergeClaudeMd(projectDir: string): Promise<void> {
  return mergeInstructionsFile(projectDir);
}

export async function isInitialized(projectDir: string): Promise<boolean> {
  return exists(join(projectDir, CONFIG_FILE));
}

export async function hasExistingBmadDir(projectDir: string): Promise<boolean> {
  return exists(join(projectDir, "_bmad"));
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

  // Add command directory only for directory-based delivery
  if (p.commandDelivery.kind === "directory") {
    dirsToCreate.push(`${p.commandDelivery.dir}/`);
  }

  for (const dir of dirsToCreate) {
    if (await exists(join(projectDir, dir))) {
      if (
        dir === "_bmad/" ||
        (p.commandDelivery.kind === "directory" && dir === `${p.commandDelivery.dir}/`)
      ) {
        wouldModify.push(dir);
      }
    } else {
      wouldCreate.push(dir);
    }
  }

  // Files that would be created/modified
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

  // .gitignore would be modified if it exists, created otherwise
  if (await exists(join(projectDir, ".gitignore"))) {
    wouldModify.push(".gitignore");
  } else {
    wouldCreate.push(".gitignore");
  }

  // Instructions file integration check
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

  // Add command directory only for directory-based delivery
  if (p.commandDelivery.kind === "directory") {
    managedPaths.push({ path: `${p.commandDelivery.dir}/`, isDir: true });
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
