import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scaffoldProject, mergeClaudeMd, isInitialized } from "../src/installer.js";
import { mkdir, rm, access, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("installer", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("isInitialized", () => {
    it("returns false when not initialized", async () => {
      expect(await isInitialized(testDir)).toBe(false);
    });

    it("returns true when config exists", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(join(testDir, "bmalph/config.json"), "{}");
      expect(await isInitialized(testDir)).toBe(true);
    });
  });

  describe("scaffoldProject", () => {
    it("creates directory structure", async () => {
      await scaffoldProject(testDir);

      const dirs = [
        "bmalph/state",
        "bmalph/artifacts/analysis",
        "bmalph/artifacts/planning",
        "bmalph/artifacts/design",
        "bmalph/artifacts/implementation",
        "bmalph/agents",
        "bmalph/prompts",
        "bmalph/templates",
      ];

      for (const dir of dirs) {
        await expect(access(join(testDir, dir))).resolves.toBeUndefined();
      }
    });

    it("copies agent files", async () => {
      await scaffoldProject(testDir);

      const agents = ["analyst.md", "pm.md", "architect.md", "developer.md", "scrum-master.md", "reviewer.md"];
      for (const agent of agents) {
        await expect(access(join(testDir, "bmalph/agents", agent))).resolves.toBeUndefined();
      }
    });

    it("copies skill files", async () => {
      await scaffoldProject(testDir);

      const skills = ["bmalph", "bmalph-analyze", "bmalph-plan", "bmalph-design", "bmalph-implement", "bmalph-quick"];
      for (const skill of skills) {
        await expect(access(join(testDir, `.claude/skills/${skill}/SKILL.md`))).resolves.toBeUndefined();
      }
    });

    it("copies bmalph.sh", async () => {
      await scaffoldProject(testDir);
      await expect(access(join(testDir, "bmalph/bmalph.sh"))).resolves.toBeUndefined();
    });
  });

  describe("mergeClaudeMd", () => {
    it("creates CLAUDE.md if it does not exist", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("## BMALPH Framework");
    });

    it("appends to existing CLAUDE.md", async () => {
      await writeFile(join(testDir, "CLAUDE.md"), "# My Project\n\nExisting content.\n");
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("## BMALPH Framework");
    });

    it("does not duplicate on second run", async () => {
      await mergeClaudeMd(testDir);
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      const matches = content.match(/## BMALPH Framework/g);
      expect(matches).toHaveLength(1);
    });
  });
});
