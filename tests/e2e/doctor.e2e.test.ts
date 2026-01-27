import { describe, it, expect, afterEach } from "vitest";
import { rm } from "fs/promises";
import { join } from "path";
import { runInit, runDoctor } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";
import { expectDoctorCheckPassed, expectDoctorCheckFailed } from "./helpers/assertions.js";

describe("bmalph doctor e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("reports all checks on healthy project", async () => {
    project = await createTestProject();

    await runInit(project.path);
    const result = await runDoctor(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("bmalph doctor");

    // Core checks should pass
    expectDoctorCheckPassed(result.stdout, "Node version >= 20");
    expectDoctorCheckPassed(result.stdout, "bmalph/config.json exists and valid");
    expectDoctorCheckPassed(result.stdout, "_bmad/ directory present");
    expectDoctorCheckPassed(result.stdout, "ralph_loop.sh present and has content");
    expectDoctorCheckPassed(result.stdout, ".ralph/lib/ directory present");
    expectDoctorCheckPassed(result.stdout, ".claude/commands/bmalph.md present");
    expectDoctorCheckPassed(result.stdout, "CLAUDE.md contains BMAD snippet");
    expectDoctorCheckPassed(result.stdout, ".gitignore has required entries");
  });

  it("shows summary with passed count", async () => {
    project = await createTestProject();

    await runInit(project.path);
    const result = await runDoctor(project.path);

    // Should show passed count and "all checks OK"
    expect(result.stdout).toMatch(/\d+ passed/);
    expect(result.stdout).toContain("all checks OK");
  });

  it("fails config check when config.json is missing", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Remove config.json
    await rm(join(project.path, "bmalph/config.json"));

    const result = await runDoctor(project.path);

    expect(result.exitCode).toBe(1); // Doctor exits 1 when checks fail
    expectDoctorCheckFailed(result.stdout, "bmalph/config.json exists and valid");
  });

  it("fails _bmad check when directory is missing", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Remove _bmad directory
    await rm(join(project.path, "_bmad"), { recursive: true, force: true });

    const result = await runDoctor(project.path);

    expect(result.exitCode).toBe(1); // Doctor exits 1 when checks fail
    expectDoctorCheckFailed(result.stdout, "_bmad/ directory present");
  });

  it("fails ralph_loop.sh check when file is missing", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Remove ralph_loop.sh
    await rm(join(project.path, ".ralph/ralph_loop.sh"));

    const result = await runDoctor(project.path);

    expect(result.exitCode).toBe(1); // Doctor exits 1 when checks fail
    expectDoctorCheckFailed(result.stdout, "ralph_loop.sh present and has content");
  });

  it("exits with code 1 when checks fail on uninitialized project", async () => {
    project = await createTestProject();

    // Run doctor on empty project (nothing initialized)
    const result = await runDoctor(project.path);

    // Should exit 1 - doctor reports failures with proper exit code
    expect(result.exitCode).toBe(1);

    // Multiple checks should fail
    expectDoctorCheckFailed(result.stdout, "bmalph/config.json exists and valid");
    expectDoctorCheckFailed(result.stdout, "_bmad/ directory present");
    expectDoctorCheckFailed(result.stdout, "ralph_loop.sh present and has content");
  });
});
