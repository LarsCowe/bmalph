import chalk from "chalk";
import inquirer from "inquirer";
import { writeConfig, type BmalphConfig } from "../utils/config.js";
import {
  installProject,
  mergeClaudeMd,
  isInitialized,
  previewInstall,
  getBundledVersions,
} from "../installer.js";
import { formatDryRunSummary, type DryRunAction } from "../utils/dryrun.js";
import { validateProjectName } from "../utils/validate.js";
import { withErrorHandling } from "../utils/errors.js";

interface InitOptions {
  name?: string;
  description?: string;
  dryRun?: boolean;
  projectDir?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  await withErrorHandling(() => runInit(options));
}

async function runInit(options: InitOptions): Promise<void> {
  const projectDir = options.projectDir ?? process.cwd();

  if (await isInitialized(projectDir)) {
    console.log(chalk.yellow("bmalph is already initialized in this project."));
    console.log("Use 'bmalph upgrade' to update bundled assets to the latest version.");
    return;
  }

  // Handle dry-run mode
  if (options.dryRun) {
    const preview = await previewInstall(projectDir);
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

  console.log(chalk.blue("\nInstalling BMAD + Ralph..."));

  await installProject(projectDir);

  const bundledVersions = getBundledVersions();
  const config: BmalphConfig = {
    name: validatedName,
    description: description ?? "",
    createdAt: new Date().toISOString(),
    upstreamVersions: bundledVersions,
  };

  await writeConfig(projectDir, config);
  await mergeClaudeMd(projectDir);

  console.log(chalk.green("\nbmalph initialized successfully!"));
  console.log(`\n  Project: ${chalk.bold(config.name)}`);
  console.log(`\nInstalled:`);
  console.log(`  _bmad/             BMAD agents and workflows`);
  console.log(`  .ralph/            Ralph loop and templates`);
  console.log(`  .claude/commands/  Slash command (/bmalph)`);
  console.log(`  bmalph/            State management`);
  console.log(`\nNext step:`);
  console.log(
    `  Use ${chalk.cyan("/bmalph")} in Claude Code to see your current phase and commands.`
  );
}
