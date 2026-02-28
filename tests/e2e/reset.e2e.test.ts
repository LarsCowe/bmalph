import { describe, it, expect, afterEach } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runInit, runReset, runResetDryRun } from "./helpers/cli-runner.js";
import {
  createTestProject,
  createProjectWithClaudeMd,
  type TestProject,
} from "./helpers/project-scaffold.js";
import {
  expectBmalphInitialized,
  expectFileExists,
  expectFileNotExists,
  expectFileContains,
  expectFileNotContains,
  expectDirectoryExists,
} from "./helpers/assertions.js";

describe("bmalph reset e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("reset removes all bmalph directories after init", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await expectBmalphInitialized(project.path);

    const result = await runReset(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Reset complete");

    // All bmalph directories should be gone
    await expectFileNotExists(join(project.path, "_bmad"));
    await expectFileNotExists(join(project.path, ".ralph"));
    await expectFileNotExists(join(project.path, "bmalph"));
  });

  it("reset removes slash commands but preserves user commands", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await expectFileExists(join(project.path, ".claude/commands/bmalph.md"));

    // Create a user command
    await writeFile(
      join(project.path, ".claude/commands/my-custom.md"),
      "My custom command content"
    );

    await runReset(project.path);

    // Bundled commands should be gone
    await expectFileNotExists(join(project.path, ".claude/commands/bmalph.md"));
    await expectFileNotExists(join(project.path, ".claude/commands/bmalph-implement.md"));

    // User command should be preserved
    await expectFileExists(join(project.path, ".claude/commands/my-custom.md"));
    const content = await readFile(join(project.path, ".claude/commands/my-custom.md"), "utf-8");
    expect(content).toBe("My custom command content");
  });

  it("reset preserves _bmad-output directory", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Create _bmad-output with user artifacts
    await mkdir(join(project.path, "_bmad-output"), { recursive: true });
    await writeFile(join(project.path, "_bmad-output/prd.md"), "Product Requirements");

    const result = await runReset(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("_bmad-output/");

    // _bmad-output should still exist
    await expectDirectoryExists(join(project.path, "_bmad-output"));
    await expectFileContains(join(project.path, "_bmad-output/prd.md"), "Product Requirements");
  });

  it("init works after reset (full cycle)", async () => {
    project = await createTestProject();

    // Init
    const initResult = await runInit(project.path);
    expect(initResult.exitCode).toBe(0);
    await expectBmalphInitialized(project.path);

    // Reset
    const resetResult = await runReset(project.path);
    expect(resetResult.exitCode).toBe(0);

    // Init again
    const reinitResult = await runInit(project.path);
    expect(reinitResult.exitCode).toBe(0);
    await expectBmalphInitialized(project.path);
  });

  it("reset --dry-run shows preview without removing files", async () => {
    project = await createTestProject();

    await runInit(project.path);

    const result = await runResetDryRun(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[dry-run]");

    // Files should still exist
    await expectBmalphInitialized(project.path);
  });

  it("reset on non-initialized project shows appropriate message", async () => {
    project = await createTestProject();

    const result = await runReset(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("not initialized");
  });

  it("reset cleans BMAD section from instructions file", async () => {
    const existingContent = "# My Project\n\nProject documentation.\n";
    project = await createProjectWithClaudeMd(existingContent);

    await runInit(project.path);

    // Verify BMAD section was added
    await expectFileContains(join(project.path, "CLAUDE.md"), "BMAD-METHOD Integration");

    await runReset(project.path);

    // CLAUDE.md should still exist but without BMAD section
    await expectFileExists(join(project.path, "CLAUDE.md"));
    await expectFileContains(join(project.path, "CLAUDE.md"), "My Project");
    await expectFileNotContains(join(project.path, "CLAUDE.md"), "BMAD-METHOD Integration");
  });

  it("reset deletes instructions file if it only contained BMAD content", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // CLAUDE.md was created by init (only contains BMAD snippet)
    await expectFileExists(join(project.path, "CLAUDE.md"));

    await runReset(project.path);

    // CLAUDE.md should be deleted since it only had BMAD content
    await expectFileNotExists(join(project.path, "CLAUDE.md"));
  });

  it("reset removes gitignore entries", async () => {
    project = await createTestProject();

    // Create .gitignore with existing content
    await writeFile(join(project.path, ".gitignore"), "node_modules/\n.env\n");

    await runInit(project.path);

    // Verify bmalph entries were added
    await expectFileContains(join(project.path, ".gitignore"), ".ralph/logs/");
    await expectFileContains(join(project.path, ".gitignore"), "_bmad-output/");

    await runReset(project.path);

    // bmalph entries should be gone, user entries preserved
    const gitignore = await readFile(join(project.path, ".gitignore"), "utf-8");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain(".env");
    expect(gitignore).not.toContain(".ralph/logs/");
    expect(gitignore).not.toContain("_bmad-output/");
  });

  it("reset is idempotent", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Reset twice
    const first = await runReset(project.path);
    expect(first.exitCode).toBe(0);

    const second = await runReset(project.path);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("not initialized");
  });
});
