import { spawn } from "child_process";
import { join } from "path";
import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { writePhaseState, getPhaseInfo, type PhaseState } from "../utils/state.js";
import { isInitialized } from "../installer.js";

interface StartOptions {
  phase?: string;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    process.exit(1);
  }

  const config = await readConfig(projectDir);
  if (!config) {
    console.log(chalk.red("Could not read config. Run 'bmalph init' to reinitialize."));
    process.exit(1);
  }

  const startPhase = options.phase ? parseInt(options.phase, 10) : 1;

  if (startPhase < 1 || startPhase > 4) {
    console.log(chalk.red("Phase must be between 1 and 4."));
    process.exit(1);
  }

  const state: PhaseState = {
    currentPhase: startPhase,
    iteration: 0,
    status: "running",
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  await writePhaseState(projectDir, state);

  const phaseInfo = getPhaseInfo(startPhase);
  console.log(chalk.blue(`\nStarting Phase ${startPhase} — ${phaseInfo.name}`));
  console.log(`  Agent: ${chalk.bold(phaseInfo.agent)}`);
  console.log(`  Goal: ${phaseInfo.goal}`);
  console.log(`  Outputs: ${phaseInfo.outputs.join(", ")}`);
  console.log(chalk.dim("\nPress Ctrl+C to interrupt.\n"));

  const scriptPath = join(projectDir, "bmalph/bmalph.sh");

  const child = spawn("bash", [scriptPath, String(startPhase)], {
    cwd: projectDir,
    stdio: "inherit",
    env: { ...process.env, BMALPH_PROJECT_DIR: projectDir },
  });

  child.on("close", (code) => {
    if (code === 0) {
      console.log(chalk.green("\nbmalph loop completed."));
    } else if (code === 130) {
      console.log(chalk.yellow("\nbmalph loop interrupted by user."));
    } else {
      console.log(chalk.red(`\nbmalph loop exited with code ${code}.`));
    }
  });
}
