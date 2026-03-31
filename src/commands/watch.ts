import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { withErrorHandling } from "../utils/errors.js";
import { isInitialized } from "../installer/project-files.js";
import { parseInterval } from "../utils/validate.js";
import { startDashboard } from "../watch/dashboard.js";
import { getDashboardTerminalSupport } from "../watch/frame-writer.js";

interface WatchCommandOptions {
  interval?: string;
  projectDir: string;
}

export async function watchCommand(options: WatchCommandOptions): Promise<void> {
  await withErrorHandling(() => runWatch(options));
}

async function runWatch(options: WatchCommandOptions): Promise<void> {
  console.error(chalk.yellow('Warning: "bmalph watch" is deprecated. Use "bmalph run" instead.'));

  const projectDir = options.projectDir;

  const config = await readConfig(projectDir);
  if (!config) {
    if (await isInitialized(projectDir)) {
      throw new Error("Config file is corrupted. Run: bmalph doctor");
    }
    throw new Error("Project not initialized. Run: bmalph init");
  }

  const interval = parseInterval(options.interval);
  const terminalSupport = getDashboardTerminalSupport();
  if (!terminalSupport.supported) {
    throw new Error(terminalSupport.reason);
  }

  await startDashboard({ projectDir, interval });
}
