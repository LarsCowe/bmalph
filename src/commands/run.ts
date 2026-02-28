import { readConfig } from "../utils/config.js";
import { withErrorHandling } from "../utils/errors.js";
import { isPlatformId, getPlatform } from "../platform/registry.js";
import { validateBashAvailable, validateRalphLoop, spawnRalphLoop } from "../run/ralph-process.js";
import { startRunDashboard } from "../run/run-dashboard.js";
import { parseInterval } from "../utils/validate.js";
import type { Platform, PlatformId } from "../platform/types.js";

interface RunCommandOptions {
  projectDir: string;
  driver?: string;
  interval?: string;
  dashboard: boolean;
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  await withErrorHandling(() => executeRun(options));
}

async function executeRun(options: RunCommandOptions): Promise<void> {
  const { projectDir, dashboard } = options;

  const config = await readConfig(projectDir);
  if (!config) {
    throw new Error("Project not initialized. Run: bmalph init");
  }

  const platform = resolvePlatform(options.driver, config.platform);
  if (platform.tier !== "full") {
    throw new Error(
      `Ralph requires a full-tier platform (claude-code or codex). ` +
        `Current: ${platform.displayName}`
    );
  }

  const interval = parseInterval(options.interval);

  await Promise.all([validateBashAvailable(), validateRalphLoop(projectDir)]);

  const ralph = spawnRalphLoop(projectDir, platform.id, {
    inheritStdio: !dashboard,
  });

  if (dashboard) {
    await startRunDashboard({ projectDir, interval, ralph });
  } else {
    await new Promise<void>((resolve) => {
      ralph.onExit(() => resolve());
    });
  }
}

function resolvePlatform(
  driverOverride: string | undefined,
  configPlatform?: PlatformId
): Platform {
  const id = driverOverride ?? configPlatform ?? "claude-code";
  if (!isPlatformId(id)) {
    throw new Error(`Unknown platform: ${id}`);
  }
  return getPlatform(id);
}
