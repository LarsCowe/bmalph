import { describe, it, expect, afterEach } from "vitest";
import { runInit, runRun } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";

describe("bmalph run e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("exits with error when project is not initialized", async () => {
    project = await createTestProject();

    const result = await runRun(project.path);

    expect(result.stderr).toContain("not initialized");
    expect(result.exitCode).toBe(1);
  });

  it("exits with error for instructions-only platform", async () => {
    project = await createTestProject();
    await runInit(project.path, "test-project", "test", "cursor");

    const result = await runRun(project.path);

    expect(result.stderr).toContain("full-tier");
    expect(result.exitCode).toBe(1);
  });

  it("exits with error for unknown --driver value", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runRun(project.path, { driver: "nonexistent" });

    expect(result.stderr).toContain("Unknown platform");
    expect(result.exitCode).toBe(1);
  });

  it("exits with error for invalid interval", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runRun(project.path, { interval: 100 });

    expect(result.stderr).toContain("500");
    expect(result.exitCode).toBe(1);
  });
});
