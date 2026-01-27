import { describe, it, expect, afterEach } from "vitest";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";
import { runInit, runUpgrade, runDoctor } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";
import { expectBmalphInitialized, expectDoctorCheckPassed } from "./helpers/assertions.js";

describe("bmalph workflows e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("init → doctor: all checks pass", async () => {
    project = await createTestProject();

    // Step 1: Init
    const initResult = await runInit(project.path);
    expect(initResult.exitCode).toBe(0);

    // Step 2: Doctor
    const doctorResult = await runDoctor(project.path);
    expect(doctorResult.exitCode).toBe(0);

    // All core checks should pass
    expectDoctorCheckPassed(doctorResult.stdout, "bmalph/config.json exists and valid");
    expectDoctorCheckPassed(doctorResult.stdout, "_bmad/ directory present");
    expectDoctorCheckPassed(doctorResult.stdout, "ralph_loop.sh present and has content");
    expect(doctorResult.stdout).toContain("all checks OK");
  });

  it("init → upgrade → doctor: all checks pass", async () => {
    project = await createTestProject();

    // Step 1: Init
    await runInit(project.path);

    // Step 2: Upgrade
    const upgradeResult = await runUpgrade(project.path);
    expect(upgradeResult.exitCode).toBe(0);

    // Step 3: Doctor
    const doctorResult = await runDoctor(project.path);
    expect(doctorResult.exitCode).toBe(0);
    expect(doctorResult.stdout).toContain("all checks OK");
  });

  it("init → user modifications → upgrade: user data preserved", async () => {
    project = await createTestProject();

    // Step 1: Init
    await runInit(project.path);

    // Step 2: User modifications
    const fixPlanContent = "# User's Fix Plan\n\n- [ ] Implement feature A\n- [x] Setup database\n";
    await writeFile(join(project.path, ".ralph/@fix_plan.md"), fixPlanContent);

    // Step 3: Upgrade
    const upgradeResult = await runUpgrade(project.path);
    expect(upgradeResult.exitCode).toBe(0);

    // Step 4: Verify user data preserved
    const fixPlanAfter = await readFile(join(project.path, ".ralph/@fix_plan.md"), "utf-8");
    expect(fixPlanAfter).toBe(fixPlanContent);

    // Project should still be valid
    await expectBmalphInitialized(project.path);
  });

  it("multiple upgrades are idempotent", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Multiple upgrades
    for (let i = 0; i < 3; i++) {
      const result = await runUpgrade(project.path);
      expect(result.exitCode).toBe(0);
    }

    // Doctor should still pass
    const doctorResult = await runDoctor(project.path);
    expect(doctorResult.stdout).toContain("all checks OK");
  });

  it("full workflow with user modifications between upgrades", async () => {
    project = await createTestProject();

    // Init
    await runInit(project.path);

    // Add user file
    await writeFile(join(project.path, ".ralph/@fix_plan.md"), "Plan v1");

    // First upgrade
    await runUpgrade(project.path);

    // Modify user file
    await writeFile(join(project.path, ".ralph/@fix_plan.md"), "Plan v2");

    // Second upgrade
    await runUpgrade(project.path);

    // Verify latest user content is preserved
    const content = await readFile(join(project.path, ".ralph/@fix_plan.md"), "utf-8");
    expect(content).toBe("Plan v2");

    // Final doctor check
    const doctorResult = await runDoctor(project.path);
    expect(doctorResult.stdout).toContain("all checks OK");
  });
});
