import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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
  description = "E2E test project"
): Promise<CliResult> {
  return runCli(["init", "-n", name, "-d", description], { cwd });
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
