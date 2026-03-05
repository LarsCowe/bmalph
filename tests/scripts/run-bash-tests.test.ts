import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

interface ScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, "..", "..", "scripts", "run-bash-tests.mjs");

function executableName(command: string): string {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

async function createFakeBash(binDir: string): Promise<void> {
  const filePath = join(binDir, executableName("bash"));
  if (process.platform === "win32") {
    const helperPath = join(binDir, "bash-helper.cjs");
    await writeFile(
      helperPath,
      `const { appendFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const args = process.argv.slice(2);
const binDir = __dirname;

if (args[0] === "--version") {
  process.exit(0);
}

if (args[0] !== "-lc") {
  process.exit(1);
}

const command = args[1] ?? "";
const toolMatch = /command -v (\\w+)/.exec(command);
if (toolMatch) {
  const tool = toolMatch[1];
  process.exit(existsSync(join(binDir, tool)) || existsSync(join(binDir, tool + ".cmd")) ? 0 : 1);
}

if (!command.startsWith("bats ")) {
  process.exit(1);
}

const parsedArgs = Array.from(command.matchAll(/'([^']*)'|"([^"]*)"|(\\S+)/g), (match) => match[1] ?? match[2] ?? match[3]);
parsedArgs.shift();

if (process.env.BMALPH_BATS_LOG) {
  appendFileSync(process.env.BMALPH_BATS_LOG, parsedArgs.join(" ") + "\\n");
}

process.exit(Number(process.env.BMALPH_FAKE_BATS_EXIT_CODE ?? "0"));
`,
      "utf8"
    );
    await writeFile(
      filePath,
      `@echo off\r\n"${process.execPath}" "%~dp0bash-helper.cjs" %*\r\nexit /b %errorlevel%\r\n`,
      "utf8"
    );
    return;
  }

  await writeFile(
    filePath,
    `#!/bin/sh
bin_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ "$1" = "--version" ]; then
  exit 0
fi

if [ "$1" != "-lc" ]; then
  exit 1
fi

command=$2
if [ "\${command#command -v }" != "$command" ] && [ "\${command% >/dev/null 2>&1}" != "$command" ]; then
  tool=\${command#command -v }
  tool=\${tool% >/dev/null 2>&1}
  if [ -f "$bin_dir/$tool" ] || [ -f "$bin_dir/$tool.cmd" ]; then
    exit 0
  fi
  exit 1
fi

case "$command" in
  bats *)
    if [ -n "$BMALPH_BATS_LOG" ]; then
      printf '%s\\n' "$command" >> "$BMALPH_BATS_LOG"
    fi
    exit "\${BMALPH_FAKE_BATS_EXIT_CODE:-0}"
    ;;
esac

exit 1
`,
    "utf8"
  );
  await chmod(filePath, 0o755);
}

async function createFakeBats(binDir: string, exitCode: number): Promise<void> {
  const filePath = join(binDir, executableName("bats"));
  if (process.platform === "win32") {
    await writeFile(
      filePath,
      `@echo off\r\nif "%~1"=="--version" exit /b 0\r\nif not "%BMALPH_BATS_LOG%"=="" echo %*>>"%BMALPH_BATS_LOG%"\r\nexit /b ${exitCode}\r\n`,
      "utf8"
    );
    return;
  }

  await writeFile(
    filePath,
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  exit 0
fi
if [ -n "$BMALPH_BATS_LOG" ]; then
  echo "$*" >> "$BMALPH_BATS_LOG"
fi
exit ${exitCode}
`,
    "utf8"
  );
  await chmod(filePath, 0o755);
}

async function createShellOnlyBats(binDir: string): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  await writeFile(join(binDir, "bats"), "# bash-only bats marker\n", "utf8");
}

async function createFakeJq(binDir: string): Promise<void> {
  const filePath = join(binDir, executableName("jq"));
  if (process.platform === "win32") {
    await writeFile(filePath, "@echo off\r\nexit /b 0\r\n", "utf8");
    return;
  }

  await writeFile(filePath, "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(filePath, 0o755);
}

function runScript(cwd: string, env: NodeJS.ProcessEnv): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const normalizedEnv =
      process.platform === "win32" && env.PATH ? { ...env, Path: env.Path ?? env.PATH } : env;

    const child = spawn(process.execPath, [SCRIPT_PATH], {
      cwd,
      env: normalizedEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

describe("run-bash-tests script", () => {
  let testDir: string;
  let fakeBinDir: string;
  let batsLogPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-bash-tests-${Date.now()}`);
    fakeBinDir = join(testDir, "bin");
    batsLogPath = join(testDir, "bats.log");

    await mkdir(fakeBinDir, { recursive: true });
    await mkdir(join(testDir, "tests", "bash", "drivers"), { recursive: true });
    await writeFile(join(testDir, "tests", "bash", "suite.bats"), "#!/usr/bin/env bats", "utf8");
    await writeFile(
      join(testDir, "tests", "bash", "drivers", "driver-suite.bats"),
      "#!/usr/bin/env bats",
      "utf8"
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("skips when bash is unavailable", async () => {
    const result = await runScript(testDir, {
      ...process.env,
      PATH: fakeBinDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[skip] bash not installed");
  });

  it("skips when bats is unavailable", async () => {
    await createFakeBash(fakeBinDir);

    const result = await runScript(testDir, {
      ...process.env,
      PATH: fakeBinDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[skip] bats not installed");
  });

  it("returns the bats exit code when bash and bats are available", async () => {
    await createFakeBash(fakeBinDir);
    await createFakeBats(fakeBinDir, 17);
    await createFakeJq(fakeBinDir);

    const result = await runScript(testDir, {
      ...process.env,
      BMALPH_BATS_LOG: batsLogPath,
      BMALPH_FAKE_BATS_EXIT_CODE: "17",
      PATH: fakeBinDir,
    });

    expect(result.exitCode).toBe(17);
    const batsArgs = await readFile(batsLogPath, "utf8");
    expect(batsArgs).toContain("tests");
  });

  it("skips when jq is unavailable", async () => {
    await createFakeBash(fakeBinDir);
    await createFakeBats(fakeBinDir, 17);

    const result = await runScript(testDir, {
      ...process.env,
      PATH: fakeBinDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[skip] jq not installed");
  });

  it("uses bash resolution for bats on Windows when no bats.cmd shim exists", async () => {
    if (process.platform !== "win32") {
      return;
    }

    await createFakeBash(fakeBinDir);
    await createShellOnlyBats(fakeBinDir);
    await createFakeJq(fakeBinDir);

    const result = await runScript(testDir, {
      ...process.env,
      BMALPH_BATS_LOG: batsLogPath,
      BMALPH_FAKE_BATS_EXIT_CODE: "23",
      PATH: fakeBinDir,
    });

    expect(result.exitCode).toBe(23);
    const batsArgs = await readFile(batsLogPath, "utf8");
    expect(batsArgs).toContain("tests/bash/suite.bats");
    expect(batsArgs).toContain("tests/bash/drivers/driver-suite.bats");
  });
});
