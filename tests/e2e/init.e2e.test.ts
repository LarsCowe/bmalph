import { describe, it, expect, afterEach } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";
import { runInit, runInitDryRun } from "./helpers/cli-runner.js";
import {
  createTestProject,
  createProjectWithClaudeMd,
  createProjectWithGitignore,
  type TestProject,
} from "./helpers/project-scaffold.js";
import {
  expectBmalphInitialized,
  expectFileExists,
  expectFileContains,
  expectFileNotExists,
  expectValidJson,
} from "./helpers/assertions.js";

describe("bmalph init e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("initializes a fresh project with -n and -d flags", async () => {
    project = await createTestProject();

    const result = await runInit(project.path, "my-project", "My description");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("bmalph initialized successfully");
    expect(result.stdout).toContain("my-project");

    await expectBmalphInitialized(project.path);
  });

  it("creates config.json with correct values", async () => {
    project = await createTestProject();

    await runInit(project.path, "test-name", "test-desc");

    const config = (await expectValidJson(
      join(project.path, "bmalph/config.json"),
    )) as Record<string, unknown>;
    expect(config.name).toBe("test-name");
    expect(config.description).toBe("test-desc");
    expect(config.createdAt).toBeDefined();
  });

  it("dry-run shows preview without creating files", async () => {
    project = await createTestProject();

    const result = await runInitDryRun(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[dry-run]");

    // No files should be created
    await expectFileNotExists(join(project.path, "bmalph/config.json"));
    await expectFileNotExists(join(project.path, "_bmad"));
    await expectFileNotExists(join(project.path, ".ralph"));
  });

  it("double init shows warning and does not reinitialize", async () => {
    project = await createTestProject();

    // First init
    const firstResult = await runInit(project.path);
    expect(firstResult.exitCode).toBe(0);

    // Second init
    const secondResult = await runInit(project.path);
    expect(secondResult.exitCode).toBe(0);
    expect(secondResult.stdout).toContain("already initialized");

    // Original structure should be intact
    await expectBmalphInitialized(project.path);
  });

  it("appends to existing CLAUDE.md instead of overwriting", async () => {
    const existingContent = "# My Existing Project\n\nSome documentation.";
    project = await createProjectWithClaudeMd(existingContent);

    await runInit(project.path);

    const claudeMd = await readFile(join(project.path, "CLAUDE.md"), "utf-8");

    // Should contain both existing content and BMAD snippet
    expect(claudeMd).toContain("My Existing Project");
    expect(claudeMd).toContain("Some documentation");
    expect(claudeMd).toContain("BMAD-METHOD");
  });

  it("appends to existing .gitignore instead of overwriting", async () => {
    const existingContent = "node_modules/\n.env\n";
    project = await createProjectWithGitignore(existingContent);

    await runInit(project.path);

    const gitignore = await readFile(join(project.path, ".gitignore"), "utf-8");

    // Should contain both existing entries and new bmalph entries
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".ralph/logs/");
    expect(gitignore).toContain("_bmad-output/");
  });

  it("installs slash command to .claude/commands/", async () => {
    project = await createTestProject();

    await runInit(project.path);

    await expectFileExists(join(project.path, ".claude/commands/bmalph.md"));
    await expectFileContains(
      join(project.path, ".claude/commands/bmalph.md"),
      "bmad-master.agent.yaml",
    );
  });

  it("installs bmalph-implement slash command", async () => {
    project = await createTestProject();

    await runInit(project.path);

    await expectFileExists(
      join(project.path, ".claude/commands/bmalph-implement.md"),
    );
  });

  it("creates _bmad directory with BMAD agents", async () => {
    project = await createTestProject();

    await runInit(project.path);

    await expectFileExists(join(project.path, "_bmad/config.yaml"));
    await expectFileExists(
      join(project.path, "_bmad/bmm/agents/analyst.agent.yaml"),
    );
    await expectFileExists(join(project.path, "_bmad/bmm/agents/pm.agent.yaml"));
    await expectFileExists(
      join(project.path, "_bmad/bmm/agents/architect.agent.yaml"),
    );
  });

  it("creates .ralph directory with ralph loop", async () => {
    project = await createTestProject();

    await runInit(project.path);

    await expectFileExists(join(project.path, ".ralph/ralph_loop.sh"));
    await expectFileExists(join(project.path, ".ralph/lib/circuit_breaker.sh"));
    await expectFileExists(join(project.path, ".ralph/lib/response_analyzer.sh"));

    // Ralph subdirectories
    await expectFileExists(join(project.path, ".ralph/specs"));
    await expectFileExists(join(project.path, ".ralph/logs"));
  });
});
