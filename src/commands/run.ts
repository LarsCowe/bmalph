import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { withErrorHandling } from "../utils/errors.js";
import { isPlatformId, getPlatform, getFullTierPlatformNames } from "../platform/registry.js";
import { validateCursorRuntime } from "../platform/cursor-runtime-checks.js";
import {
  validateBashAvailable,
  validateRalphLoop,
  validateGitRepo,
  spawnRalphLoop,
} from "../run/ralph-process.js";
import { startRunDashboard } from "../run/run-dashboard.js";
import { parseInterval } from "../utils/validate.js";
import { getDashboardTerminalSupport } from "../watch/frame-writer.js";
import type { Platform, PlatformId } from "../platform/types.js";
import type { ReviewMode } from "../run/types.js";

interface RunCommandOptions {
  projectDir: string;
  driver?: string;
  interval?: string;
  dashboard: boolean;
  review?: boolean | string;
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

  const reviewMode = await resolveReviewMode(options.review, platform);
  if (reviewMode === "enhanced") {
    console.log(chalk.cyan("Enhanced mode: code review every 5 implementation loops"));
  } else if (reviewMode === "ultimate") {
    console.log(chalk.cyan("Ultimate mode: code review after every completed story"));
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

  await Promise.all([
    validateBashAvailable(),
    validateRalphLoop(projectDir),
    validateGitRepo(projectDir),
  ]);
  if (platform.id === "cursor") {
    await validateCursorRuntime(projectDir);
  }

  const ralph = spawnRalphLoop(projectDir, platform.id, {
    inheritStdio: !useDashboard,
    reviewMode,
  });

  if (useDashboard) {
    await startRunDashboard({ projectDir, interval, ralph, reviewMode });
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

const VALID_REVIEW_MODES = new Set<string>(["enhanced", "ultimate"]);

async function resolveReviewMode(
  reviewFlag: boolean | string | undefined,
  platform: Platform
): Promise<ReviewMode> {
  if (reviewFlag === false) {
    return "off";
  }

  if (reviewFlag === true || typeof reviewFlag === "string") {
    if (platform.id !== "claude-code") {
      throw new Error("--review requires Claude Code (other drivers lack read-only enforcement)");
    }

    if (reviewFlag === true) {
      return "enhanced";
    }

    if (!VALID_REVIEW_MODES.has(reviewFlag)) {
      throw new Error(`Unknown review mode: ${reviewFlag}. Valid modes: enhanced, ultimate`);
    }

    return reviewFlag as ReviewMode;
  }

  if (platform.id !== "claude-code") {
    return "off";
  }

  if (!process.stdin.isTTY) {
    return "off";
  }

  const { default: select } = await import("@inquirer/select");
  return select<ReviewMode>({
    message: "Quality mode:",
    choices: [
      { name: "Standard — no code review (no extra cost)", value: "off" },
      {
        name: "Enhanced — periodic code review every 5 loops (~10-14% more tokens)",
        value: "enhanced",
      },
      {
        name: "Ultimate — review after every completed story (~20-30% more tokens)",
        value: "ultimate",
      },
    ],
    default: "off",
  });
}
