import { spawn } from "child_process";
import { join } from "path";
import chalk from "chalk";
import { readPhaseState, getPhaseInfo } from "../utils/state.js";
import { isInitialized } from "../installer.js";

export async function resumeCommand(): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    process.exit(1);
  }

  const state = await readPhaseState(projectDir);
  if (!state) {
    console.log(chalk.yellow("No state found. Use 'bmalph start' to begin."));
    process.exit(1);
  }

  if (state.status === "completed") {
    console.log(chalk.green("All phases completed. Nothing to resume."));
    return;
  }

  const phaseInfo = getPhaseInfo(state.currentPhase);
  console.log(chalk.blue(`\nResuming Phase ${state.currentPhase} — ${phaseInfo.name} (iteration ${state.iteration})`));
  console.log(`  Agent: ${chalk.bold(phaseInfo.agent)}`);
  console.log(`  Goal: ${phaseInfo.goal}`);
  console.log(`  Outputs: ${phaseInfo.outputs.join(", ")}`);
  console.log(chalk.dim("\nPress Ctrl+C to interrupt.\n"));

  const scriptPath = join(projectDir, "bmalph/bmalph.sh");

  const child = spawn("bash", [scriptPath, String(state.currentPhase)], {
    cwd: projectDir,
    stdio: "inherit",
    env: { ...process.env, BMALPH_PROJECT_DIR: projectDir },
  });

  child.on("close", (code) => {
    if (code === 0) {
      console.log(chalk.green("\nbmalph loop completed."));
    } else if (code === 130) {
      console.log(chalk.yellow("\nbmalph loop interrupted."));
    } else {
      console.log(chalk.red(`\nbmalph loop exited with code ${code}.`));
    }
  });
}
