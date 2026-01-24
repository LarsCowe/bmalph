import chalk from "chalk";
import { readState, writeState, getPhaseInfo, type BmalphState } from "../utils/state.js";
import { isInitialized } from "../installer.js";

interface PlanOptions {
  phase?: string;
}

export async function planCommand(options: PlanOptions): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    return;
  }

  const phase = options.phase ? parseInt(options.phase, 10) : undefined;

  if (phase !== undefined && (phase < 1 || phase > 3)) {
    console.log(chalk.red("Phase must be 1, 2, or 3. Use 'bmalph implement' for phase 4."));
    return;
  }

  const state = await readState(projectDir);
  const activePhase = phase ?? state?.currentPhase ?? 1;

  // Update state
  const now = new Date().toISOString();
  const newState: BmalphState = {
    currentPhase: activePhase,
    status: "planning",
    startedAt: state?.startedAt ?? now,
    lastUpdated: now,
  };
  await writeState(projectDir, newState);

  const info = getPhaseInfo(activePhase);

  console.log(chalk.bold(`\nPhase ${activePhase}: ${info.name}`));
  console.log(chalk.dim(`Agent: ${info.agent}`));
  console.log("");

  if (info.commands.length === 0) {
    console.log("No commands for this phase. Use 'bmalph implement' instead.");
    return;
  }

  console.log("Available commands:");
  console.log("");
  for (const cmd of info.commands) {
    const required = cmd.required ? chalk.yellow(" (required)") : "";
    console.log(`  ${chalk.cyan(cmd.code.padEnd(4))} ${cmd.name}${required}`);
    console.log(`       ${chalk.dim(cmd.description)}`);
  }

  console.log("");
  console.log(chalk.dim("Load the BMAD master agent, then invoke these commands in Claude Code."));
  console.log(chalk.dim(`When done, advance with: bmalph plan --phase ${activePhase + 1}`));
}
