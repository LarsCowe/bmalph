import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { withErrorHandling } from "../utils/errors.js";
import { isPlatformId, getPlatform, getFullTierPlatformNames } from "../platform/registry.js";
import { validateCursorRuntime } from "../platform/cursor-runtime-checks.js";
import { validateBashAvailable, validateRalphLoop, spawnRalphLoop } from "../run/ralph-process.js";
import { startRunDashboard } from "../run/run-dashboard.js";
import { parseInterval } from "../utils/validate.js";
import { getDashboardTerminalSupport } from "../watch/frame-writer.js";
import type { Platform, PlatformId } from "../platform/types.js";

interface RunCommandOptions {
  projectDir: string;
  driver?: string;
  interval?: string;
  dashboard: boolean;
  review?: boolean;
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
      `Ralph requires a full-tier platform (${getFullTierPlatformNames()}). ` +
        `Current: ${platform.displayName}`
    );
  }

  if (platform.experimental) {
    console.log(chalk.yellow(`Warning: ${platform.displayName} support is experimental`));
  }

  const reviewEnabled = await resolveReviewMode(options.review, platform);
  if (reviewEnabled) {
    console.log(chalk.cyan("Enhanced mode: code review every 5 implementation loops"));
  }

  const interval = parseInterval(options.interval);
  let useDashboard = dashboard;
  if (useDashboard) {
    const terminalSupport = getDashboardTerminalSupport();
    if (!terminalSupport.supported) {
      console.log(chalk.yellow(`Warning: dashboard disabled. ${terminalSupport.reason}`));
      useDashboard = false;
    }
  }

  await Promise.all([validateBashAvailable(), validateRalphLoop(projectDir)]);
  if (platform.id === "cursor") {
    await validateCursorRuntime(projectDir);
  }

  const ralph = spawnRalphLoop(projectDir, platform.id, {
    inheritStdio: !useDashboard,
    ...(reviewEnabled && { reviewEnabled }),
  });

  if (useDashboard) {
    await startRunDashboard({ projectDir, interval, ralph, reviewEnabled });
    if (ralph.state === "stopped") {
      applyRalphExitCode(ralph.exitCode);
    }
  } else {
    const exitCode = await new Promise<number | null>((resolve) => {
      ralph.onExit((code) => resolve(code));
    });
    applyRalphExitCode(exitCode);
  }
}

function applyRalphExitCode(code: number | null): void {
  if (typeof code === "number" && code !== 0) {
    process.exitCode = code;
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

async function resolveReviewMode(
  reviewFlag: boolean | undefined,
  platform: Platform
): Promise<boolean> {
  if (reviewFlag === true) {
    if (platform.id !== "claude-code") {
      throw new Error("--review requires Claude Code (other drivers lack read-only enforcement)");
    }
    return true;
  }

  if (reviewFlag === false) {
    return false;
  }

  if (platform.id !== "claude-code") {
    return false;
  }

  if (!process.stdin.isTTY) {
    return false;
  }

  const { default: select } = await import("@inquirer/select");
  const mode = await select({
    message: "Quality mode:",
    choices: [
      { name: "Standard — current behavior (no extra cost)", value: "standard" },
      {
        name: "Enhanced — periodic code review every 5 loops (~10-14% more tokens)",
        value: "enhanced",
      },
    ],
    default: "standard",
  });
  return mode === "enhanced";
}
