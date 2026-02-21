import chalk from "chalk";
import inquirer from "inquirer";
import { writeConfig, type BmalphConfig } from "../utils/config.js";
import {
  installProject,
  mergeInstructionsFile,
  isInitialized,
  hasExistingBmadDir,
  previewInstall,
  getBundledVersions,
} from "../installer.js";
import { formatDryRunSummary, type DryRunAction } from "../utils/dryrun.js";
import { validateProjectName } from "../utils/validate.js";
import { withErrorHandling } from "../utils/errors.js";
import { isPlatformId, getPlatform } from "../platform/registry.js";
import { detectPlatform } from "../platform/detect.js";
import type { Platform, PlatformId } from "../platform/types.js";

interface InitOptions {
  name?: string;
  description?: string;
  platform?: string;
  dryRun?: boolean;
  projectDir: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  await withErrorHandling(() => runInit(options));
}

/**
 * Resolve which platform to use:
 * 1. Explicit --platform flag
 * 2. Auto-detect from filesystem markers
 * 3. Interactive prompt (if TTY)
 * 4. Default to claude-code (non-interactive)
 */
async function resolvePlatform(projectDir: string, explicit?: string): Promise<Platform> {
  // 1. Explicit flag
  if (explicit) {
    if (!isPlatformId(explicit)) {
      throw new Error(
        `Unknown platform: "${explicit}". ` +
          `Valid platforms: claude-code, codex, cursor, windsurf, copilot, aider`
      );
    }
    return getPlatform(explicit);
  }

  // 2. Auto-detect
  const detection = await detectPlatform(projectDir);
  if (detection.detected) {
    return getPlatform(detection.detected);
  }

  // 3. Interactive prompt if multiple candidates or none detected
  if (process.stdin.isTTY) {
    const choices: Array<{ name: string; value: PlatformId }> = [
      { name: "Claude Code", value: "claude-code" },
      { name: "OpenAI Codex", value: "codex" },
      { name: "Cursor", value: "cursor" },
      { name: "Windsurf", value: "windsurf" },
      { name: "GitHub Copilot", value: "copilot" },
      { name: "Aider", value: "aider" },
    ];

    const { platformId } = await inquirer.prompt([
      {
        type: "list",
        name: "platformId",
        message: "Which platform are you using?",
        choices,
        default: detection.candidates[0] ?? "claude-code",
      },
    ]);

    return getPlatform(platformId);
  }

  // 4. Non-interactive default
  return getPlatform("claude-code");
}

async function runInit(options: InitOptions): Promise<void> {
  const projectDir = options.projectDir;

  if (await isInitialized(projectDir)) {
    console.log(chalk.yellow("bmalph is already initialized in this project."));
    console.log("Use 'bmalph upgrade' to update bundled assets to the latest version.");
    return;
  }

  if (await hasExistingBmadDir(projectDir)) {
    console.log(chalk.cyan("Existing BMAD installation detected."));
    console.log("Framework files in _bmad/ will be replaced with the managed version.");
    console.log("Planning artifacts in _bmad-output/ will not be modified.\n");
  }

  // Resolve platform
  const platform = await resolvePlatform(projectDir, options.platform);

  // Handle dry-run mode
  if (options.dryRun) {
    const preview = await previewInstall(projectDir, platform);
    const actions: DryRunAction[] = [
      ...preview.wouldCreate.map((p) => ({ type: "create" as const, path: p })),
      ...preview.wouldModify.map((p) => ({ type: "modify" as const, path: p })),
      ...preview.wouldSkip.map((p) => ({ type: "skip" as const, path: p })),
    ];
    console.log(formatDryRunSummary(actions));
    return;
  }

  let name = options.name;
  let description = options.description;

  if (!name || !description) {
    if (!process.stdin.isTTY) {
      throw new Error("Non-interactive mode requires --name and --description flags");
    }

    // Derive default name from directory, with fallback for edge cases
    const dirName = projectDir.split(/[/\\]/).pop();
    const defaultName = dirName && dirName.trim() ? dirName : "my-project";

    const answers = await inquirer.prompt([
      ...(name
        ? []
        : [
            {
              type: "input" as const,
              name: "name",
              message: "Project name:",
              default: defaultName,
            },
          ]),
      ...(description
        ? []
        : [
            {
              type: "input" as const,
              name: "description",
              message: "Project description:",
            },
          ]),
    ]);

    name = name ?? answers.name;
    description = description ?? answers.description;
  }

  // Validate project name (filesystem safety, reserved names, etc.)
  if (!name) {
    throw new Error("Project name cannot be empty");
  }
  const validatedName = validateProjectName(name);

  console.log(chalk.blue(`\nInstalling BMAD + Ralph for ${platform.displayName}...`));

  await installProject(projectDir, platform);

  const bundledVersions = getBundledVersions();
  const config: BmalphConfig = {
    name: validatedName,
    description: description ?? "",
    createdAt: new Date().toISOString(),
    platform: platform.id,
    upstreamVersions: bundledVersions,
  };

  try {
    await writeConfig(projectDir, config);
    await mergeInstructionsFile(projectDir, platform);
  } catch (err) {
    throw new Error(
      `Partial installation: files were copied but configuration failed. ` +
        `Run 'bmalph init' again to retry.`,
      { cause: err }
    );
  }

  console.log(chalk.green("\nbmalph initialized successfully!"));
  console.log(`\n  Project: ${chalk.bold(config.name)}`);
  console.log(`  Platform: ${chalk.bold(platform.displayName)}`);
  console.log(`\nInstalled:`);
  console.log(`  _bmad/             BMAD agents and workflows`);
  console.log(`  .ralph/            Ralph loop and templates`);
  if (platform.commandDelivery.kind === "directory") {
    console.log(`  ${platform.commandDelivery.dir}/  Slash commands`);
  }
  console.log(`  bmalph/            State management`);

  // Platform-specific next step guidance
  console.log(`\nNext step:`);
  if (platform.id === "claude-code") {
    console.log(
      `  Use ${chalk.cyan("/bmalph")} in Claude Code to see your current phase and commands.`
    );
  } else if (platform.id === "codex") {
    console.log(`  Ask Codex to ${chalk.cyan("run the BMAD master agent")} to navigate phases.`);
  } else {
    console.log(
      `  Ask your AI assistant to ${chalk.cyan("use the BMAD agents")} defined in ${chalk.cyan(platform.instructionsFile)}.`
    );
  }
}
