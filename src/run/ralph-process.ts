import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { RALPH_DIR } from "../utils/constants.js";
import { exists } from "../utils/file-system.js";
import type { RalphProcess, RalphProcessState, ReviewMode } from "./types.js";

const RALPH_LOOP_PATH = `${RALPH_DIR}/ralph_loop.sh`;
const BASH_RALPH_LOOP_PATH = `./${RALPH_LOOP_PATH}`;
const BASH_VALIDATION_TIMEOUT_MS = 3000;
const BASH_COMMAND_TIMEOUT_MS = 15000;
const DEFAULT_WINDOWS_GIT_BASH_PATHS = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe",
] as const;

let cachedBashCommand: string | undefined;
let pendingBashCommand: Promise<string> | undefined;
let cachedBashVersion: string | undefined;
let versionDetected = false;
let pendingBashVersion: Promise<string | undefined> | undefined;

export interface BashCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export async function resolveBashCommand(): Promise<string> {
  if (cachedBashCommand) {
    return cachedBashCommand;
  }

  if (pendingBashCommand) {
    return pendingBashCommand;
  }

  pendingBashCommand = (async () => {
    const candidates = process.platform === "win32" ? getWindowsBashCandidates() : ["bash"];

    for (const candidate of candidates) {
      if (await canExecuteBash(candidate)) {
        cachedBashCommand = candidate;
        return candidate;
      }
    }

    throw new Error(getMissingBashMessage());
  })();

  try {
    return await pendingBashCommand;
  } finally {
    pendingBashCommand = undefined;
  }
}

export async function validateBashAvailable(): Promise<void> {
  await resolveBashCommand();
}

export async function runBashCommand(
  command: string,
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  } = {}
): Promise<BashCommandResult> {
  const bashCommand = await resolveBashCommand();
  const timeoutMs = options.timeoutMs ?? BASH_COMMAND_TIMEOUT_MS;

  return new Promise<BashCommandResult>((resolve, reject) => {
    const child = spawn(bashCommand, ["-lc", command], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      callback();
    };

    const timeoutId = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // Ignore kill failures for already exited processes.
      }

      finish(() => reject(new Error(`bash command timed out: ${command}`)));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) =>
      finish(() =>
        resolve({
          exitCode,
          stdout,
          stderr,
        })
      )
    );

    child.on("error", (error) =>
      finish(() =>
        reject(new Error(`Failed to run bash command: ${error.message}`, { cause: error }))
      )
    );
  });
}

export function parseBashVersion(output: string): string | undefined {
  const match = /version (\d+\.\d+\.\d+)/.exec(output);
  return match?.[1];
}

export async function detectBashVersion(): Promise<string | undefined> {
  if (versionDetected) {
    return cachedBashVersion;
  }

  if (pendingBashVersion) {
    return pendingBashVersion;
  }

  pendingBashVersion = (async () => {
    try {
      const result = await runBashCommand("bash --version");
      cachedBashVersion = parseBashVersion(result.stdout);
    } catch {
      cachedBashVersion = undefined;
    }

    versionDetected = true;
    return cachedBashVersion;
  })();

  try {
    return await pendingBashVersion;
  } finally {
    pendingBashVersion = undefined;
  }
}

export async function validateRalphLoop(projectDir: string): Promise<void> {
  const loopPath = join(projectDir, RALPH_LOOP_PATH);
  if (!(await exists(loopPath))) {
    throw new Error(`${RALPH_LOOP_PATH} not found. Run: bmalph init`);
  }
}

export async function validateGitRepo(projectDir: string): Promise<void> {
  const gitDir = await runBashCommand("git rev-parse --git-dir", { cwd: projectDir });
  if (gitDir.exitCode !== 0) {
    throw new Error(
      "No git repository found. Ralph requires git for progress detection.\n" +
        "Run: git init && git add -A && git commit -m 'initial commit'"
    );
  }

  const head = await runBashCommand("git rev-parse HEAD", { cwd: projectDir });
  if (head.exitCode !== 0) {
    throw new Error(
      "Git repository has no commits. Ralph requires at least one commit for progress detection.\n" +
        "Run: git add -A && git commit -m 'initial commit'"
    );
  }
}

export interface SpawnOptions {
  inheritStdio: boolean;
  reviewMode?: ReviewMode;
}

export function spawnRalphLoop(
  projectDir: string,
  platformId: string,
  options: SpawnOptions
): RalphProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, PLATFORM_DRIVER: platformId };
  if (options.reviewMode) {
    env.REVIEW_MODE = options.reviewMode;
    if (options.reviewMode !== "off") {
      env.REVIEW_ENABLED = "true";
      if (options.reviewMode === "enhanced") {
        env.REVIEW_INTERVAL = "5";
      }
    }
  }

  const child = spawn(cachedBashCommand ?? "bash", [BASH_RALPH_LOOP_PATH], {
    cwd: projectDir,
    env,
    stdio: options.inheritStdio ? "inherit" : ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });

  let state: RalphProcessState = "running";
  let exitCode: number | null = null;
  let exitCallbacks: Array<(code: number | null) => void> = [];
  let exited = false;

  const handleExit = (code: number | null): void => {
    if (exited) return;
    state = "stopped";
    exitCode = code;
    exited = true;
    for (const cb of exitCallbacks) cb(code);
    exitCallbacks = [];
  };

  child.on("close", (code) => handleExit(code));
  child.on("error", () => handleExit(null));

  return {
    get child() {
      return child;
    },
    get state() {
      return state;
    },
    set state(s: RalphProcessState) {
      state = s;
    },
    get exitCode() {
      return exitCode;
    },
    set exitCode(c: number | null) {
      exitCode = c;
    },
    kill() {
      if (process.platform === "win32") {
        terminateWindowsProcess(child);
        return;
      }

      terminateUnixProcessGroup(child);
    },
    detach() {
      child.unref();
      if (child.stdout) child.stdout.destroy();
      if (child.stderr) child.stderr.destroy();
      state = "detached";
    },
    onExit(callback) {
      if (exited) {
        callback(exitCode);
      } else {
        exitCallbacks.push(callback);
      }
    },
  };
}

function getWindowsBashCandidates(): string[] {
  const discoveredPaths: string[] = [];

  try {
    const output = execFileSync("where", ["bash"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });

    for (const line of output.split(/\r?\n/)) {
      const candidate = line.trim();
      if (candidate.length === 0 || isWindowsBashShim(candidate)) {
        continue;
      }
      discoveredPaths.push(candidate);
    }
  } catch {
    // Ignore failed discovery and fall back to common Git Bash locations.
  }

  return uniqueWindowsPaths([...discoveredPaths, ...DEFAULT_WINDOWS_GIT_BASH_PATHS]);
}

function isWindowsBashShim(candidate: string): boolean {
  const normalized = candidate.replaceAll("/", "\\").toLowerCase();
  return (
    normalized.endsWith("\\windows\\system32\\bash.exe") ||
    (normalized.includes("\\windowsapps\\") && normalized.endsWith("\\bash.exe"))
  );
}

function uniqueWindowsPaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const path of paths) {
    const normalized = path.trim();
    if (normalized.length === 0) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function terminateUnixProcessGroup(child: ChildProcess): void {
  if (child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Fall back to the direct child if the process group no longer exists.
    }
  }

  terminateChildProcess(child);
}

function terminateWindowsProcess(child: ChildProcess): void {
  if (typeof child.pid === "number") {
    try {
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    } catch {
      // Fall back when taskkill is unavailable or the process has already exited.
    }
  }

  terminateChildProcess(child);
}

function terminateChildProcess(child: ChildProcess): void {
  try {
    child.kill("SIGTERM");
  } catch {
    // Child already dead — ignore.
  }
}

async function canExecuteBash(command: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, ["--version"], {
      stdio: "ignore",
      windowsHide: true,
    });

    let settled = false;

    const finish = (result: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // Ignore kill failures for already exited processes.
      }
      finish(false);
    }, BASH_VALIDATION_TIMEOUT_MS);

    child.on("close", (code) => finish(code === 0));
    child.on("error", () => finish(false));
  });
}

function getMissingBashMessage(): string {
  return process.platform === "win32"
    ? "bash is not available. Install Git Bash to run Ralph on Windows."
    : "bash is not available. Install bash to run Ralph.";
}
