import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "..", "..", "..", "bin", "bmalph.js");

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface CliOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Run the bmalph CLI as a subprocess
 */
export async function runCli(args: string[], options: CliOptions = {}): Promise<CliResult> {
  const { cwd = process.cwd(), env = {}, timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timeout after ${timeout}ms`));
    }, timeout);

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Run init with project name and description flags to avoid interactive prompts
 */
export async function runInit(
  cwd: string,
  name = "test-project",
  description = "E2E test project",
  platform?: string
): Promise<CliResult> {
  const args = ["init", "-n", name, "-d", description];
  if (platform) {
    args.push("--platform", platform);
  }
  return runCli(args, { cwd });
}

/**
 * Run init with --dry-run flag
 */
export async function runInitDryRun(cwd: string): Promise<CliResult> {
  return runCli(["init", "-n", "test", "-d", "test", "--dry-run"], { cwd });
}

/**
 * Run upgrade command
 */
export async function runUpgrade(cwd: string): Promise<CliResult> {
  return runCli(["upgrade", "--force"], { cwd });
}

/**
 * Run upgrade with --dry-run flag
 */
export async function runUpgradeDryRun(cwd: string): Promise<CliResult> {
  return runCli(["upgrade", "--dry-run"], { cwd });
}

/**
 * Run doctor command
 */
export async function runDoctor(cwd: string): Promise<CliResult> {
  return runCli(["doctor"], { cwd });
}

/**
 * Run implement command
 */
export async function runImplement(cwd: string, force = false): Promise<CliResult> {
  const args = ["implement"];
  if (force) args.push("--force");
  return runCli(args, { cwd });
}

/**
 * Run reset command with --force to skip confirmation
 */
export async function runReset(cwd: string): Promise<CliResult> {
  return runCli(["reset", "--force"], { cwd });
}

/**
 * Run reset with --dry-run flag
 */
export async function runResetDryRun(cwd: string): Promise<CliResult> {
  return runCli(["reset", "--dry-run"], { cwd });
}

/**
 * Run run command with short timeout (it normally blocks).
 * Used for testing error paths where it exits quickly.
 */
export async function runRun(
  cwd: string,
  options: { driver?: string; noDashboard?: boolean; interval?: number } = {},
  timeout = 10000
): Promise<CliResult> {
  const args = ["run"];
  if (options.driver) args.push("--driver", options.driver);
  if (options.noDashboard) args.push("--no-dashboard");
  if (options.interval) args.push("--interval", String(options.interval));
  return runCli(args, { cwd, timeout });
}

/**
 * Run watch command for a fixed duration then kill the process.
 * Since watch is interactive (no TTY in subprocess → can't send "q"),
 * we kill after durationMs and resolve with captured output.
 */
export async function runWatch(
  cwd: string,
  intervalMs = 500,
  durationMs = 2000
): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, "watch", "--interval", String(intervalMs)], {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let exited = false;

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      if (!exited) {
        child.kill();
      }
    }, durationMs);

    child.on("close", (exitCode) => {
      exited = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode });
    });

    child.on("error", () => {
      exited = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}
