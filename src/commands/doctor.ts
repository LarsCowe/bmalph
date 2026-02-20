import chalk from "chalk";
import { access, readFile, stat } from "fs/promises";
import { join } from "path";
import { readJsonFile } from "../utils/json.js";
import { readConfig } from "../utils/config.js";
import { getBundledVersions } from "../installer.js";
import { checkUpstream, type GitHubError } from "../utils/github.js";
import { isEnoent, withErrorHandling } from "../utils/errors.js";
import {
  validateCircuitBreakerState,
  validateRalphSession,
  validateRalphApiStatus,
} from "../utils/validate.js";
import {
  SESSION_AGE_WARNING_MS,
  API_USAGE_WARNING_PERCENT,
  CONFIG_FILE,
  RALPH_STATUS_FILE,
} from "../utils/constants.js";

/**
 * Result of a single doctor check.
 */
export interface CheckResult {
  label: string;
  passed: boolean;
  detail?: string;
  hint?: string;
}

/**
 * Function signature for doctor checks.
 * Takes a project directory and returns a check result.
 */
export type CheckFunction = (projectDir: string) => Promise<CheckResult>;

/**
 * Definition of a single doctor check in the registry.
 */
export interface CheckDefinition {
  /** Unique identifier for the check */
  id: string;
  /** The check function to execute */
  run: CheckFunction;
}

interface DoctorOptions {
  json?: boolean;
  projectDir?: string;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  await withErrorHandling(async () => {
    const { failed } = await runDoctor(options);
    if (!options.json && failed > 0) {
      process.exitCode = 1;
    }
  });
}

interface DoctorResult {
  passed: number;
  failed: number;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorResult> {
  const projectDir = options.projectDir ?? process.cwd();

  // Run all checks from the registry
  const results: CheckResult[] = await Promise.all(
    CHECK_REGISTRY.map((check) => check.run(projectDir))
  );

  // Output
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  if (options.json) {
    const output = {
      results: results.map((r) => ({
        label: r.label,
        passed: r.passed,
        ...(r.detail && { detail: r.detail }),
        ...(r.hint && { hint: r.hint }),
      })),
      summary: {
        passed,
        failed,
        total: results.length,
      },
    };
    console.log(JSON.stringify(output, null, 2));
    return { passed, failed };
  }

  console.log(chalk.bold("bmalph doctor\n"));

  for (const r of results) {
    const icon = r.passed ? chalk.green("\u2713") : chalk.red("\u2717");
    const detail = r.detail ? chalk.dim(` (${r.detail})`) : "";
    console.log(`  ${icon} ${r.label}${detail}`);
    if (!r.passed && r.hint) {
      console.log(chalk.yellow(`     → ${r.hint}`));
    }
  }

  console.log("");

  if (failed === 0) {
    console.log(chalk.green(`${passed} passed, all checks OK`));
  } else {
    console.log(`${chalk.green(`${passed} passed`)}, ${chalk.red(`${failed} failed`)}`);
  }

  return { passed, failed };
}

async function checkBashAvailable(): Promise<boolean> {
  const { execSync } = await import("child_process");
  try {
    const cmd = process.platform === "win32" ? "where bash" : "which bash";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Check functions - each conforms to CheckFunction signature
// =============================================================================

async function checkNodeVersion(_projectDir: string): Promise<CheckResult> {
  const major = parseInt(process.versions.node.split(".")[0]);
  return {
    label: "Node version >= 20",
    passed: major >= 20,
    detail: major >= 20 ? `v${process.versions.node}` : `got v${process.versions.node}`,
    hint: major >= 20 ? undefined : "Install Node.js 20+ from nodejs.org or run: nvm install 20",
  };
}

async function checkBash(_projectDir: string): Promise<CheckResult> {
  const bashAvailable = await checkBashAvailable();
  return {
    label: "bash available",
    passed: bashAvailable,
    detail: bashAvailable ? undefined : "bash not found in PATH",
    hint: bashAvailable
      ? undefined
      : process.platform === "win32"
        ? "Install Git Bash or WSL: https://git-scm.com/downloads"
        : "Install bash via your package manager (apt, brew, etc.)",
  };
}

async function checkBmadDir(projectDir: string): Promise<CheckResult> {
  return checkDir(join(projectDir, "_bmad"), "_bmad/ directory present", "Run: bmalph init");
}

async function checkRalphLoop(projectDir: string): Promise<CheckResult> {
  return checkFileHasContent(
    join(projectDir, ".ralph/ralph_loop.sh"),
    "ralph_loop.sh present and has content",
    "Run: bmalph upgrade"
  );
}

async function checkRalphLib(projectDir: string): Promise<CheckResult> {
  return checkDir(
    join(projectDir, ".ralph/lib"),
    ".ralph/lib/ directory present",
    "Run: bmalph upgrade"
  );
}

async function checkSlashCommand(projectDir: string): Promise<CheckResult> {
  return checkFileExists(
    join(projectDir, ".claude/commands/bmalph.md"),
    ".claude/commands/bmalph.md present",
    "Run: bmalph init"
  );
}

async function checkConfig(projectDir: string): Promise<CheckResult> {
  const label = "bmalph/config.json exists and valid";
  const hint = "Run: bmalph init";
  const path = join(projectDir, CONFIG_FILE);
  try {
    const data = await readJsonFile<unknown>(path);
    if (data === null) {
      return { label, passed: false, detail: "file not found", hint };
    }
    return { label, passed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    return { label, passed: false, detail: msg, hint };
  }
}

async function checkDir(dirPath: string, label: string, hint?: string): Promise<CheckResult> {
  try {
    const s = await stat(dirPath);
    return { label, passed: s.isDirectory() };
  } catch {
    return { label, passed: false, detail: "not found", hint };
  }
}

async function checkFileExists(
  filePath: string,
  label: string,
  hint?: string
): Promise<CheckResult> {
  try {
    await access(filePath);
    return { label, passed: true };
  } catch {
    return { label, passed: false, detail: "not found", hint };
  }
}

async function checkFileHasContent(
  filePath: string,
  label: string,
  hint?: string
): Promise<CheckResult> {
  try {
    const content = await readFile(filePath, "utf-8");
    return { label, passed: content.trim().length > 0 };
  } catch {
    return { label, passed: false, detail: "not found", hint };
  }
}

async function checkClaudeMd(projectDir: string): Promise<CheckResult> {
  const label = "CLAUDE.md contains BMAD snippet";
  const hint = "Run: bmalph init";
  try {
    const content = await readFile(join(projectDir, "CLAUDE.md"), "utf-8");
    if (content.includes("BMAD-METHOD Integration")) {
      return { label, passed: true };
    }
    return { label, passed: false, detail: "missing BMAD-METHOD Integration section", hint };
  } catch {
    return { label, passed: false, detail: "CLAUDE.md not found", hint };
  }
}

async function checkGitignore(projectDir: string): Promise<CheckResult> {
  const label = ".gitignore has required entries";
  const required = [".ralph/logs/", "_bmad-output/"];
  try {
    const content = await readFile(join(projectDir, ".gitignore"), "utf-8");
    // Use line-by-line comparison to avoid substring matching issues
    const existingLines = new Set(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
    const missing = required.filter((e) => !existingLines.has(e));
    if (missing.length === 0) {
      return { label, passed: true };
    }
    return {
      label,
      passed: false,
      detail: `missing: ${missing.join(", ")}`,
      hint: `Add to .gitignore: ${missing.join(" ")}`,
    };
  } catch {
    return {
      label,
      passed: false,
      detail: ".gitignore not found",
      hint: "Create .gitignore with: .ralph/logs/ _bmad-output/",
    };
  }
}

async function checkVersionMarker(projectDir: string): Promise<CheckResult> {
  const label = "version marker matches";
  const hint = "Run: bmalph upgrade";
  try {
    const content = await readFile(join(projectDir, ".ralph/ralph_loop.sh"), "utf-8");
    const match = content.match(/# bmalph-version: (.+)/);
    if (!match) {
      return { label, passed: true, detail: "no marker (pre-0.8.0 install)" };
    }
    const { getPackageVersion } = await import("../installer.js");
    const current = getPackageVersion();
    if (match[1].trim() === current) {
      return { label, passed: true, detail: `v${current}` };
    }
    return {
      label,
      passed: false,
      detail: `installed: ${match[1].trim()}, current: ${current}`,
      hint,
    };
  } catch {
    return { label, passed: true, detail: "no marker found" };
  }
}

async function checkUpstreamVersions(projectDir: string): Promise<CheckResult> {
  const label = "upstream versions tracked";
  const hint = "Run: bmalph upgrade";
  try {
    const config = await readConfig(projectDir);
    if (!config) {
      return { label, passed: false, detail: "config not found", hint: "Run: bmalph init" };
    }
    if (!config.upstreamVersions) {
      return { label, passed: true, detail: "not tracked (pre-1.2.0 install)" };
    }
    const bundled = getBundledVersions();
    const { bmadCommit, ralphCommit } = config.upstreamVersions;
    const bmadMatch = bmadCommit === bundled.bmadCommit;
    const ralphMatch = ralphCommit === bundled.ralphCommit;
    if (bmadMatch && ralphMatch) {
      return {
        label,
        passed: true,
        detail: `BMAD:${bmadCommit.slice(0, 8)}, Ralph:${ralphCommit.slice(0, 8)}`,
      };
    }
    const mismatches: string[] = [];
    if (!bmadMatch)
      mismatches.push(`BMAD:${bmadCommit.slice(0, 8)}→${bundled.bmadCommit.slice(0, 8)}`);
    if (!ralphMatch)
      mismatches.push(`Ralph:${ralphCommit.slice(0, 8)}→${bundled.ralphCommit.slice(0, 8)}`);
    return { label, passed: false, detail: `outdated: ${mismatches.join(", ")}`, hint };
  } catch {
    return { label, passed: false, detail: "error reading versions", hint };
  }
}

async function checkCircuitBreaker(projectDir: string): Promise<CheckResult> {
  const label = "circuit breaker";
  const statePath = join(projectDir, ".ralph/.circuit_breaker_state");
  try {
    const content = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(content);
    const state = validateCircuitBreakerState(parsed);
    if (state.state === "CLOSED") {
      return {
        label,
        passed: true,
        detail: `CLOSED (${state.consecutive_no_progress} loops without progress)`,
      };
    }
    if (state.state === "HALF_OPEN") {
      return { label, passed: true, detail: `HALF_OPEN - monitoring` };
    }
    // OPEN state is a failure
    return {
      label,
      passed: false,
      detail: `OPEN - ${state.reason ?? "stagnation detected"}`,
      hint: "Ralph detected stagnation. Review logs with: bmalph status",
    };
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: true, detail: "not running" };
    }
    return {
      label,
      passed: false,
      detail: "corrupt state file",
      hint: "Delete .ralph/.circuit_breaker_state and restart Ralph",
    };
  }
}

async function checkRalphSession(projectDir: string): Promise<CheckResult> {
  const label = "Ralph session";
  const sessionPath = join(projectDir, ".ralph/.ralph_session");
  try {
    const content = await readFile(sessionPath, "utf-8");
    const parsed = JSON.parse(content);
    const session = validateRalphSession(parsed);
    if (!session.session_id || session.session_id === "") {
      return { label, passed: true, detail: "no active session" };
    }
    const createdAt = new Date(session.created_at);
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    // Handle negative age (future timestamp) gracefully
    if (ageMs < 0) {
      return {
        label,
        passed: false,
        detail: "invalid timestamp (future)",
        hint: "Delete .ralph/.ralph_session to reset",
      };
    }
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
    const ageStr = ageHours > 0 ? `${ageHours}h${ageMinutes}m` : `${ageMinutes}m`;

    // Warn if session is older than threshold
    const maxAgeHours = Math.floor(SESSION_AGE_WARNING_MS / (1000 * 60 * 60));
    if (ageMs >= SESSION_AGE_WARNING_MS) {
      return {
        label,
        passed: false,
        detail: `${ageStr} old (max ${maxAgeHours}h)`,
        hint: "Session is stale. Start a fresh Ralph session",
      };
    }
    return { label, passed: true, detail: ageStr };
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: true, detail: "no active session" };
    }
    return {
      label,
      passed: false,
      detail: "corrupt session file",
      hint: "Delete .ralph/.ralph_session to reset",
    };
  }
}

async function checkApiCalls(projectDir: string): Promise<CheckResult> {
  const label = "API calls this hour";
  const statusPath = join(projectDir, RALPH_STATUS_FILE);
  try {
    const content = await readFile(statusPath, "utf-8");
    const parsed = JSON.parse(content);
    const status = validateRalphApiStatus(parsed);
    const calls = status.calls_made_this_hour;
    const max = status.max_calls_per_hour;

    // Avoid division by zero
    if (max <= 0) {
      return { label, passed: true, detail: `${calls}/unlimited` };
    }

    const percentage = (calls / max) * 100;

    // Warn if approaching limit
    if (percentage >= API_USAGE_WARNING_PERCENT) {
      return {
        label,
        passed: false,
        detail: `${calls}/${max} (approaching limit)`,
        hint: "Wait for rate limit reset or increase API quota",
      };
    }
    return { label, passed: true, detail: `${calls}/${max}` };
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: true, detail: "not running" };
    }
    return {
      label,
      passed: false,
      detail: "corrupt status file",
      hint: "Delete .ralph/status.json to reset",
    };
  }
}

async function checkUpstreamGitHubStatus(_projectDir: string): Promise<CheckResult> {
  const label = "upstream status";
  try {
    const bundled = getBundledVersions();
    const result = await checkUpstream(bundled);

    // Check if all requests failed
    if (result.bmad === null && result.ralph === null) {
      const reason = getSkipReason(result.errors);
      return { label, passed: true, detail: `skipped: ${reason}` };
    }

    // Build status string
    const statuses: string[] = [];
    if (result.bmad) {
      statuses.push(`BMAD: ${result.bmad.isUpToDate ? "up to date" : "behind"}`);
    }
    if (result.ralph) {
      statuses.push(`Ralph: ${result.ralph.isUpToDate ? "up to date" : "behind"}`);
    }

    return { label, passed: true, detail: statuses.join(", ") };
  } catch {
    return { label, passed: true, detail: "skipped: error" };
  }
}

function getSkipReason(errors: GitHubError[]): string {
  if (errors.length === 0) return "unknown";
  const types = new Set(errors.map((e) => e.type));
  if (types.has("rate-limit")) return "rate limited";
  if (types.has("network")) return "offline";
  if (types.has("timeout")) return "timeout";
  return "error";
}

// =============================================================================
// Check Registry - defines all checks in execution order
// =============================================================================

/**
 * Registry of all doctor checks in execution order.
 * Each check has a unique ID and a run function that takes a project directory.
 */
export const CHECK_REGISTRY: CheckDefinition[] = [
  { id: "node-version", run: checkNodeVersion },
  { id: "bash-available", run: checkBash },
  { id: "config-valid", run: checkConfig },
  { id: "bmad-dir", run: checkBmadDir },
  { id: "ralph-loop", run: checkRalphLoop },
  { id: "ralph-lib", run: checkRalphLib },
  { id: "slash-command", run: checkSlashCommand },
  { id: "claude-md", run: checkClaudeMd },
  { id: "gitignore", run: checkGitignore },
  { id: "version-marker", run: checkVersionMarker },
  { id: "upstream-versions", run: checkUpstreamVersions },
  { id: "circuit-breaker", run: checkCircuitBreaker },
  { id: "ralph-session", run: checkRalphSession },
  { id: "api-calls", run: checkApiCalls },
  { id: "upstream-github", run: checkUpstreamGitHubStatus },
];
