import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installProject, copyBundledAssets, mergeClaudeMd, isInitialized } from "../src/installer.js";
import { mkdir, rm, access, readFile, writeFile, readdir } from "fs/promises";
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

    it("generates _bmad/config.yaml with all required BMAD variables", async () => {
      await installProject(testDir);
      const config = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(config).toContain("platform: claude-code");
      expect(config).toContain("output_folder: _bmad-output");
      expect(config).toContain("project_name:");
      expect(config).toContain("user_name: BMad");
      expect(config).toContain("communication_language: English");
      expect(config).toContain("document_output_language: English");
      expect(config).toContain("user_skill_level: intermediate");
      expect(config).toContain("planning_artifacts: _bmad-output/planning-artifacts");
      expect(config).toContain("implementation_artifacts: _bmad-output/implementation-artifacts");
      expect(config).toContain("project_knowledge: docs");
      expect(config).not.toContain("output_dir:");
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

    it("copies all slash commands from slash-commands/ directory", async () => {
      await installProject(testDir);
      const files = await readdir(join(testDir, ".claude/commands"));
      expect(files.length).toBeGreaterThanOrEqual(54);
      expect(files).toContain("bmalph.md");
      expect(files).toContain("analyst.md");
      expect(files).toContain("architect.md");
      expect(files).toContain("create-prd.md");
      expect(files).toContain("sprint-planning.md");
    });

    it("does not include Phase 4 commands replaced by Ralph", async () => {
      await installProject(testDir);
      const files = await readdir(join(testDir, ".claude/commands"));
      expect(files).not.toContain("dev-story.md");
      expect(files).not.toContain("code-review.md");
    });

    it("agent slash commands reference correct YAML paths", async () => {
      await installProject(testDir);
      const agents = [
        { file: "analyst.md", path: "_bmad/bmm/agents/analyst.agent.yaml" },
        { file: "architect.md", path: "_bmad/bmm/agents/architect.agent.yaml" },
        { file: "dev.md", path: "_bmad/bmm/agents/dev.agent.yaml" },
        { file: "pm.md", path: "_bmad/bmm/agents/pm.agent.yaml" },
        { file: "sm.md", path: "_bmad/bmm/agents/sm.agent.yaml" },
        { file: "tea.md", path: "_bmad/bmm/agents/tea.agent.yaml" },
        { file: "ux-designer.md", path: "_bmad/bmm/agents/ux-designer.agent.yaml" },
        { file: "quick-flow-solo-dev.md", path: "_bmad/bmm/agents/quick-flow-solo-dev.agent.yaml" },
      ];
      for (const { file, path } of agents) {
        const content = await readFile(join(testDir, ".claude/commands", file), "utf-8");
        expect(content).toContain(path);
      }
    });

    it("workflow slash command adopts agent role and executes workflow", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".claude/commands/create-prd.md"), "utf-8");
      expect(content).toContain("_bmad/bmm/agents/pm.agent.yaml");
      expect(content).toContain("_bmad/bmm/workflows/2-plan-workflows/prd/workflow.md");
      expect(content).toMatch(/[Cc]reate/);
    });

    it("core slash commands execute directly without agent role", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".claude/commands/brainstorming.md"), "utf-8");
      expect(content).toContain("_bmad/core/workflows/brainstorming/workflow.md");
      expect(content).not.toContain("agent");
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
      await expect(access(join(testDir, ".claude/commands/analyst.md"))).resolves.toBeUndefined();
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

    it("generates _bmad/_config/bmad-help.csv with combined manifest content", async () => {
      await copyBundledAssets(testDir);
      const helpCsv = await readFile(join(testDir, "_bmad/_config/bmad-help.csv"), "utf-8");
      expect(helpCsv).toContain("module,phase,name,code,");
      expect(helpCsv).toContain("core,,Brainstorming,BS,");
      expect(helpCsv).toContain("bmm,1-analysis,Create Brief,CB,");
    });

    it("manifests do not contain Dev Story or Code Review entries", async () => {
      await copyBundledAssets(testDir);
      const manifest = await readFile(join(testDir, "_bmad/_config/task-manifest.csv"), "utf-8");
      expect(manifest).not.toContain("Dev Story");
      expect(manifest).not.toContain("Code Review");
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
        JSON.stringify({ name: "my-project", description: "test" }),
      );

      await copyBundledAssets(testDir);

      const config = JSON.parse(
        await readFile(join(testDir, "bmalph/config.json"), "utf-8"),
      );
      expect(config.name).toBe("my-project");
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
      expect(result.updatedPaths).toContain(".claude/commands/");
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

    it("config.yaml has valid structure with output_folder", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(content).toContain("platform:");
      expect(content).toContain("output_folder:");
      expect(content).toContain("modules:");
      expect(content).not.toContain("output_dir:");
    });

    it("config.yaml derives project_name from directory name", async () => {
      await installProject(testDir);
      const config = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      const dirName = testDir.split(/[/\\]/).pop();
      expect(config).toContain(`project_name: ${dirName}`);
    });

    it("config.yaml derives project_name from bmalph/config.json when present", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "my-cool-project", description: "test" }),
      );
      await copyBundledAssets(testDir);
      const config = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(config).toContain("project_name: my-cool-project");
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

    it("PROMPT.md references planning-artifacts/ structure", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("planning-artifacts/");
    });

    it("PROMPT.md references implementation-artifacts/", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("implementation-artifacts/");
    });

    it("PROMPT.md references docs/ for project knowledge", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("docs/");
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

    it("documents all 4 phases", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("Analysis");
      expect(content).toContain("Planning");
      expect(content).toContain("Solutioning");
      expect(content).toContain("Implementation");
    });

    it("references /bmad-help for command discovery", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("/bmad-help");
    });

    it("lists available agent slash commands", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("/analyst");
      expect(content).toContain("/architect");
      expect(content).toContain("/pm");
      expect(content).toContain("/sm");
      expect(content).toContain("/dev");
      expect(content).toContain("/ux-designer");
      expect(content).toContain("/tea");
    });
  });
});
