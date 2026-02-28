import { readConfig } from "../utils/config.js";
import { withErrorHandling } from "../utils/errors.js";
import { parseInterval } from "../utils/validate.js";
import { startDashboard } from "../watch/dashboard.js";

interface WatchCommandOptions {
  interval?: string;
  projectDir: string;
}

export async function watchCommand(options: WatchCommandOptions): Promise<void> {
  await withErrorHandling(() => runWatch(options));
}

async function runWatch(options: WatchCommandOptions): Promise<void> {
  const projectDir = options.projectDir;

  const config = await readConfig(projectDir);
  if (!config) {
    throw new Error("Project not initialized. Run: bmalph init");
  }

  const interval = parseInterval(options.interval);

  await startDashboard({ projectDir, interval });
}
