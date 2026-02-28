import { describe, it, expect, afterEach } from "vitest";
import { runCli, runInit } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";

describe("bmalph status e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("status --json outputs valid JSON with expected fields", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runCli(["status", "--json"], { cwd: project.path });
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty("phase");
    expect(output).toHaveProperty("phaseName");
    expect(output).toHaveProperty("status");
    expect(typeof output.phase).toBe("number");
    expect(typeof output.phaseName).toBe("string");
    expect(typeof output.status).toBe("string");
  });

  it("status --json reflects planning phase on fresh project", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runCli(["status", "--json"], { cwd: project.path });
    const output = JSON.parse(result.stdout);

    expect(output.phase).toBe(1);
    expect(output.status).toBe("planning");
  });

  it("status fails gracefully on uninitialized project", async () => {
    project = await createTestProject();

    const result = await runCli(["status"], { cwd: project.path });
    expect(result.stdout).toContain("not initialized");
  });
});
