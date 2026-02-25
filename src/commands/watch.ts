import { readConfig } from "../utils/config.js";
import { withErrorHandling } from "../utils/errors.js";
import { startDashboard } from "../watch/dashboard.js";

interface WatchCommandOptions {
  interval?: string;
  projectDir: string;
}

const DEFAULT_INTERVAL_MS = 2000;

export async function watchCommand(options: WatchCommandOptions): Promise<void> {
  await withErrorHandling(() => runWatch(options));
}

async function runWatch(options: WatchCommandOptions): Promise<void> {
  const projectDir = options.projectDir;

  const config = await readConfig(projectDir);
  if (!config) {
    throw new Error("Project not initialized. Run: bmalph init");
  }

  const interval = options.interval ? parseInt(options.interval, 10) : DEFAULT_INTERVAL_MS;
  if (isNaN(interval) || interval < 500) {
    throw new Error("Interval must be a number >= 500 (milliseconds)");
  }

  await startDashboard({ projectDir, interval });
}
