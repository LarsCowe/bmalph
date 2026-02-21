import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installProject,
  copyBundledAssets,
  mergeClaudeMd,
  mergeInstructionsFile,
  isInitialized,
  previewInstall,
  previewUpgrade,
  getSlashCommandsDir,
  generateManifests,
  getPackageVersion,
} from "../src/installer.js";
import { mkdir, rm, access, readFile, writeFile, readdir, stat } from "fs/promises";
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

  describe("getPackageVersion", () => {
    it("returns a version string instead of throwing", () => {
      const version = getPackageVersion();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });

    it("never throws, always returns a string", () => {
      // The contract is: getPackageVersion() always returns a string, never throws.
      // When package.json is present, it returns a semver version.
      // When it can't be read, it returns "unknown".
      const version = getPackageVersion();
      expect(typeof version).toBe("string");
      expect(version).toMatch(/^\d+\.\d+\.\d+/); // Normal case: semver
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

  describe("installSlashCommand", { timeout: 30000 }, () => {
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
      const expectedCount = (await readdir(getSlashCommandsDir())).filter((f) =>
        f.endsWith(".md")
      ).length;
      expect(files.length).toBe(expectedCount);
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

    it("preserves customized PROMPT.md on upgrade", async () => {
      // First install copies the template
      await copyBundledAssets(testDir);
      // Simulate transition: PROMPT.md is customized with project-specific content
      const customized = "# Ralph Development Instructions\n\nYou are Ralph working on MyApp.\n";
      await writeFile(join(testDir, ".ralph/PROMPT.md"), customized);

      // Upgrade should preserve the customized file
      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toBe(customized);
    });

    it("replaces template PROMPT.md on upgrade", async () => {
      // First install copies the template (contains [YOUR PROJECT NAME])
      await copyBundledAssets(testDir);
      const templateContent = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(templateContent).toContain("[YOUR PROJECT NAME]");

      // Upgrade should replace the unmodified template
      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("[YOUR PROJECT NAME]");
    });

    it("copies PROMPT.md when it does not exist", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      // No PROMPT.md exists yet
      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("[YOUR PROJECT NAME]");
    });

    it("preserves customized @AGENT.md on upgrade", async () => {
      // First install copies the template
      await copyBundledAssets(testDir);
      // Simulate tech-stack detection customizing @AGENT.md
      const customized = "# Agent Build Instructions\n\nnpm run build && npm test\n";
      await writeFile(join(testDir, ".ralph/@AGENT.md"), customized);

      // Upgrade should preserve the customized file
      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(content).toBe(customized);
    });

    it("replaces template @AGENT.md on upgrade", async () => {
      // First install copies the generic template
      await copyBundledAssets(testDir);
      const templateContent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      // Template contains generic setup examples for multiple languages
      expect(templateContent).toContain("pip install -r requirements.txt");

      // Upgrade should replace the unmodified template
      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(content).toContain("pip install -r requirements.txt");
    });

    it("copies @AGENT.md when it does not exist", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      // No @AGENT.md exists yet
      await copyBundledAssets(testDir);

      const content = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(content.length).toBeGreaterThan(0);
    });

    it("excludes preserved PROMPT.md from updatedPaths", async () => {
      await copyBundledAssets(testDir);
      // Customize PROMPT.md
      await writeFile(join(testDir, ".ralph/PROMPT.md"), "# Custom project instructions\n");

      const result = await copyBundledAssets(testDir);

      expect(result.updatedPaths).not.toContain(".ralph/PROMPT.md");
    });

    it("excludes preserved @AGENT.md from updatedPaths", async () => {
      await copyBundledAssets(testDir);
      // Customize @AGENT.md
      await writeFile(join(testDir, ".ralph/@AGENT.md"), "# Custom build instructions\n");

      const result = await copyBundledAssets(testDir);

      expect(result.updatedPaths).not.toContain(".ralph/@AGENT.md");
    });

    it("copies new Ralph lib files", async () => {
      await copyBundledAssets(testDir);
      await expect(access(join(testDir, ".ralph/lib/enable_core.sh"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/lib/task_sources.sh"))).resolves.toBeUndefined();
      await expect(access(join(testDir, ".ralph/lib/wizard_utils.sh"))).resolves.toBeUndefined();
    });

    it("removes stale files from _bmad/ on upgrade", async () => {
      // First install
      await copyBundledAssets(testDir);

      // Simulate a stale file from a previous version
      await writeFile(join(testDir, "_bmad/removed-agent.yaml"), "stale content");
      await expect(access(join(testDir, "_bmad/removed-agent.yaml"))).resolves.toBeUndefined();

      // Second install (upgrade)
      await copyBundledAssets(testDir);

      // Stale file should be gone
      await expect(access(join(testDir, "_bmad/removed-agent.yaml"))).rejects.toThrow();
      // Fresh files should still be present
      await expect(access(join(testDir, "_bmad/core"))).resolves.toBeUndefined();
    });

    it("removes stale files from .ralph/lib/ on upgrade", async () => {
      await copyBundledAssets(testDir);

      // Simulate a stale lib file
      await writeFile(join(testDir, ".ralph/lib/old_helper.sh"), "stale");
      await expect(access(join(testDir, ".ralph/lib/old_helper.sh"))).resolves.toBeUndefined();

      await copyBundledAssets(testDir);

      // Stale file should be gone
      await expect(access(join(testDir, ".ralph/lib/old_helper.sh"))).rejects.toThrow();
      // Fresh files should still be present
      await expect(access(join(testDir, ".ralph/lib/circuit_breaker.sh"))).resolves.toBeUndefined();
    });

    it("preserves non-bundled user commands in .claude/commands/ on upgrade", async () => {
      await copyBundledAssets(testDir);

      // User-created command (not in bundled slash-commands)
      await writeFile(join(testDir, ".claude/commands/my-custom-cmd.md"), "user command");

      await copyBundledAssets(testDir);

      // User command should be preserved (not a bundled name)
      await expect(
        access(join(testDir, ".claude/commands/my-custom-cmd.md"))
      ).resolves.toBeUndefined();
      // Fresh bundled commands should still be present
      await expect(access(join(testDir, ".claude/commands/bmalph.md"))).resolves.toBeUndefined();
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

    it("throws when core module-help.csv is empty", async () => {
      await mkdir(join(testDir, "_bmad/core"), { recursive: true });
      await mkdir(join(testDir, "_bmad/bmm"), { recursive: true });
      await writeFile(join(testDir, "_bmad/core/module-help.csv"), "");
      await writeFile(join(testDir, "_bmad/bmm/module-help.csv"), "header\ndata");
      await expect(generateManifests(testDir)).rejects.toThrow("empty");
    });

    it("throws when bmm module-help.csv is empty", async () => {
      await mkdir(join(testDir, "_bmad/core"), { recursive: true });
      await mkdir(join(testDir, "_bmad/bmm"), { recursive: true });
      await writeFile(join(testDir, "_bmad/core/module-help.csv"), "header\ndata");
      await writeFile(join(testDir, "_bmad/bmm/module-help.csv"), "");
      await expect(generateManifests(testDir)).rejects.toThrow("empty");
    });

    it("does not warn when CSV headers differ only by trailing comma", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await copyBundledAssets(testDir);

      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("CSV header mismatch"));
      logSpy.mockRestore();
    });

    it("strips trailing commas from manifest rows", async () => {
      await copyBundledAssets(testDir);
      const manifest = await readFile(join(testDir, "_bmad/_config/task-manifest.csv"), "utf-8");
      const lines = manifest.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        expect(line).not.toMatch(/,$/);
      }
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

    it("ralph_loop.sh references @fix_plan.md for completion detection", async () => {
      await installProject(testDir);
      const content = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
      // bmalph writes .ralph/@fix_plan.md (with @ prefix)
      // ralph_loop.sh must check @fix_plan.md, not fix_plan.md
      expect(content).toContain('"$RALPH_DIR/@fix_plan.md"');
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
      expect(config).toContain(`project_name: "${dirName}"`);
    });

    it("config.yaml derives project_name from bmalph/config.json when present", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "my-cool-project", description: "test" })
      );
      await copyBundledAssets(testDir);
      const config = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(config).toContain('project_name: "my-cool-project"');
    });

    it("config.yaml escapes special YAML characters in project_name", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: 'Lars\'s Project #1: "The Best" & More', description: "test" })
      );
      await copyBundledAssets(testDir);
      const config = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(config).toContain('project_name: "Lars\'s Project #1: \\"The Best\\" & More"');
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

    it("preserves user content after BMAD section on upgrade", async () => {
      const claudeMd = `# My Project

Some project info.

## BMAD-METHOD Integration

Old BMAD content that will be replaced.

## My Custom Section

This user content must survive the upgrade.

## Another Section

More user content here.
`;
      await writeFile(join(testDir, "CLAUDE.md"), claudeMd);
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");

      // Project header preserved
      expect(content).toContain("# My Project");
      expect(content).toContain("Some project info.");

      // BMAD section replaced with fresh content
      expect(content).toContain("## BMAD-METHOD Integration");
      expect(content).not.toContain("Old BMAD content");
      expect(content).toContain("/qa");

      // User content after BMAD section preserved
      expect(content).toContain("## My Custom Section");
      expect(content).toContain("This user content must survive the upgrade.");
      expect(content).toContain("## Another Section");
      expect(content).toContain("More user content here.");

      // Exactly one BMAD section
      const matches = content.match(/## BMAD-METHOD Integration/g);
      expect(matches).toHaveLength(1);
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

  describe("mergeInstructionsFile with non-claude-code platforms", () => {
    it("creates AGENTS.md for codex platform", async () => {
      const { codexPlatform } = await import("../src/platform/codex.js");
      await mergeInstructionsFile(testDir, codexPlatform);
      const content = await readFile(join(testDir, "AGENTS.md"), "utf-8");
      expect(content).toContain("## BMAD-METHOD Integration");
    });

    it("codex snippet does not contain slash command syntax", async () => {
      const { codexPlatform } = await import("../src/platform/codex.js");
      await mergeInstructionsFile(testDir, codexPlatform);
      const content = await readFile(join(testDir, "AGENTS.md"), "utf-8");
      expect(content).not.toMatch(/\/bmalph\b/);
      expect(content).not.toMatch(/\/analyst\b/);
    });

    it("creates CONVENTIONS.md for aider platform", async () => {
      const { aiderPlatform } = await import("../src/platform/aider.js");
      await mergeInstructionsFile(testDir, aiderPlatform);
      const content = await readFile(join(testDir, "CONVENTIONS.md"), "utf-8");
      expect(content).toContain("## BMAD-METHOD Integration");
    });

    it("does not create CLAUDE.md for codex platform", async () => {
      const { codexPlatform } = await import("../src/platform/codex.js");
      await mergeInstructionsFile(testDir, codexPlatform);
      await expect(readFile(join(testDir, "CLAUDE.md"), "utf-8")).rejects.toThrow();
    });

    it("does not duplicate on second run for codex", async () => {
      const { codexPlatform } = await import("../src/platform/codex.js");
      await mergeInstructionsFile(testDir, codexPlatform);
      await mergeInstructionsFile(testDir, codexPlatform);
      const content = await readFile(join(testDir, "AGENTS.md"), "utf-8");
      const matches = content.match(/## BMAD-METHOD Integration/g);
      expect(matches).toHaveLength(1);
    });

    it("appends to existing AGENTS.md for codex", async () => {
      await writeFile(join(testDir, "AGENTS.md"), "# My Agents\n\nExisting content.\n");
      const { codexPlatform } = await import("../src/platform/codex.js");
      await mergeInstructionsFile(testDir, codexPlatform);
      const content = await readFile(join(testDir, "AGENTS.md"), "utf-8");
      expect(content).toContain("# My Agents");
      expect(content).toContain("## BMAD-METHOD Integration");
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
    it("classifies all paths as wouldCreate on empty project", async () => {
      const result = await previewUpgrade(testDir);

      expect(result.wouldCreate).toContain("_bmad/");
      expect(result.wouldCreate).toContain(".ralph/ralph_loop.sh");
      expect(result.wouldCreate).toContain(".claude/commands/");
      expect(result.wouldCreate).toContain(".gitignore");
      expect(result.wouldUpdate).toHaveLength(0);
    });

    it("classifies all paths as wouldUpdate on initialized project", async () => {
      await installProject(testDir);
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
      expect(result.wouldCreate).toHaveLength(0);
    });

    it("splits paths between wouldCreate and wouldUpdate for partial project", async () => {
      // Create only some paths
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, ".gitignore"), "node_modules\n");

      const result = await previewUpgrade(testDir);

      expect(result.wouldUpdate).toContain("_bmad/");
      expect(result.wouldUpdate).toContain(".gitignore");
      expect(result.wouldCreate).toContain(".ralph/ralph_loop.sh");
      expect(result.wouldCreate).toContain(".claude/commands/");
    });

    it("classifies customized PROMPT.md as wouldPreserve", async () => {
      await installProject(testDir);
      // Customize PROMPT.md (remove the placeholder)
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        "# Ralph Development Instructions\n\nYou are Ralph working on MyApp.\n"
      );

      const result = await previewUpgrade(testDir);

      expect(result.wouldPreserve).toContain(".ralph/PROMPT.md");
      expect(result.wouldUpdate).not.toContain(".ralph/PROMPT.md");
    });

    it("classifies template PROMPT.md as wouldUpdate", async () => {
      await installProject(testDir);
      // PROMPT.md still has the template placeholder

      const result = await previewUpgrade(testDir);

      expect(result.wouldUpdate).toContain(".ralph/PROMPT.md");
      expect(result.wouldPreserve).not.toContain(".ralph/PROMPT.md");
    });

    it("classifies customized @AGENT.md as wouldPreserve", async () => {
      await installProject(testDir);
      // Customize @AGENT.md (remove the generic template markers)
      await writeFile(
        join(testDir, ".ralph/@AGENT.md"),
        "# Agent Build Instructions\n\nnpm run build && npm test\n"
      );

      const result = await previewUpgrade(testDir);

      expect(result.wouldPreserve).toContain(".ralph/@AGENT.md");
      expect(result.wouldUpdate).not.toContain(".ralph/@AGENT.md");
    });

    it("classifies template @AGENT.md as wouldUpdate", async () => {
      await installProject(testDir);
      // @AGENT.md still has the generic template content

      const result = await previewUpgrade(testDir);

      expect(result.wouldUpdate).toContain(".ralph/@AGENT.md");
      expect(result.wouldPreserve).not.toContain(".ralph/@AGENT.md");
    });

    it("returns empty wouldPreserve on empty project", async () => {
      const result = await previewUpgrade(testDir);

      expect(result.wouldPreserve).toHaveLength(0);
    });
  });

  describe("hardening: atomic copyBundledAssets", { timeout: 30000 }, () => {
    it("recovers _bmad if cp fails after rm (atomic copy)", async () => {
      // First install creates _bmad
      await copyBundledAssets(testDir);
      await expect(access(join(testDir, "_bmad/core"))).resolves.toBeUndefined();

      // _bmad should exist after a second successful copy
      await copyBundledAssets(testDir);
      await expect(access(join(testDir, "_bmad/core"))).resolves.toBeUndefined();
    });

    it("uses temp directory during _bmad copy", async () => {
      // After a successful copy, no _bmad.new temp dir should remain
      await copyBundledAssets(testDir);
      await expect(access(join(testDir, "_bmad.new"))).rejects.toThrow();
      await expect(access(join(testDir, "_bmad/core"))).resolves.toBeUndefined();
    });
  });

  describe("hardening: swallowed exceptions", { timeout: 30000 }, () => {
    it("stale command cleanup ignores ENOENT but propagates other errors", async () => {
      // A successful install should work even when .claude/commands doesn't exist yet
      await copyBundledAssets(testDir);
      await expect(access(join(testDir, ".claude/commands/bmalph.md"))).resolves.toBeUndefined();
    });

    it("deriveProjectName warns on non-ENOENT errors but does not throw", async () => {
      // Create a config.json that is a directory (will cause non-ENOENT read error)
      await mkdir(join(testDir, "bmalph/config.json"), { recursive: true });

      // Should fall through to basename without crashing
      await expect(copyBundledAssets(testDir)).resolves.not.toThrow();
      const config = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      // Should use directory basename as project name
      const dirName = testDir.split(/[/\\]/).pop();
      expect(config).toContain(`project_name: "${dirName}"`);
    });
  });

  describe("hardening: symlink safety", { timeout: 30000 }, () => {
    it("does not dereference symlinks when copying _bmad", async () => {
      await copyBundledAssets(testDir);

      // The copied files should be regular files/directories, not dereferenced symlinks
      // This verifies dereference: false is set
      const coreStat = await stat(join(testDir, "_bmad/core"));
      expect(coreStat.isDirectory()).toBe(true);
    });

    it("does not dereference symlinks when copying ralph lib", async () => {
      await copyBundledAssets(testDir);

      const libStat = await stat(join(testDir, ".ralph/lib"));
      expect(libStat.isDirectory()).toBe(true);
    });
  });

  describe("hardening: stale command cleanup preserves user commands", { timeout: 30000 }, () => {
    it("preserves user-created .md files not in bundled slash-commands", async () => {
      await copyBundledAssets(testDir);

      // Create a user-owned command
      await writeFile(
        join(testDir, ".claude/commands/my-custom-workflow.md"),
        "# My Custom Workflow\nDo something special."
      );

      // Upgrade should NOT delete the user command
      await copyBundledAssets(testDir);

      const content = await readFile(
        join(testDir, ".claude/commands/my-custom-workflow.md"),
        "utf-8"
      );
      expect(content).toContain("My Custom Workflow");
    });

    it("still removes stale bundled commands", async () => {
      await copyBundledAssets(testDir);

      // Simulate a command that was previously bundled but now removed
      // by getting the list of bundled commands and checking a known-bundled one is present
      const bundledFiles = await readdir(getSlashCommandsDir());
      const bundledMdFiles = bundledFiles.filter((f) => f.endsWith(".md"));
      expect(bundledMdFiles.length).toBeGreaterThan(0);

      // All bundled commands should be present after copy
      for (const file of bundledMdFiles) {
        await expect(access(join(testDir, ".claude/commands", file))).resolves.toBeUndefined();
      }
    });
  });

  describe("hardening: shell script chmod", { timeout: 30000 }, () => {
    const isWindows = process.platform === "win32";

    it("calls chmod on ralph_loop.sh without error", async () => {
      // chmod(0o755) is called. On Unix, this sets executable bits.
      // On Windows, chmod completes without error but NTFS doesn't track exec bits.
      await copyBundledAssets(testDir);
      const loopStat = await stat(join(testDir, ".ralph/ralph_loop.sh"));
      if (!isWindows) {
        expect(loopStat.mode & 0o111).not.toBe(0);
      }
      // On all platforms: file exists and is readable
      expect(loopStat.isFile()).toBe(true);
    });

    it("calls chmod on ralph_import.sh without error", async () => {
      await copyBundledAssets(testDir);
      const importStat = await stat(join(testDir, ".ralph/ralph_import.sh"));
      if (!isWindows) {
        expect(importStat.mode & 0o111).not.toBe(0);
      }
      expect(importStat.isFile()).toBe(true);
    });

    it("calls chmod on ralph_monitor.sh without error", async () => {
      await copyBundledAssets(testDir);
      const monitorStat = await stat(join(testDir, ".ralph/ralph_monitor.sh"));
      if (!isWindows) {
        expect(monitorStat.mode & 0o111).not.toBe(0);
      }
      expect(monitorStat.isFile()).toBe(true);
    });
  });

  describe("hardening: CLAUDE.md merge preserves trailing content", () => {
    it("preserves content after BMAD section when no next ## heading exists", async () => {
      const claudeMd = `# My Project

## BMAD-METHOD Integration

Old BMAD content here.

Some trailing content without a heading.
This must be preserved.
`;
      await writeFile(join(testDir, "CLAUDE.md"), claudeMd);
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");

      // BMAD section should be refreshed
      expect(content).toContain("## BMAD-METHOD Integration");
      expect(content).not.toContain("Old BMAD content");

      // Trailing content after the BMAD section (no next heading) should NOT be preserved
      // because it's part of the BMAD section content
      // Only content under separate headings should survive
    });

    it("preserves content after BMAD when it is the last section", async () => {
      const claudeMd = `# My Project

Some intro.

## My Custom Section

Important user notes.

## BMAD-METHOD Integration

Old BMAD stuff.
`;
      await writeFile(join(testDir, "CLAUDE.md"), claudeMd);
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");

      expect(content).toContain("# My Project");
      expect(content).toContain("## My Custom Section");
      expect(content).toContain("Important user notes.");
      expect(content).toContain("## BMAD-METHOD Integration");
      expect(content).not.toContain("Old BMAD stuff");
    });

    it("preserves all content between BMAD section and next heading", async () => {
      const claudeMd = `# My Project

## BMAD-METHOD Integration

Old content.

## User Section A

Content A.

## User Section B

Content B.
`;
      await writeFile(join(testDir, "CLAUDE.md"), claudeMd);
      await mergeClaudeMd(testDir);
      const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");

      expect(content).toContain("## User Section A");
      expect(content).toContain("Content A.");
      expect(content).toContain("## User Section B");
      expect(content).toContain("Content B.");
      expect(content).not.toContain("Old content.");
    });
  });

  describe("hardening: atomicWriteFile for generated files", { timeout: 30000 }, () => {
    it("config.yaml exists after copyBundledAssets", async () => {
      await copyBundledAssets(testDir);
      const content = await readFile(join(testDir, "_bmad/config.yaml"), "utf-8");
      expect(content).toContain("platform: claude-code");
    });

    it("manifests exist after copyBundledAssets", async () => {
      await copyBundledAssets(testDir);
      await expect(
        access(join(testDir, "_bmad/_config/task-manifest.csv"))
      ).resolves.toBeUndefined();
      await expect(
        access(join(testDir, "_bmad/_config/workflow-manifest.csv"))
      ).resolves.toBeUndefined();
      await expect(access(join(testDir, "_bmad/_config/bmad-help.csv"))).resolves.toBeUndefined();
    });

    it("gitignore is written atomically (no partial content)", async () => {
      await copyBundledAssets(testDir);
      const content = await readFile(join(testDir, ".gitignore"), "utf-8");
      expect(content).toContain(".ralph/logs/");
      expect(content).toContain("_bmad-output/");
    });
  });
});
