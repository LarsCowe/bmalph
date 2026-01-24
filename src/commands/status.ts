import chalk from "chalk";
import { readState, getPhaseInfo, getPhaseLabel, readRalphStatus } from "../utils/state.js";
import { readConfig } from "../utils/config.js";
import { isInitialized } from "../installer.js";

export async function statusCommand(): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    return;
  }

  const config = await readConfig(projectDir);
  const state = await readState(projectDir);

  console.log(chalk.bold(`\n${config?.name ?? "Project"}`));
  if (config?.description) {
    console.log(chalk.dim(config.description));
  }
  console.log("");

  if (!state) {
    console.log(chalk.yellow("No active phase. Run 'bmalph plan --phase 1' to start."));
    return;
  }

  const phaseLabel = getPhaseLabel(state.currentPhase);
  const info = getPhaseInfo(state.currentPhase);

  console.log(`Phase:  ${chalk.cyan(`${state.currentPhase} — ${phaseLabel}`)}`);
  console.log(`Agent:  ${info.agent}`);
  console.log(`Status: ${formatStatus(state.status)}`);
  console.log("");

  if (state.currentPhase <= 3) {
    console.log(chalk.dim("Planning phase — use BMAD commands in Claude Code"));
    if (info.commands.length > 0) {
      const required = info.commands.filter((c) => c.required);
      if (required.length > 0) {
        console.log(chalk.dim(`Required: ${required.map((c) => c.code).join(", ")}`));
      }
    }
  } else {
    const ralph = await readRalphStatus(projectDir);
    console.log(`Loop:   ${ralph.loopCount} iterations`);
    console.log(`Tasks:  ${ralph.tasksCompleted}/${ralph.tasksTotal} completed`);
    console.log(`Ralph:  ${formatRalphStatus(ralph.status)}`);
  }

  console.log("");
}

function formatStatus(status: string): string {
  switch (status) {
    case "planning":
      return chalk.blue("Planning");
    case "implementing":
      return chalk.green("Implementing");
    case "completed":
      return chalk.green("Completed");
    default:
      return status;
  }
}

function formatRalphStatus(status: string): string {
  switch (status) {
    case "running":
      return chalk.green("Running");
    case "blocked":
      return chalk.red("Blocked");
    case "completed":
      return chalk.green("Completed");
    case "not_started":
      return chalk.dim("Not started");
    default:
      return status;
  }
}
