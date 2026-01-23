import chalk from "chalk";
import inquirer from "inquirer";
import { writeConfig, type BmalphConfig } from "../utils/config.js";
import { scaffoldProject, mergeClaudeMd, isInitialized } from "../installer.js";

interface InitOptions {
  name?: string;
  description?: string;
  level?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
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
                { name: "0 - Trivial (single-shot, no loop)", value: 0 },
                { name: "1 - Simple (quick flow, 1-5 iterations)", value: 1 },
                { name: "2 - Moderate (all 4 phases, standard)", value: 2 },
                { name: "3 - Complex (extra review iterations)", value: 3 },
                { name: "4 - Enterprise (full formal process)", value: 4 },
              ],
              default: 2,
            },
          ]),
    ]);

    name = name ?? answers.name;
    description = description ?? answers.description;
    level = level ?? answers.level;
  }

  console.log(chalk.blue("\nScaffolding bmalph..."));

  await scaffoldProject(projectDir);

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
  console.log(`\nWorkflow:`);
  console.log(`\n  Phase 1 — Analysis        Gather requirements, research, constraints`);
  console.log(`  Phase 2 — Planning        PRD, user stories, MVP scope`);
  console.log(`  Phase 3 — Design          Architecture, data model, conventions`);
  console.log(`  Phase 4 — Implementation  TDD build via Ralph loop`);
  console.log(`\nNext steps:`);
  console.log(`  ${chalk.cyan("bmalph start")}         Start from Phase 1 (Analysis)`);
  console.log(`  ${chalk.cyan("bmalph start -p 4")}    Skip to implementation (if you already have a plan)`);
  console.log(`  ${chalk.cyan("/bmalph")}              Use interactively in Claude Code`);
}
