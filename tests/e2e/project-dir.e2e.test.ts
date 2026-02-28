import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli, runInit } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";

describe("bmalph -C / --project-dir flag e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("-C flag runs init in the specified directory", async () => {
    project = await createTestProject();

    const result = await runCli(
      ["-C", project.path, "init", "-n", "remote-project", "-d", "Remote test"],
      { cwd: process.cwd() }
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("initialized successfully");
  });

  it("--project-dir flag runs doctor in the specified directory", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runCli(["--project-dir", project.path, "doctor"], {
      cwd: process.cwd(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("all checks OK");
  });

  it("-C flag runs status in the specified directory", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runCli(["-C", project.path, "status", "--json"], {
      cwd: process.cwd(),
    });
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty("phase");
    expect(output).toHaveProperty("phaseName");
  });

  it("-C flag errors on non-existent directory", async () => {
    const nonexistent = join(tmpdir(), `bmalph-nonexistent-${Date.now()}`);
    const result = await runCli(["-C", nonexistent, "status"], {
      cwd: process.cwd(),
    });
    expect(result.exitCode).not.toBe(0);
  });
});
