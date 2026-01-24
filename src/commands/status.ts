import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { readState, readRalphStatus, getPhaseLabel } from "../utils/state.js";
import { isInitialized } from "../installer.js";

export async function statusCommand(): Promise<void> {
  try {
    await runStatus();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function runStatus(): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    return;
  }

  const config = await readConfig(projectDir);
  const state = await readState(projectDir);
  const ralph = await readRalphStatus(projectDir);

  const phase = state?.currentPhase ?? 1;
  const status = state?.status ?? "planning";
  const lastUpdated = state?.lastUpdated;

  console.log(chalk.bold("Project:") + ` ${config!.name}`);
  console.log(chalk.bold("Phase:") + `   ${phase} — ${getPhaseLabel(phase)}`);
  console.log(chalk.bold("Status:") + `  ${status}`);

  if (lastUpdated) {
    const ago = formatTimeAgo(lastUpdated);
    console.log(chalk.bold("Updated:") + ` ${ago}`);
  }

  console.log("");
  console.log(chalk.bold("Ralph:") + `   ${ralph.status}`);

  if (ralph.status !== "not_started") {
    console.log(chalk.dim(`         iterations: ${ralph.loopCount}, tasks: ${ralph.tasksCompleted}/${ralph.tasksTotal}`));
  }
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
