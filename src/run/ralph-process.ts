import { spawn } from "node:child_process";
import { join } from "node:path";
import { RALPH_DIR } from "../utils/constants.js";
import { exists } from "../utils/file-system.js";
import type { RalphProcess, RalphProcessState } from "./types.js";

const RALPH_LOOP_PATH = `${RALPH_DIR}/ralph_loop.sh`;

export async function validateBashAvailable(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("bash", ["--version"], { stdio: "ignore" });
    child.on("close", () => resolve());
    child.on("error", () => reject(new Error("bash is not available. Install bash to run Ralph.")));
  });
}

export async function validateRalphLoop(projectDir: string): Promise<void> {
  const loopPath = join(projectDir, RALPH_LOOP_PATH);
  if (!(await exists(loopPath))) {
    throw new Error(`${RALPH_LOOP_PATH} not found. Run: bmalph init`);
  }
}

export function spawnRalphLoop(
  projectDir: string,
  platformId: string,
  options: { inheritStdio: boolean }
): RalphProcess {
  const loopPath = join(projectDir, RALPH_LOOP_PATH);
  const child = spawn("bash", [loopPath], {
    cwd: projectDir,
    env: { ...process.env, PLATFORM_DRIVER: platformId },
    stdio: options.inheritStdio ? "inherit" : ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  let state: RalphProcessState = "running";
  let exitCode: number | null = null;
  let exitCallbacks: Array<(code: number | null) => void> = [];
  let exited = false;

  child.on("close", (code) => {
    state = "stopped";
    exitCode = code;
    exited = true;
    for (const cb of exitCallbacks) cb(code);
    exitCallbacks = [];
  });

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
      if (process.platform !== "win32" && child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          try {
            child.kill("SIGTERM");
          } catch {
            // Child already dead — ignore
          }
        }
      } else {
        child.kill("SIGTERM");
      }
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
