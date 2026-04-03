import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli, runInit, type CliResult } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "..", "..", "bin", "bmalph.js");

/**
 * Runs CLI, kills it after durationMs, and resolves with captured output.
 * Unlike runCli, this does NOT reject on timeout — it resolves with whatever was captured.
 */
function runCliWithKill(args: string[], cwd: string, durationMs: number): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let exited = false;

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      if (!exited) child.kill();
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

function gitCommit(cwd: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "--quiet", "-m", message], { cwd, stdio: "ignore" });
}

function gitInRepo(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Sets up a fully initialized bmalph project with a fix plan, all committed.
 */
async function setupSwarmProject(project: TestProject, epicCount: number): Promise<void> {
  await runInit(project.path, "swarm-test", "E2E swarm test");
  // Commit init output first so tree is clean
  gitCommit(project.path, "bmalph init");

  const fixPlanLines = ["# Ralph Fix Plan", "", "## Stories to Implement", ""];
  for (let i = 1; i <= epicCount; i++) {
    fixPlanLines.push(
      `### Epic ${i}: Feature ${i}`,
      `> Goal: Implement feature ${i}`,
      "",
      `- [ ] Story ${i}.1: Build feature ${i}`,
      `  > As a user, I want feature ${i}`,
      `  > AC: Given setup, When action, Then result`,
      `  > Spec: specs/planning-artifacts/stories.md#story-${i}-1`,
      ""
    );
  }
  fixPlanLines.push("## Completed", "", "## Notes", "- Follow TDD methodology", "");

  await mkdir(join(project.path, ".ralph"), { recursive: true });
  await writeFile(join(project.path, ".ralph/@fix_plan.md"), fixPlanLines.join("\n"));
  gitCommit(project.path, "add fix plan with epics");
}

describe("bmalph run --swarm e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      try {
        const output = gitInRepo(project.path, "worktree", "list", "--porcelain");
        const worktreePaths = output
          .split("\n")
          .filter((l) => l.startsWith("worktree "))
          .map((l) => l.slice("worktree ".length))
          .filter((p) => p !== project!.path);
        for (const wt of worktreePaths) {
          try {
            execFileSync("git", ["worktree", "remove", "--force", wt], {
              cwd: project.path,
              stdio: "ignore",
            });
          } catch {
            // best effort
          }
        }
        execFileSync("git", ["worktree", "prune"], { cwd: project.path, stdio: "ignore" });
      } catch (err) {
        console.warn(`[afterEach] worktree cleanup: ${err}`);
      }
      await project.cleanup();
      project = null;
    }
  });

  // ─── Validation error paths ───────────────────────────────────────────

  it("exits with error when project is not initialized", async () => {
    project = await createTestProject("bmalph-swarm-e2e");

    const result = await runCli(["run", "--swarm"], { cwd: project.path });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not initialized");
  });

  it("exits with error when no fix plan exists", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await runInit(project.path, "swarm-test", "test");
    gitCommit(project.path, "bmalph init");

    const result = await runCli(["run", "--swarm", "--no-dashboard", "--no-review"], {
      cwd: project.path,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("fix plan");
  });

  it("exits with error when only one epic", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await setupSwarmProject(project, 1);

    const result = await runCli(["run", "--swarm", "--no-dashboard", "--no-review"], {
      cwd: project.path,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("at least 2");
  });

  it("exits with error when working tree is dirty", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await setupSwarmProject(project, 2);
    await writeFile(join(project.path, "uncommitted.txt"), "dirty");

    const result = await runCli(["run", "--swarm", "--no-dashboard", "--no-review"], {
      cwd: project.path,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("clean working tree");
  });

  it("exits with error for invalid swarm count", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await setupSwarmProject(project, 2);

    const result = await runCli(["run", "--swarm", "abc", "--no-dashboard", "--no-review"], {
      cwd: project.path,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid swarm count");
  });

  it("exits with error for zero swarm count", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await setupSwarmProject(project, 2);

    const result = await runCli(["run", "--swarm", "0", "--no-dashboard", "--no-review"], {
      cwd: project.path,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid swarm count");
  });

  it("exits with error for instructions-only platform with --swarm", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await runInit(project.path, "swarm-test", "test", "windsurf");
    gitCommit(project.path, "bmalph init");

    const result = await runCli(["run", "--swarm", "--no-dashboard", "--no-review"], {
      cwd: project.path,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("full-tier");
  });

  // ─── CLI parsing ──────────────────────────────────────────────────────

  it("accepts --swarm without a count and gets past validation", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await setupSwarmProject(project, 2);

    // Swarm passes validation and tries to spawn workers.
    // Workers block on ralph_loop.sh, so the CLI will be killed by timeout.
    // We capture output before the kill to verify swarm started correctly.
    const result = await runCliWithKill(
      ["run", "--swarm", "--no-dashboard", "--no-review"],
      project.path,
      5000
    );

    // Should NOT fail on validation
    expect(result.stderr).not.toContain("Invalid swarm count");
    expect(result.stderr).not.toContain("not initialized");
    expect(result.stderr).not.toContain("clean working tree");
    // Should contain swarm startup output
    expect(result.stdout).toContain("Swarm:");
  });

  it("accepts --swarm with explicit count", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await setupSwarmProject(project, 3);

    const result = await runCliWithKill(
      ["run", "--swarm", "3", "--no-dashboard", "--no-review"],
      project.path,
      5000
    );

    expect(result.stderr).not.toContain("Invalid swarm count");
    expect(result.stderr).not.toContain("at least 2");
    expect(result.stdout).toContain("Swarm:");
  });

  // ─── Orphan cleanup ───────────────────────────────────────────────────

  it("cleans up orphaned worktrees from previous runs", async () => {
    project = await createTestProject("bmalph-swarm-e2e");
    await setupSwarmProject(project, 2);

    // Simulate a crashed previous run
    execFileSync(
      "git",
      ["worktree", "add", join(project.path, ".swarm/worker-1"), "-b", "swarm/worker-1", "HEAD"],
      { cwd: project.path, stdio: "ignore" }
    );

    const before = gitInRepo(project.path, "worktree", "list", "--porcelain");
    expect(before).toContain("worker-1");

    // Run swarm — it cleans orphans, creates new worktrees, then blocks on spawn.
    // We kill it after a short time and verify the orphan was handled.
    const result = await runCliWithKill(
      ["run", "--swarm", "--no-dashboard", "--no-review"],
      project.path,
      5000
    );

    // The key test: swarm didn't crash with "branch already exists"
    expect(result.stderr).not.toContain("already exists");
    expect(result.stdout).toContain("Swarm:");
  });
});
