import { describe, it, expect, afterEach } from "vitest";
import { mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { runInit, runDoctor } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";
import { expectBmalphInitialized } from "./helpers/assertions.js";

describe("bmalph edge cases e2e", { timeout: 60000 }, () => {
  const projects: TestProject[] = [];

  afterEach(async () => {
    for (const project of projects) {
      await project.cleanup();
    }
    projects.length = 0;
  });

  it("handles paths with spaces (Windows)", async () => {
    // Create a directory with spaces in the name
    const pathWithSpaces = join(tmpdir(), `bmalph test with spaces-${Date.now()}`);
    await mkdir(pathWithSpaces, { recursive: true });

    const project: TestProject = {
      path: pathWithSpaces,
      cleanup: async () => {
        const { rm } = await import("fs/promises");
        await rm(pathWithSpaces, { recursive: true, force: true }).catch(() => {});
      },
    };
    projects.push(project);

    const result = await runInit(project.path, "space-project", "Project with spaces");

    expect(result.exitCode).toBe(0);
    await expectBmalphInitialized(project.path);
  });

  it("handles concurrent init in different directories", async () => {
    const project1 = await createTestProject("bmalph-concurrent-1");
    const project2 = await createTestProject("bmalph-concurrent-2");
    const project3 = await createTestProject("bmalph-concurrent-3");

    projects.push(project1, project2, project3);

    // Run all inits concurrently
    const results = await Promise.all([
      runInit(project1.path, "project-1", "First"),
      runInit(project2.path, "project-2", "Second"),
      runInit(project3.path, "project-3", "Third"),
    ]);

    // All should succeed
    for (const result of results) {
      expect(result.exitCode).toBe(0);
    }

    // All should be properly initialized
    await expectBmalphInitialized(project1.path);
    await expectBmalphInitialized(project2.path);
    await expectBmalphInitialized(project3.path);
  });

  it("handles special characters in project name", async () => {
    const project = await createTestProject();
    projects.push(project);

    const result = await runInit(
      project.path,
      "my-project_v2.0",
      "Project with special chars: @#$%"
    );

    expect(result.exitCode).toBe(0);
    await expectBmalphInitialized(project.path);
  });

  it("handles project name with dashes and underscores", async () => {
    const project = await createTestProject();
    projects.push(project);

    const result = await runInit(
      project.path,
      "my-project_v2-beta_test",
      "Project with dashes and underscores"
    );

    expect(result.exitCode).toBe(0);
    await expectBmalphInitialized(project.path);
  });

  it("handles unicode characters in description", async () => {
    const project = await createTestProject();
    projects.push(project);

    const result = await runInit(
      project.path,
      "unicode-project",
      "Project with emoji 🚀 and unicode: café résumé"
    );

    expect(result.exitCode).toBe(0);
    await expectBmalphInitialized(project.path);
  });

  it("doctor works on freshly initialized project", async () => {
    const project = await createTestProject();
    projects.push(project);

    await runInit(project.path);

    // Run doctor immediately after init
    const result = await runDoctor(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("all checks OK");
  });
});
