import { rm } from "fs/promises";
import { join } from "path";
import chalk from "chalk";
import { isInitialized } from "../installer.js";

interface ResetOptions {
  hard?: boolean;
}

export async function resetCommand(options: ResetOptions): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Nothing to reset."));
    process.exit(1);
  }

  // Always reset state
  await rm(join(projectDir, "bmalph/state"), { recursive: true, force: true });
  console.log(chalk.blue("State reset."));

  if (options.hard) {
    await rm(join(projectDir, "bmalph/artifacts"), { recursive: true, force: true });
    console.log(chalk.blue("Artifacts removed."));
  }

  console.log(chalk.green("Reset complete. Use 'bmalph start' to begin fresh."));
}
