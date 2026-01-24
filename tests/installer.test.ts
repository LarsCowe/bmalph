import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installProject, mergeClaudeMd, isInitialized } from "../src/installer.js";
import { mkdir, rm, access, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("installer", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
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

  describe("installProject", { timeout: 30000 }, () => {
    it("creates bmalph state directory", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, "bmalph/state"))).resolves.toBeUndefined();
    });

    it("copies BMAD files to _bmad/", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, "_bmad/core"))).resolves.toBeUndefined();
      await expect(access(join(testDir, "_bmad/bmm"))).resolves.toBeUndefined();
      await expect(access(join(testDir, "_bmad/bmm/agents"))).resolves.toBeUndefined();
    });

    it("generates _bmad/config.yaml", async () => {
      await installProject(testDir);
      const config = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(config).toContain("platform: claude-code");
      expect(config).toContain("output_dir: _bmad-output");
    });

    it("copies Ralph loop and lib to .ralph/", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, ".ralph/ralph_loop.sh"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/lib/circuit_breaker.sh"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/lib/response_analyzer.sh"))).resolves.toBeUndefined();
    });

    it("copies Ralph templates to .ralph/", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, ".ralph/PROMPT.md"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/@AGENT.md"))).resolves.toBeUndefined();
    });

    it("creates .ralph subdirectories", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, ".ralph/specs"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/logs"))).resolves.toBeUndefined();
    });

    it("updates .gitignore with ralph logs and bmad output", async () => {
      await installProject(testDir);
      const gitignore = await readFile(join(testDir, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".ralph/logs/");
      expect(gitignore).toContain("_bmad-output/");
    });

    it("appends to existing .gitignore without duplicating", async () => {
      await writeFile(join(testDir, ".gitignore"), "node_modules/\n");
      await installProject(testDir);
      const gitignore = await readFile(join(testDir, ".gitignore"), "utf-8");
      expect(gitignore).toContain("node_modules/");
      expect(gitignore).toContain(".ralph/logs/");
      // Run again to verify no duplication
      await installProject(testDir);
      const gitignore2 = await readFile(join(testDir, ".gitignore"), "utf-8");
      const matches = gitignore2.match(/\.ralph\/logs\//g);
      expect(matches).toHaveLength(1);
    });
  });

  describe("mergeClaudeMd", () => {
    it("creates CLAUDE.md if it does not exist", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("## BMAD-METHOD Integration");
    });

    it("appends to existing CLAUDE.md", async () => {
      await writeFile(join(testDir, "CLAUDE.md"), "# My Project\n\nExisting content.\n");
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("## BMAD-METHOD Integration");
    });

    it("does not duplicate on second run", async () => {
      await mergeClaudeMd(testDir);
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      const matches = content.match(/## BMAD-METHOD Integration/g);
      expect(matches).toHaveLength(1);
    });

    it("includes workflow commands", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("bmalph plan");
      expect(content).toContain("bmalph implement");
      expect(content).toContain("bmalph status");
    });
  });
});
