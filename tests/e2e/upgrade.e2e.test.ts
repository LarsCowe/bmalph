import { describe, it, expect, afterEach } from "vitest";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { runInit, runUpgrade, runUpgradeDryRun } from "./helpers/cli-runner.js";
import {
  createTestProject,
  type TestProject,
} from "./helpers/project-scaffold.js";
import {
  expectBmalphInitialized,
  expectFileExists,
  expectFileContains,
  expectValidJson,
} from "./helpers/assertions.js";

describe("bmalph upgrade e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("upgrade succeeds after init", async () => {
    project = await createTestProject();

    await runInit(project.path);
    const result = await runUpgrade(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Upgrade complete");
    await expectBmalphInitialized(project.path);
  });

  it("upgrade preserves bmalph/config.json", async () => {
    project = await createTestProject();

    await runInit(project.path, "preserved-name", "preserved-desc");

    // Verify config exists with our values
    const configBefore = (await expectValidJson(
      join(project.path, "bmalph/config.json"),
    )) as Record<string, unknown>;
    expect(configBefore.name).toBe("preserved-name");

    await runUpgrade(project.path);

    // Config should still have original values
    const configAfter = (await expectValidJson(
      join(project.path, "bmalph/config.json"),
    )) as Record<string, unknown>;
    expect(configAfter.name).toBe("preserved-name");
    expect(configAfter.description).toBe("preserved-desc");
  });

  it("upgrade preserves user files in .ralph/", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Create user files that should be preserved
    const fixPlanContent = "# My Fix Plan\n- [ ] Task 1\n- [x] Task 2\n";
    await writeFile(join(project.path, ".ralph/@fix_plan.md"), fixPlanContent);

    await mkdir(join(project.path, ".ralph/specs"), { recursive: true });
    const specsContent = "# Specs changelog\n- Feature A added";
    await writeFile(
      join(project.path, ".ralph/specs/changelog.md"),
      specsContent,
    );

    await mkdir(join(project.path, ".ralph/logs"), { recursive: true });
    const logsContent = "Session log entry";
    await writeFile(join(project.path, ".ralph/logs/session.log"), logsContent);

    await runUpgrade(project.path);

    // All user files should be preserved
    const fixPlanAfter = await readFile(
      join(project.path, ".ralph/@fix_plan.md"),
      "utf-8",
    );
    expect(fixPlanAfter).toBe(fixPlanContent);

    const specsAfter = await readFile(
      join(project.path, ".ralph/specs/changelog.md"),
      "utf-8",
    );
    expect(specsAfter).toBe(specsContent);

    const logsAfter = await readFile(
      join(project.path, ".ralph/logs/session.log"),
      "utf-8",
    );
    expect(logsAfter).toBe(logsContent);
  });

  it("upgrade without init fails gracefully", async () => {
    project = await createTestProject();

    const result = await runUpgrade(project.path);

    expect(result.exitCode).toBe(0); // Doesn't crash
    expect(result.stdout).toContain("not initialized");
  });

  it("upgrade with --dry-run shows preview without changes", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Get current ralph_loop.sh content
    const contentBefore = await readFile(
      join(project.path, ".ralph/ralph_loop.sh"),
      "utf-8",
    );

    const result = await runUpgradeDryRun(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[dry-run]");

    // Content should be unchanged
    const contentAfter = await readFile(
      join(project.path, ".ralph/ralph_loop.sh"),
      "utf-8",
    );
    expect(contentAfter).toBe(contentBefore);
  });

  it("upgrade updates version marker in ralph_loop.sh", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await runUpgrade(project.path);

    await expectFileContains(
      join(project.path, ".ralph/ralph_loop.sh"),
      "# bmalph-version:",
    );
  });

  it("upgrade refreshes BMAD agents", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Verify agent files exist after upgrade
    await runUpgrade(project.path);

    await expectFileExists(
      join(project.path, "_bmad/bmm/agents/analyst.agent.yaml"),
    );
    await expectFileExists(join(project.path, "_bmad/bmm/agents/pm.agent.yaml"));
    await expectFileExists(
      join(project.path, "_bmad/bmm/agents/architect.agent.yaml"),
    );
  });

  it("multiple upgrades are idempotent", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Create user file
    const userContent = "User's custom content";
    await writeFile(join(project.path, ".ralph/@fix_plan.md"), userContent);

    // Multiple upgrades
    await runUpgrade(project.path);
    await runUpgrade(project.path);
    await runUpgrade(project.path);

    // User file should still be preserved
    const afterMultiple = await readFile(
      join(project.path, ".ralph/@fix_plan.md"),
      "utf-8",
    );
    expect(afterMultiple).toBe(userContent);

    // Project should still be valid
    await expectBmalphInitialized(project.path);
  });
});
