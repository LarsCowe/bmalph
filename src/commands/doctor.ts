import chalk from "chalk";
import { access, readFile, stat } from "fs/promises";
import { join } from "path";
import { readJsonFile } from "../utils/json.js";

interface CheckResult {
  label: string;
  passed: boolean;
  detail?: string;
}

export async function doctorCommand(): Promise<void> {
  try {
    await runDoctor();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function runDoctor(): Promise<void> {
  const projectDir = process.cwd();
  const results: CheckResult[] = [];

  // 1. Node version
  const major = parseInt(process.versions.node.split(".")[0]);
  results.push({
    label: "Node version >= 20",
    passed: major >= 20,
    detail: major >= 20 ? `v${process.versions.node}` : `got v${process.versions.node}`,
  });

  // 2. bash available
  const bashAvailable = await checkBashAvailable();
  results.push({
    label: "bash available",
    passed: bashAvailable,
    detail: bashAvailable ? undefined : "bash not found in PATH",
  });

  // 3. config.json exists and valid
  const configResult = await checkConfig(projectDir);
  results.push(configResult);

  // 4. _bmad/ directory with expected structure
  const bmadResult = await checkDir(join(projectDir, "_bmad"), "_bmad/ directory present");
  results.push(bmadResult);

  // 5. .ralph/ralph_loop.sh present and has content
  const loopResult = await checkFileHasContent(
    join(projectDir, ".ralph/ralph_loop.sh"),
    "ralph_loop.sh present and has content"
  );
  results.push(loopResult);

  // 6. .ralph/lib/ present
  const libResult = await checkDir(join(projectDir, ".ralph/lib"), ".ralph/lib/ directory present");
  results.push(libResult);

  // 7. .claude/commands/bmalph.md present
  const slashResult = await checkFileExists(
    join(projectDir, ".claude/commands/bmalph.md"),
    ".claude/commands/bmalph.md present"
  );
  results.push(slashResult);

  // 8. CLAUDE.md contains BMAD snippet
  const claudeMdResult = await checkClaudeMd(projectDir);
  results.push(claudeMdResult);

  // 9. .gitignore has required entries
  const gitignoreResult = await checkGitignore(projectDir);
  results.push(gitignoreResult);

  // 10. Version marker check
  const versionResult = await checkVersionMarker(projectDir);
  results.push(versionResult);

  // Output
  console.log(chalk.bold("bmalph doctor\n"));

  for (const r of results) {
    const icon = r.passed ? chalk.green("\u2713") : chalk.red("\u2717");
    const detail = r.detail ? chalk.dim(` (${r.detail})`) : "";
    console.log(`  ${icon} ${r.label}${detail}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log("");

  if (failed === 0) {
    console.log(chalk.green(`${passed} passed, all checks OK`));
  } else {
    console.log(`${chalk.green(`${passed} passed`)}, ${chalk.red(`${failed} failed`)}`);
  }
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

async function checkConfig(projectDir: string): Promise<CheckResult> {
  const path = join(projectDir, "bmalph/config.json");
  try {
    const data = await readJsonFile<unknown>(path);
    if (data === null) {
      return { label: "bmalph/config.json exists and valid", passed: false, detail: "file not found" };
    }
    return { label: "bmalph/config.json exists and valid", passed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    return { label: "bmalph/config.json exists and valid", passed: false, detail: msg };
  }
}

async function checkDir(dirPath: string, label: string): Promise<CheckResult> {
  try {
    const s = await stat(dirPath);
    return { label, passed: s.isDirectory() };
  } catch {
    return { label, passed: false, detail: "not found" };
  }
}

async function checkFileExists(filePath: string, label: string): Promise<CheckResult> {
  try {
    await access(filePath);
    return { label, passed: true };
  } catch {
    return { label, passed: false, detail: "not found" };
  }
}

async function checkFileHasContent(filePath: string, label: string): Promise<CheckResult> {
  try {
    const content = await readFile(filePath, "utf-8");
    return { label, passed: content.trim().length > 0 };
  } catch {
    return { label, passed: false, detail: "not found" };
  }
}

async function checkClaudeMd(projectDir: string): Promise<CheckResult> {
  const label = "CLAUDE.md contains BMAD snippet";
  try {
    const content = await readFile(join(projectDir, "CLAUDE.md"), "utf-8");
    return { label, passed: content.includes("BMAD-METHOD Integration") };
  } catch {
    return { label, passed: false, detail: "CLAUDE.md not found" };
  }
}

async function checkGitignore(projectDir: string): Promise<CheckResult> {
  const label = ".gitignore has required entries";
  const required = [".ralph/logs/", "_bmad-output/"];
  try {
    const content = await readFile(join(projectDir, ".gitignore"), "utf-8");
    const missing = required.filter((e) => !content.includes(e));
    if (missing.length === 0) {
      return { label, passed: true };
    }
    return { label, passed: false, detail: `missing: ${missing.join(", ")}` };
  } catch {
    return { label, passed: false, detail: ".gitignore not found" };
  }
}

async function checkVersionMarker(projectDir: string): Promise<CheckResult> {
  const label = "version marker matches";
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
    return { label, passed: false, detail: `installed: ${match[1].trim()}, current: ${current}` };
  } catch {
    return { label, passed: true, detail: "no marker found" };
  }
}
