import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { resolveBashCommand, runBashCommand, detectBashVersion } from "../run/ralph-process.js";
import { readJsonFile } from "../utils/json.js";
import { isEnoent, formatError } from "../utils/errors.js";
import { CONFIG_FILE } from "../utils/constants.js";
import type { CheckResult } from "./doctor.js";

export async function checkCommandAvailable(command: string): Promise<boolean> {
  const { execFileSync } = await import("node:child_process");
  try {
    const bin = process.platform === "win32" ? "where" : "which";
    execFileSync(bin, [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function checkNodeVersion(_projectDir: string): CheckResult {
  const major = parseInt(process.versions.node.split(".")[0]!);
  return {
    label: "Node version >= 20",
    passed: major >= 20,
    detail: major >= 20 ? `v${process.versions.node}` : `got v${process.versions.node}`,
    hint: major >= 20 ? undefined : "Install Node.js 20+ from nodejs.org or run: nvm install 20",
  };
}

export async function checkBash(_projectDir: string): Promise<CheckResult> {
  try {
    await resolveBashCommand();
  } catch (err) {
    return {
      label: "bash available",
      passed: false,
      detail: formatError(err),
      hint:
        process.platform === "win32"
          ? "Install Git Bash and ensure its bash.exe is available: https://git-scm.com/downloads"
          : "Install bash via your package manager (apt, brew, etc.)",
    };
  }

  const version = await detectBashVersion();
  if (!version) {
    return { label: "bash available", passed: true };
  }

  const major = parseInt(version.split(".")[0]!);
  return {
    label: "bash available",
    passed: true,
    detail: `v${version}`,
    hint:
      major < 4
        ? "Bash 4+ recommended for best compatibility. macOS: brew install bash"
        : undefined,
  };
}

export async function checkJq(projectDir: string): Promise<CheckResult> {
  const result = await runBashCommand("command -v jq", { cwd: projectDir });
  const available = result.exitCode === 0;
  return {
    label: "jq available",
    passed: available,
    detail: available ? undefined : "jq not found in bash PATH",
    hint: available
      ? undefined
      : process.platform === "win32"
        ? "Install jq: choco install jq (or: winget install jqlang.jq)"
        : process.platform === "darwin"
          ? "Install jq: brew install jq"
          : "Install jq: sudo apt-get install jq",
  };
}

export async function checkGitRepo(projectDir: string): Promise<CheckResult> {
  const label = "git repository with commits";
  const gitDir = await runBashCommand("git rev-parse --git-dir", { cwd: projectDir });
  if (gitDir.exitCode !== 0) {
    return {
      label,
      passed: false,
      detail: "not a git repository",
      hint: "Run: git init && git add -A && git commit -m 'initial commit'",
    };
  }

  const head = await runBashCommand("git rev-parse HEAD", { cwd: projectDir });
  if (head.exitCode !== 0) {
    return {
      label,
      passed: false,
      detail: "no commits found",
      hint: "Run: git add -A && git commit -m 'initial commit'",
    };
  }

  const branch = await runBashCommand("git branch --show-current", { cwd: projectDir });
  const branchName = branch.stdout.trim();
  return {
    label,
    passed: true,
    detail: branchName ? `branch: ${branchName}` : undefined,
  };
}

export async function checkBmadDir(projectDir: string): Promise<CheckResult> {
  return checkDir(join(projectDir, "_bmad"), "_bmad/ directory present", "Run: bmalph init");
}

export async function checkRalphLoop(projectDir: string): Promise<CheckResult> {
  return checkFileHasContent(
    join(projectDir, ".ralph/ralph_loop.sh"),
    "ralph_loop.sh present and has content",
    "Run: bmalph upgrade"
  );
}

export async function checkRalphLib(projectDir: string): Promise<CheckResult> {
  return checkDir(
    join(projectDir, ".ralph/lib"),
    ".ralph/lib/ directory present",
    "Run: bmalph upgrade"
  );
}

export async function checkConfig(projectDir: string): Promise<CheckResult> {
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

export async function checkDir(
  dirPath: string,
  label: string,
  hint?: string
): Promise<CheckResult> {
  try {
    const s = await stat(dirPath);
    return { label, passed: s.isDirectory() };
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: false, detail: "not found", hint };
    }
    return { label, passed: false, detail: `error: ${formatError(err)}`, hint };
  }
}

export async function checkFileHasContent(
  filePath: string,
  label: string,
  hint?: string
): Promise<CheckResult> {
  try {
    const content = await readFile(filePath, "utf-8");
    return { label, passed: content.trim().length > 0 };
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: false, detail: "not found", hint };
    }
    return { label, passed: false, detail: `error: ${formatError(err)}`, hint };
  }
}
