import chalk from "chalk";
import inquirer from "inquirer";
import { writeConfig, type BmalphConfig } from "../utils/config.js";
import { installProject, mergeClaudeMd, isInitialized, previewInstall } from "../installer.js";
import { formatDryRunSummary, type DryRunAction } from "../utils/dryrun.js";

interface InitOptions {
  name?: string;
  description?: string;
  dryRun?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  try {
    await runInit(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function runInit(options: InitOptions): Promise<void> {
  const projectDir = process.cwd();

  if (await isInitialized(projectDir)) {
    console.log(chalk.yellow("bmalph is already initialized in this project."));
    console.log("Use 'bmalph reset --hard' to reinitialize.");
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
    const answers = await inquirer.prompt([
      ...(name
        ? []
        : [
            {
              type: "input" as const,
              name: "name",
              message: "Project name:",
              default: projectDir.split(/[/\\]/).pop(),
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

  console.log(chalk.blue("\nInstalling BMAD + Ralph..."));

  await installProject(projectDir);

  const config: BmalphConfig = {
    name: name!,
    description: description ?? "",
    createdAt: new Date().toISOString(),
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
  console.log(`  Use ${chalk.cyan("/bmalph")} in Claude Code to see your current phase and commands.`);
}
