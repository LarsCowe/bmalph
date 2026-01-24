import chalk from "chalk";
import { spawn } from "child_process";
import { access } from "fs/promises";
import { join } from "path";
import { readState, writeState, type BmalphState } from "../utils/state.js";
import { isInitialized } from "../installer.js";
import { runTransition } from "../transition.js";

export async function implementCommand(): Promise<void> {
  try {
    await runImplement();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function runImplement(): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    return;
  }

  // Check if Ralph loop script exists
  const loopScript = join(projectDir, ".ralph/ralph_loop.sh");
  try {
    await access(loopScript);
  } catch {
    console.log(chalk.red("Ralph loop script not found at .ralph/ralph_loop.sh"));
    console.log("Run 'bmalph init' to install Ralph.");
    return;
  }

  // Run transition: BMAD artifacts → Ralph inputs
  console.log(chalk.blue("Transitioning BMAD artifacts to Ralph format..."));

  try {
    const result = await runTransition(projectDir);
    console.log(chalk.green(`Generated fix_plan.md with ${result.storiesCount} stories`));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`Warning: ${warning}`));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`Transition failed: ${message}`));
    return;
  }

  // Update state
  const now = new Date().toISOString();
  const state = await readState(projectDir);
  const newState: BmalphState = {
    currentPhase: 4,
    status: "implementing",
    startedAt: state?.startedAt ?? now,
    lastUpdated: now,
  };
  await writeState(projectDir, newState);

  // Start Ralph loop
  console.log(chalk.blue("\nStarting Ralph autonomous loop..."));
  console.log(chalk.dim("Press Ctrl+C to stop the loop.\n"));

  const child = spawn("bash", [loopScript], {
    cwd: projectDir,
    stdio: "inherit",
    env: { ...process.env, RALPH_DIR: join(projectDir, ".ralph") },
  });

  child.on("close", (code) => {
    if (code === 0) {
      console.log(chalk.green("\nRalph loop completed successfully."));
    } else {
      console.log(chalk.yellow(`\nRalph loop exited with code ${code}`));
    }
  });

  child.on("error", (err) => {
    console.log(chalk.red(`Failed to start Ralph loop: ${err.message}`));
    console.log(chalk.dim("Ensure bash is available and ralph_loop.sh is executable."));
  });
}
