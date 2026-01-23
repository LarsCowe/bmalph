import { spawn } from "child_process";
import { join } from "path";
import chalk from "chalk";
import { readPhaseState, getPhaseLabel } from "../utils/state.js";
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

  console.log(
    chalk.blue(
      `Resuming from Phase ${state.currentPhase} (${getPhaseLabel(state.currentPhase)}), iteration ${state.iteration}...`
    )
  );

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
