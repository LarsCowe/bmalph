import chalk from "chalk";
import { rm } from "fs/promises";
import { join } from "path";
import { isInitialized } from "../installer.js";

interface ResetOptions {
  hard?: boolean;
}

export async function resetCommand(options: ResetOptions): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.yellow("bmalph is not initialized in this project."));
    return;
  }

  // Always reset state
  await rm(join(projectDir, "bmalph/state"), { recursive: true, force: true });
  console.log(chalk.green("State reset."));

  if (options.hard) {
    await rm(join(projectDir, "_bmad"), { recursive: true, force: true });
    await rm(join(projectDir, ".ralph"), { recursive: true, force: true });
    await rm(join(projectDir, "_bmad-output"), { recursive: true, force: true });
    await rm(join(projectDir, "bmalph"), { recursive: true, force: true });
    console.log(chalk.green("Artifacts removed (_bmad/, .ralph/, _bmad-output/, bmalph/)."));
    console.log("Run 'bmalph init' to reinitialize.");
  } else {
    console.log(chalk.dim("Use --hard to also remove _bmad/, .ralph/, and artifacts."));
  }
}
