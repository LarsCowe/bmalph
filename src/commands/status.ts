import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { readPhaseState, readPhaseTasks, getPhaseLabel } from "../utils/state.js";
import { isInitialized } from "../installer.js";

export async function statusCommand(): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    process.exit(1);
  }

  const config = await readConfig(projectDir);
  const state = await readPhaseState(projectDir);

  console.log(chalk.bold("\n  BMALPH Status\n"));

  if (config) {
    console.log(`  Project:    ${config.name}`);
    console.log(`  Level:      ${config.level}`);
  }

  if (!state) {
    console.log(`  Status:     ${chalk.dim("Not started")}`);
    console.log(`\n  Run ${chalk.cyan("bmalph start")} to begin.\n`);
    return;
  }

  const statusColor =
    state.status === "running"
      ? chalk.green
      : state.status === "paused"
        ? chalk.yellow
        : chalk.blue;

  console.log(`  Phase:      ${state.currentPhase}/4 (${getPhaseLabel(state.currentPhase)})`);
  console.log(`  Iteration:  ${state.iteration}`);
  console.log(`  Status:     ${statusColor(state.status)}`);
  console.log(`  Started:    ${new Date(state.startedAt).toLocaleString()}`);
  console.log(`  Updated:    ${new Date(state.lastUpdated).toLocaleString()}`);

  // Show task summary per phase
  console.log(chalk.bold("\n  Phase Progress:\n"));
  for (let p = 1; p <= 4; p++) {
    const tasks = await readPhaseTasks(projectDir, p);
    const completed = tasks.filter((t) => t.status === "completed").length;
    const total = tasks.length;
    const indicator =
      p < state.currentPhase
        ? chalk.green("done")
        : p === state.currentPhase
          ? chalk.yellow("active")
          : chalk.dim("pending");

    if (total > 0) {
      console.log(`  ${p}. ${getPhaseLabel(p).padEnd(15)} [${indicator}] ${completed}/${total} tasks`);
    } else {
      console.log(`  ${p}. ${getPhaseLabel(p).padEnd(15)} [${indicator}]`);
    }
  }
  console.log();
}
