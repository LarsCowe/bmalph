import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { scaffoldProject, mergeClaudeMd } from "../../src/installer.js";
import { writeConfig, readConfig, type BmalphConfig } from "../../src/utils/config.js";

describe("init flow integration", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-integration-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("full init creates a working project structure", async () => {
    // Simulate what init command does
    await scaffoldProject(testDir);

    const config: BmalphConfig = {
      name: "test-project",
      description: "Integration test project",
      level: 2,
      createdAt: new Date().toISOString(),
    };
    await writeConfig(testDir, config);
    await mergeClaudeMd(testDir);

    // Verify config is readable
    const readBack = await readConfig(testDir);
    expect(readBack).toEqual(config);

    // Verify CLAUDE.md was created
    const claudeMd = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("BMALPH");

    // Verify bmalph.sh exists and is a bash script
    const script = await readFile(join(testDir, "bmalph/bmalph.sh"), "utf-8");
    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("BMALPH Execution Loop");

    // Verify agent files contain personas
    const analyst = await readFile(join(testDir, "bmalph/agents/analyst.md"), "utf-8");
    expect(analyst).toContain("# Analyst Agent");
    expect(analyst).toContain("## Responsibilities");

    const developer = await readFile(join(testDir, "bmalph/agents/developer.md"), "utf-8");
    expect(developer).toContain("TDD");

    // Verify prompt templates exist and have placeholders
    const phase1 = await readFile(join(testDir, "bmalph/prompts/phase-1-iteration.md"), "utf-8");
    expect(phase1).toContain("{{PROJECT_NAME}}");
    expect(phase1).toContain("<phase-complete>");

    // Verify skills are in .claude/skills/
    const mainSkill = await readFile(join(testDir, ".claude/skills/bmalph/SKILL.md"), "utf-8");
    expect(mainSkill).toContain("/bmalph");

    // Verify templates exist
    const prd = await readFile(join(testDir, "bmalph/templates/prd.md"), "utf-8");
    expect(prd).toContain("Product Requirements Document");

    // Verify artifact directories exist
    await expect(access(join(testDir, "bmalph/artifacts/analysis"))).resolves.toBeUndefined();
    await expect(access(join(testDir, "bmalph/artifacts/implementation"))).resolves.toBeUndefined();

    // Verify state directory exists
    await expect(access(join(testDir, "bmalph/state"))).resolves.toBeUndefined();
  });

  it("different scale levels don't affect scaffold structure", async () => {
    // Level 0
    await scaffoldProject(testDir);
    const config0: BmalphConfig = {
      name: "trivial",
      description: "Trivial project",
      level: 0,
      createdAt: new Date().toISOString(),
    };
    await writeConfig(testDir, config0);

    const readBack = await readConfig(testDir);
    expect(readBack!.level).toBe(0);

    // All scaffold files still exist regardless of level
    await expect(access(join(testDir, "bmalph/agents/analyst.md"))).resolves.toBeUndefined();
    await expect(access(join(testDir, "bmalph/prompts/phase-4-iteration.md"))).resolves.toBeUndefined();
  });
});
