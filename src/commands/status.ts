import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { readState, readRalphStatus, getPhaseLabel, getPhaseInfo } from "../utils/state.js";
import { withErrorHandling } from "../utils/errors.js";

interface StatusOptions {
  json?: boolean;
}

interface StatusOutput {
  phase: number;
  phaseName: string;
  status: string;
  ralph?: {
    loopCount: number;
    status: string;
    tasksCompleted: number;
    tasksTotal: number;
  };
  nextAction?: string;
}

export async function statusCommand(options: StatusOptions = {}): Promise<void> {
  await withErrorHandling(() => runStatus(options));
}

export async function runStatus(options: StatusOptions = {}): Promise<void> {
  const projectDir = process.cwd();

  // Check if project is initialized
  const config = await readConfig(projectDir);
  if (!config) {
    console.log(chalk.red("Project not initialized. Run: bmalph init"));
    return;
  }

  // Read current state
  const state = await readState(projectDir);
  const phase = state?.currentPhase ?? 1;
  const status = state?.status ?? "planning";
  const phaseName = getPhaseLabel(phase);
  const phaseInfo = getPhaseInfo(phase);

  // Read Ralph status if in implementation phase
  let ralphStatus = null;
  if (phase === 4) {
    ralphStatus = await readRalphStatus(projectDir);
  }

  // Determine next action
  const nextAction = getNextAction(phase, status, ralphStatus);

  if (options.json) {
    const output: StatusOutput = {
      phase,
      phaseName,
      status,
    };

    if (ralphStatus) {
      output.ralph = {
        loopCount: ralphStatus.loopCount,
        status: ralphStatus.status,
        tasksCompleted: ralphStatus.tasksCompleted,
        tasksTotal: ralphStatus.tasksTotal,
      };
    }

    if (nextAction) {
      output.nextAction = nextAction;
    }

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  console.log(chalk.bold("bmalph status\n"));

  console.log(`  ${chalk.cyan("Phase:")} ${phase} - ${phaseName}`);
  console.log(`  ${chalk.cyan("Agent:")} ${phaseInfo.agent}`);
  console.log(`  ${chalk.cyan("Status:")} ${formatStatus(status)}`);

  if (phase === 4 && ralphStatus) {
    console.log("");
    console.log(chalk.bold("  Ralph Loop"));
    console.log(`    ${chalk.cyan("Status:")} ${formatRalphStatus(ralphStatus.status)}`);
    console.log(`    ${chalk.cyan("Loop count:")} ${ralphStatus.loopCount}`);
    console.log(`    ${chalk.cyan("Tasks:")} ${ralphStatus.tasksCompleted}/${ralphStatus.tasksTotal}`);
  } else if (phase === 4) {
    console.log("");
    console.log(chalk.bold("  Ralph Loop"));
    console.log(`    ${chalk.cyan("Status:")} ${chalk.dim("not started")}`);
  }

  if (nextAction) {
    console.log("");
    console.log(`  ${chalk.cyan("Next:")} ${nextAction}`);
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case "planning":
      return chalk.blue("planning");
    case "implementing":
      return chalk.yellow("implementing");
    case "completed":
      return chalk.green("completed");
    default:
      return status;
  }
}

function formatRalphStatus(status: string): string {
  switch (status) {
    case "running":
      return chalk.yellow("running");
    case "blocked":
      return chalk.red("blocked");
    case "completed":
      return chalk.green("completed");
    case "not_started":
      return chalk.dim("not started");
    default:
      return status;
  }
}

function getNextAction(phase: number, status: string, ralphStatus: { status: string } | null): string | null {
  if (status === "completed") {
    return null;
  }

  switch (phase) {
    case 1:
      return "Run /analyst to start analysis";
    case 2:
      return "Run /pm to create PRD";
    case 3:
      return "Run /bmalph-implement when ready for implementation";
    case 4:
      if (!ralphStatus || ralphStatus.status === "not_started") {
        return "Start Ralph loop with: bash .ralph/ralph_loop.sh";
      }
      if (ralphStatus.status === "blocked") {
        return "Review Ralph logs: bmalph doctor";
      }
      if (ralphStatus.status === "running") {
        return "Ralph is running. Check logs in .ralph/logs/";
      }
      return null;
    default:
      return null;
  }
}
