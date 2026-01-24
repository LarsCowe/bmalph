import chalk from "chalk";
import inquirer from "inquirer";
import { writeConfig, type BmalphConfig } from "../utils/config.js";
import { installProject, mergeClaudeMd, isInitialized } from "../installer.js";

interface InitOptions {
  name?: string;
  description?: string;
  level?: string;
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

  let name = options.name;
  let description = options.description;
  let level = options.level ? parseInt(options.level, 10) : undefined;

  if (!name || !description || level === undefined) {
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
      ...(level !== undefined
        ? []
        : [
            {
              type: "list" as const,
              name: "level",
              message: "Complexity level:",
              choices: [
                { name: "0 - Trivial: one-shot task, no planning phases or Ralph loop", value: 0 },
                { name: "1 - Simple: quick tech spec → quick dev, minimal iterations", value: 1 },
                { name: "2 - Moderate: full BMAD phases (analysis → plan → solution → implement)", value: 2 },
                { name: "3 - Complex: all phases + validation steps and review rounds", value: 3 },
                { name: "4 - Enterprise: all phases, all validations, formal sign-offs", value: 4 },
              ],
              default: 2,
            },
          ]),
    ]);

    name = name ?? answers.name;
    description = description ?? answers.description;
    level = level ?? answers.level;
  }

  console.log(chalk.blue("\nInstalling BMAD + Ralph..."));

  await installProject(projectDir);

  const config: BmalphConfig = {
    name: name!,
    description: description ?? "",
    level: level!,
    createdAt: new Date().toISOString(),
  };

  await writeConfig(projectDir, config);
  await mergeClaudeMd(projectDir);

  console.log(chalk.green("\nbmalph initialized successfully!"));
  console.log(`\n  Project: ${chalk.bold(config.name)}`);
  console.log(`  Level: ${chalk.bold(String(config.level))}`);
  console.log(`\nInstalled:`);
  console.log(`  _bmad/             BMAD agents and workflows`);
  console.log(`  .ralph/            Ralph loop and templates`);
  console.log(`  .claude/commands/  Slash command (/bmalph)`);
  console.log(`  bmalph/            State management`);
  console.log(`\nNext step:`);
  console.log(`  Use ${chalk.cyan("/bmalph")} in Claude Code to see your current phase and commands.`);
}
