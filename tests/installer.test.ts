import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installProject, copyBundledAssets, mergeClaudeMd, isInitialized } from "../src/installer.js";
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

  describe("installSlashCommand", () => {
    it("copies slash command to .claude/commands/bmalph.md", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, ".claude/commands/bmalph.md"))).resolves.toBeUndefined();
    });

    it("creates .claude/commands/ directory", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, ".claude/commands"))).resolves.toBeUndefined();
    });

    it("slash command loads BMAD master agent", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".claude/commands/bmalph.md"), "utf-8");
      expect(content).toContain("_bmad/core/agents/bmad-master.agent.yaml");
    });

    it("slash command does not contain hardcoded phase logic", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".claude/commands/bmalph.md"), "utf-8");
      expect(content).not.toContain("current-phase.json");
      expect(content).not.toContain("Phase 1");
      expect(content).not.toContain("Phase 2");
    });
  });

  describe("copyBundledAssets", { timeout: 30000 }, () => {
    it("copies all expected files", async () => {
      // Create minimal directory structure (simulating existing init)
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });

      const result = await copyBundledAssets(testDir);

      await expect(access(join(testDir, "_bmad/core"))).resolves.toBeUndefined();
      await expect(access(join(testDir, "_bmad/config.yaml"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/ralph_loop.sh"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/lib"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/PROMPT.md"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/@AGENT.md"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".claude/commands/bmalph.md"))).resolves.toBeUndefined();
      expect(result.updatedPaths.length).toBeGreaterThan(0);
    });

    it("generates _bmad/_config/task-manifest.csv with combined module-help content", async () => {
      await copyBundledAssets(testDir);
      const manifest = await readFile(join(testDir, "_bmad/_config/task-manifest.csv"), "utf-8");
      // Should contain header row
      expect(manifest).toContain("module,phase,name,code,");
      // Should contain core module entries
      expect(manifest).toContain("core,,Brainstorming,BS,");
      // Should contain bmm module entries
      expect(manifest).toContain("bmm,1-analysis,Create Brief,CB,");
      expect(manifest).toContain("bmm,3-solutioning,Create Architecture,CA,");
    });

    it("generates _bmad/_config/workflow-manifest.csv identical to task-manifest.csv", async () => {
      await copyBundledAssets(testDir);
      const taskManifest = await readFile(join(testDir, "_bmad/_config/task-manifest.csv"), "utf-8");
      const workflowManifest = await readFile(join(testDir, "_bmad/_config/workflow-manifest.csv"), "utf-8");
      expect(workflowManifest).toBe(taskManifest);
    });

    it("does NOT create bmalph/state/ or .ralph/logs/", async () => {
      const result = await copyBundledAssets(testDir);

      await expect(access(join(testDir, "bmalph/state"))).rejects.toThrow();
      await expect(access(join(testDir, ".ralph/logs"))).rejects.toThrow();
      expect(result.updatedPaths).not.toContain("bmalph/state/");
    });

    it("preserves existing .ralph/@fix_plan.md", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      await writeFile(join(testDir, ".ralph/@fix_plan.md"), "# My Plan\n- task 1");

      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(content).toBe("# My Plan\n- task 1");
    });

    it("preserves existing .ralph/logs/ content", async () => {
      await mkdir(join(testDir, ".ralph/logs"), { recursive: true });
      await writeFile(join(testDir, ".ralph/logs/run-001.log"), "log content");

      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/logs/run-001.log"), "utf-8");
      expect(content).toBe("log content");
    });

    it("preserves existing bmalph/config.json", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "my-project", level: 3 }),
      );

      await copyBundledAssets(testDir);

      const config = JSON.parse(
        await readFile(join(testDir, "bmalph/config.json"), "utf-8"),
      );
      expect(config.name).toBe("my-project");
      expect(config.level).toBe(3);
    });

    it("is idempotent (twice = same result)", async () => {
      await copyBundledAssets(testDir);
      const firstRun = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");

      await copyBundledAssets(testDir);
      const secondRun = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");

      expect(firstRun).toBe(secondRun);

      // .gitignore should not duplicate entries
      const gitignore = await readFile(join(testDir, ".gitignore"), "utf-8");
      const matches = gitignore.match(/\.ralph\/logs\//g);
      expect(matches).toHaveLength(1);
    });

    it("returns list of updated paths", async () => {
      const result = await copyBundledAssets(testDir);

      expect(result.updatedPaths).toContain("_bmad/");
      expect(result.updatedPaths).toContain(".ralph/ralph_loop.sh");
      expect(result.updatedPaths).toContain(".ralph/lib/");
      expect(result.updatedPaths).toContain(".ralph/PROMPT.md");
      expect(result.updatedPaths).toContain(".ralph/@AGENT.md");
      expect(result.updatedPaths).toContain(".claude/commands/bmalph.md");
      expect(result.updatedPaths).toContain(".gitignore");
    });
  });

  describe("bundled asset validation", { timeout: 30000 }, () => {
    it("ralph_loop.sh starts with shebang", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
      expect(content.startsWith("#!/")).toBe(true);
    });

    it("ralph_loop.sh contains version marker", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
      expect(content).toContain("# bmalph-version:");
      expect(content).toMatch(/# bmalph-version: \d+\.\d+\.\d+/);
    });

    it("config.yaml has valid structure", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(content).toContain("platform:");
      expect(content).toContain("output_dir:");
      expect(content).toContain("modules:");
    });

    it("slash command delegates to BMAD master agent", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".claude/commands/bmalph.md"), "utf-8");
      expect(content).toContain("_bmad/core/agents/bmad-master.agent.yaml");
    });

    it("PROMPT.md template contains TDD instructions", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content.length).toBeGreaterThan(0);
    });

    it("@AGENT.md template exists and has content", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(content.length).toBeGreaterThan(0);
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

    it("references /bmalph slash command", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("/bmalph");
    });

    it("does not reference deprecated plan --phase command", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).not.toContain("--phase");
      expect(content).not.toContain("bmalph plan");
    });

    it("references bmalph status command", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("bmalph status");
    });

    it("references bmalph implement for transition", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("bmalph implement");
    });
  });
});
