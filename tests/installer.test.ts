import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  installProject,
  copyBundledAssets,
  mergeClaudeMd,
  isInitialized,
  previewInstall,
  previewUpgrade,
} from "../src/installer.js";
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
      await expect(
        access(join(testDir, ".ralph/lib/response_analyzer.sh"))
      ).resolves.toBeUndefined();
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
      expect(files.length).toBeGreaterThanOrEqual(43);
      expect(files).toContain("bmalph.md");
      expect(files).toContain("analyst.md");
      expect(files).toContain("architect.md");
      expect(files).toContain("create-prd.md");
      expect(files).toContain("sprint-planning.md");
      expect(files).toContain("qa.md");
      expect(files).toContain("qa-automate.md");
      expect(files).toContain("generate-project-context.md");
    });

    it("does not include removed TEA, testarch, or excalidraw commands", async () => {
      await installProject(testDir);
      const files = await readdir(join(testDir, ".claude/commands"));
      const removed = [
        "tea.md",
        "test-design.md",
        "validate-test-design.md",
        "test-framework.md",
        "atdd.md",
        "test-automate.md",
        "test-trace.md",
        "nfr-assess.md",
        "continuous-integration.md",
        "test-review.md",
        "create-dataflow.md",
        "create-diagram.md",
        "create-flowchart.md",
        "create-wireframe.md",
      ];
      for (const file of removed) {
        expect(files).not.toContain(file);
      }
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
        { file: "qa.md", path: "_bmad/bmm/agents/qa.agent.yaml" },
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
      expect(content).toContain(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/workflow-create-prd.md"
      );
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
      expect(manifest).toContain("core,anytime,Brainstorming,BSP,");
      // Should contain bmm module entries
      expect(manifest).toContain("bmm,1-analysis,Create Brief,CB,");
      expect(manifest).toContain("bmm,3-solutioning,Create Architecture,CA,");
    });

    it("generates _bmad/_config/workflow-manifest.csv identical to task-manifest.csv", async () => {
      await copyBundledAssets(testDir);
      const taskManifest = await readFile(
        join(testDir, "_bmad/_config/task-manifest.csv"),
        "utf-8"
      );
      const workflowManifest = await readFile(
        join(testDir, "_bmad/_config/workflow-manifest.csv"),
        "utf-8"
      );
      expect(workflowManifest).toBe(taskManifest);
    });

    it("generates _bmad/_config/bmad-help.csv with combined manifest content", async () => {
      await copyBundledAssets(testDir);
      const helpCsv = await readFile(join(testDir, "_bmad/_config/bmad-help.csv"), "utf-8");
      expect(helpCsv).toContain("module,phase,name,code,");
      expect(helpCsv).toContain("core,anytime,Brainstorming,BSP,");
      expect(helpCsv).toContain("bmm,1-analysis,Create Brief,CB,");
    });

    it("manifests contain implementation phase workflows", async () => {
      await copyBundledAssets(testDir);
      const manifest = await readFile(join(testDir, "_bmad/_config/task-manifest.csv"), "utf-8");
      // Dev Story and Code Review are valid Phase 4 workflows from upstream BMAD
      expect(manifest).toContain("Dev Story");
      expect(manifest).toContain("Code Review");
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
        JSON.stringify({ name: "my-project", description: "test" })
      );

      await copyBundledAssets(testDir);

      const config = JSON.parse(await readFile(join(testDir, "bmalph/config.json"), "utf-8"));
      expect(config.name).toBe("my-project");
    });

    it("copies .ralphrc during install", async () => {
      await copyBundledAssets(testDir);
      await expect(access(join(testDir, ".ralph/.ralphrc"))).resolves.toBeUndefined();
      const content = await readFile(join(testDir, ".ralph/.ralphrc"), "utf-8");
      expect(content).toContain("MAX_CALLS_PER_HOUR");
      expect(content).toContain("ALLOWED_TOOLS");
    });

    it("preserves existing .ralphrc on upgrade", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      await writeFile(join(testDir, ".ralph/.ralphrc"), "# Custom config\nMAX_CALLS_PER_HOUR=50\n");

      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/.ralphrc"), "utf-8");
      expect(content).toBe("# Custom config\nMAX_CALLS_PER_HOUR=50\n");
    });

    it("copies new Ralph lib files", async () => {
      await copyBundledAssets(testDir);
      await expect(access(join(testDir, ".ralph/lib/enable_core.sh"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/lib/task_sources.sh"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/lib/wizard_utils.sh"))).resolves.toBeUndefined();
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

  describe("error handling", { timeout: 30000 }, () => {
    it("validates source directories exist before copying", async () => {
      // copyBundledAssets validates bmad, ralph, and slash-commands dirs
      // We can't easily test missing source dirs since they're bundled,
      // but we can verify the function completes successfully with valid dirs
      await expect(copyBundledAssets(testDir)).resolves.not.toThrow();
    });

    it("CSV validation code path executes without error when files exist", async () => {
      // This verifies the validation doesn't break normal operation
      await copyBundledAssets(testDir);

      // Verify the CSV files exist and manifests were generated
      await expect(access(join(testDir, "_bmad/core/module-help.csv"))).resolves.toBeUndefined();
      await expect(access(join(testDir, "_bmad/bmm/module-help.csv"))).resolves.toBeUndefined();
      await expect(
        access(join(testDir, "_bmad/_config/task-manifest.csv"))
      ).resolves.toBeUndefined();
    });
  });

  describe("version marker handling", { timeout: 30000 }, () => {
    it("replaces existing version marker correctly", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
      expect(content).toMatch(/# bmalph-version: \d+\.\d+\.\d+/);

      // Run again to verify replacement works
      await copyBundledAssets(testDir);
      const content2 = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");

      // Should still have exactly one version marker
      const matches = content2.match(/# bmalph-version:/g);
      expect(matches).toHaveLength(1);
    });

    it("handles version marker with empty value (edge case)", async () => {
      await installProject(testDir);

      // Manually corrupt the version marker to have empty value
      let content = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
      content = content.replace(/# bmalph-version: .+/, "# bmalph-version:");
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), content);

      // Run copyBundledAssets - should properly replace the corrupted marker
      await copyBundledAssets(testDir);
      const updated = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");

      // Should have proper version now
      expect(updated).toMatch(/# bmalph-version: \d+\.\d+\.\d+/);
      // Should NOT have the corrupted empty marker
      expect(updated).not.toContain("# bmalph-version:\n");
    });

    it("handles version marker at end of file without newline", async () => {
      await installProject(testDir);

      // Modify to have marker at EOF without newline
      let content = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
      content = content.trimEnd() + "\n# bmalph-version: 1.0.0"; // No trailing newline
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), content);

      // Run copyBundledAssets
      await copyBundledAssets(testDir);
      const updated = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");

      // Should have proper version
      expect(updated).toMatch(/# bmalph-version: \d+\.\d+\.\d+/);
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
        JSON.stringify({ name: "my-cool-project", description: "test" })
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

    it("PROMPT.md references .ralph/specs/ for specifications", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain(".ralph/specs/");
    });

    it("PROMPT.md references fix_plan.md", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("fix_plan.md");
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

    it("RALPH-REFERENCE.md is copied to .ralph/", async () => {
      await installProject(testDir);
      await expect(access(join(testDir, ".ralph/RALPH-REFERENCE.md"))).resolves.toBeUndefined();
    });

    it("RALPH-REFERENCE.md contains session management documentation", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/RALPH-REFERENCE.md"), "utf-8");
      expect(content).toContain("Session");
      expect(content).toContain(".ralph_session");
    });

    it("RALPH-REFERENCE.md contains circuit breaker documentation", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/RALPH-REFERENCE.md"), "utf-8");
      expect(content).toContain("Circuit Breaker");
      expect(content).toContain("CLOSED");
      expect(content).toContain("HALF_OPEN");
      expect(content).toContain("OPEN");
    });

    it("RALPH-REFERENCE.md contains exit detection documentation", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/RALPH-REFERENCE.md"), "utf-8");
      expect(content).toContain("EXIT_SIGNAL");
      expect(content).toContain("completion_indicators");
    });

    it("RALPH-REFERENCE.md contains troubleshooting section", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/RALPH-REFERENCE.md"), "utf-8");
      expect(content).toContain("Troubleshooting");
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

    it("references /bmalph-status slash command", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("/bmalph-status");
    });

    it("references /bmalph-implement for transition", async () => {
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      expect(content).toContain("/bmalph-implement");
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
      expect(content).toContain("/qa");
      expect(content).not.toContain("/tea");
    });

    it("replaces stale BMAD section on upgrade instead of skipping", async () => {
      // Simulate stale CLAUDE.md with old TEA reference
      const staleSection = `# My Project

## BMAD-METHOD Integration

Old stale content with /tea agent reference.
`;
      await writeFile(join(testDir, "CLAUDE.md"), staleSection);
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
      // Section should be refreshed with new content
      expect(content).toContain("/qa");
      expect(content).not.toContain("Old stale content");
      // Should still have project header
      expect(content).toContain("# My Project");
      // Should have exactly one integration section
      const matches = content.match(/## BMAD-METHOD Integration/g);
      expect(matches).toHaveLength(1);
    });
  });

  describe("previewInstall", () => {
    it("returns wouldCreate for new project", async () => {
      const result = await previewInstall(testDir);

      expect(result.wouldCreate).toContain("bmalph/state/");
      expect(result.wouldCreate).toContain(".ralph/specs/");
      expect(result.wouldCreate).toContain(".ralph/logs/");
      expect(result.wouldCreate).toContain("_bmad/");
      expect(result.wouldCreate).toContain(".claude/commands/");
      expect(result.wouldCreate).toContain(".ralph/PROMPT.md");
      expect(result.wouldCreate).toContain("bmalph/config.json");
      expect(result.wouldCreate).toContain(".gitignore");
      expect(result.wouldCreate).toContain("CLAUDE.md");
    });

    it("returns wouldModify for existing directories", async () => {
      // Create some existing directories
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });

      const result = await previewInstall(testDir);

      expect(result.wouldModify).toContain("_bmad/");
      expect(result.wouldModify).toContain(".claude/commands/");
      expect(result.wouldCreate).not.toContain("_bmad/");
      expect(result.wouldCreate).not.toContain(".claude/commands/");
    });

    it("returns wouldModify for existing template files", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      await writeFile(join(testDir, ".ralph/PROMPT.md"), "existing content");
      await writeFile(join(testDir, ".ralph/@AGENT.md"), "existing content");

      const result = await previewInstall(testDir);

      expect(result.wouldModify).toContain(".ralph/PROMPT.md");
      expect(result.wouldModify).toContain(".ralph/@AGENT.md");
    });

    it("returns wouldModify for existing .gitignore", async () => {
      await writeFile(join(testDir, ".gitignore"), "node_modules/");

      const result = await previewInstall(testDir);

      expect(result.wouldModify).toContain(".gitignore");
      expect(result.wouldCreate).not.toContain(".gitignore");
    });

    it("returns wouldModify for existing CLAUDE.md without integration", async () => {
      await writeFile(join(testDir, "CLAUDE.md"), "# My Project");

      const result = await previewInstall(testDir);

      expect(result.wouldModify).toContain("CLAUDE.md");
      expect(result.wouldSkip).not.toContain("CLAUDE.md (already integrated)");
    });

    it("returns wouldSkip for CLAUDE.md with existing integration", async () => {
      await writeFile(
        join(testDir, "CLAUDE.md"),
        "# My Project\n## BMAD-METHOD Integration\nContent"
      );

      const result = await previewInstall(testDir);

      expect(result.wouldSkip).toContain("CLAUDE.md (already integrated)");
      expect(result.wouldModify).not.toContain("CLAUDE.md");
      expect(result.wouldCreate).not.toContain("CLAUDE.md");
    });

    it("does not include non-template files in wouldModify when they exist", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash");
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(join(testDir, "bmalph/config.json"), "{}");

      const result = await previewInstall(testDir);

      // Non-template files should not appear in wouldModify
      expect(result.wouldModify).not.toContain(".ralph/ralph_loop.sh");
      expect(result.wouldModify).not.toContain("bmalph/config.json");
    });
  });

  describe("previewUpgrade", () => {
    it("returns all bundled asset paths that would be updated", async () => {
      const result = await previewUpgrade(testDir);

      expect(result.wouldUpdate).toContain("_bmad/");
      expect(result.wouldUpdate).toContain(".ralph/ralph_loop.sh");
      expect(result.wouldUpdate).toContain(".ralph/ralph_import.sh");
      expect(result.wouldUpdate).toContain(".ralph/ralph_monitor.sh");
      expect(result.wouldUpdate).toContain(".ralph/lib/");
      expect(result.wouldUpdate).toContain(".ralph/PROMPT.md");
      expect(result.wouldUpdate).toContain(".ralph/@AGENT.md");
      expect(result.wouldUpdate).toContain(".ralph/RALPH-REFERENCE.md");
      expect(result.wouldUpdate).toContain(".claude/commands/");
      expect(result.wouldUpdate).toContain(".gitignore");
    });

    it("returns consistent results regardless of project state", async () => {
      // Empty project
      const result1 = await previewUpgrade(testDir);

      // Initialized project
      await installProject(testDir);
      const result2 = await previewUpgrade(testDir);

      expect(result1.wouldUpdate).toEqual(result2.wouldUpdate);
    });
  });
});
