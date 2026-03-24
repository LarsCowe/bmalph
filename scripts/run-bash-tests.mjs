#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASH_TEST_DIRECTORIES = ["tests/bash", "tests/bash/drivers"];
const BASH_NORMALIZATION_ROOTS = ["tests/bash", "ralph", "scripts"];
const BASH_TEXT_FILE_PATTERN = /\.(?:bash|bats|sh)$/;
const USE_WINDOWS_SHELL = process.platform === "win32";

function isNodeErrorWithCode(value) {
  return Boolean(value && typeof value === "object" && "code" in value);
}

function quoteForBash(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

function quoteForWindowsShell(value) {
  if (!/[ \t"&|<>^]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function spawnBash(args, options) {
  if (!USE_WINDOWS_SHELL) {
    return spawn("bash", args, options);
  }

  const commandLine = ["bash", ...args.map((arg) => quoteForWindowsShell(arg))].join(" ");
  return spawn(commandLine, { ...options, shell: true });
}

function spawnInBash(command, options) {
  return spawnBash(["-lc", command], options);
}

function isBashAvailable() {
  return new Promise((resolve) => {
    const child = spawnBash(["--version"], { stdio: "ignore" });

    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function isToolAvailableInBash(command) {
  return new Promise((resolve) => {
    const child = spawnInBash(`command -v ${command} >/dev/null 2>&1`, { stdio: "ignore" });

    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function getBatsCommand() {
  if (await isToolAvailableInBash("bats")) return "bats";
  return new Promise((resolve) => {
    const child = spawnInBash("npx --no-install bats --version >/dev/null 2>&1", {
      stdio: "ignore",
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 ? "npx bats" : null));
  });
}

async function listBatsFiles(projectDir) {
  const batsFiles = [];

  for (const relativeDir of BASH_TEST_DIRECTORIES) {
    const absoluteDir = join(projectDir, relativeDir);
    let entries;

    try {
      entries = await readdir(absoluteDir, { withFileTypes: true });
    } catch (error) {
      if (isNodeErrorWithCode(error) && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    const filesInDirectory = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".bats"))
      .map((entry) => `${relativeDir}/${entry.name}`)
      .sort();

    batsFiles.push(...filesInDirectory);
  }

  return batsFiles;
}

async function normalizeBashLineEndings(dir) {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isNodeErrorWithCode(error) && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await normalizeBashLineEndings(absolutePath);
      continue;
    }

    if (!BASH_TEXT_FILE_PATTERN.test(entry.name)) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    const normalized = content.replace(/\r\n/g, "\n");
    if (normalized !== content) {
      originalContents.set(absolutePath, content);
      await writeFile(absolutePath, normalized, "utf8");
    }
  }
}

const originalContents = new Map();

async function restoreOriginalLineEndings() {
  for (const [filePath, content] of originalContents) {
    await writeFile(filePath, content, "utf8");
  }
  originalContents.clear();
}

function getBatsVersion(batsCmd) {
  return new Promise((resolve) => {
    const child = spawnInBash(`${batsCmd} --version`, { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.on("error", () => resolve(null));
    child.on("close", () => {
      const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
      resolve(match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null);
    });
  });
}

async function getParallelFlags(batsCmd) {
  // --jobs requires BATS 1.7.0+; skip on Windows (fork overhead makes it worse)
  if (USE_WINDOWS_SHELL) return "";

  const version = await getBatsVersion(batsCmd);
  if (!version || version[0] < 1 || (version[0] === 1 && version[1] < 7)) return "";

  const { cpus } = await import("node:os");
  const jobs = Math.min(cpus().length, 4);
  return `--jobs ${jobs} --no-parallelize-within-files`;
}

function runBats(batsCmd, files, parallelFlags) {
  return new Promise((resolve, reject) => {
    const flags = parallelFlags ? `${parallelFlags} ` : "";
    const child = spawnInBash(
      `${batsCmd} ${flags}${files.map((file) => quoteForBash(file)).join(" ")}`,
      { stdio: "inherit" }
    );

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main() {
  try {
    if (!(await isBashAvailable())) {
      process.stdout.write("[skip] bash not installed\n");
      return 0;
    }

    if (USE_WINDOWS_SHELL) {
      for (const root of BASH_NORMALIZATION_ROOTS) {
        await normalizeBashLineEndings(join(process.cwd(), root));
      }
    }

    const batsCmd = await getBatsCommand();
    if (!batsCmd) {
      process.stdout.write(
        "[skip] bats not installed (install bats-core or ensure npx is available)\n"
      );
      return 0;
    }

    if (!(await isToolAvailableInBash("jq"))) {
      process.stdout.write("[skip] jq not installed\n");
      return 0;
    }

    const batsFiles = await listBatsFiles(process.cwd());
    if (batsFiles.length === 0) {
      process.stdout.write("[skip] no bash test files found\n");
      return 0;
    }

    const parallelFlags = await getParallelFlags(batsCmd);
    if (parallelFlags) {
      process.stdout.write(`[info] parallel mode: ${parallelFlags}\n`);
    }

    return runBats(batsCmd, batsFiles, parallelFlags);
  } finally {
    await restoreOriginalLineEndings();
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to run bash tests: ${message}\n`);
  process.exitCode = 1;
}
