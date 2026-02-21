import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { runTransition } from "../../src/transition/orchestration.js";
import { readState } from "../../src/utils/state.js";

describe("orchestration", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-orchestration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await mkdir(join(testDir, ".ralph/specs"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ name: "test-project", createdAt: "2025-01-01T00:00:00.000Z" })
    );
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  describe("phase state update (Bug #1)", () => {
    it("updates phase to 4 after successful transition", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const state = await readState(testDir);
      expect(state).not.toBeNull();
      expect(state!.currentPhase).toBe(4);
      expect(state!.status).toBe("implementing");
    });

    it("updates lastUpdated timestamp after transition", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const beforeTransition = new Date().toISOString();
      await runTransition(testDir);

      const state = await readState(testDir);
      expect(state).not.toBeNull();
      expect(new Date(state!.lastUpdated).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTransition).getTime()
      );
    });
  });

  describe("deleted story detection (Bug #2)", () => {
    it("warns when a completed story is removed from BMAD output", async () => {
      // Setup: existing fix_plan with completed story 1.1
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Fix Plan\n- [x] Story 1.1: Old Feature\n- [ ] Story 1.2: Other Feature\n`
      );

      // New BMAD output WITHOUT story 1.1
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.2: Other Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // Should warn about orphaned completed story
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/completed.*story.*1\.1.*removed|orphan/i)
      );
    });

    it("does not warn when uncompleted stories are removed", async () => {
      // Setup: existing fix_plan with uncompleted story 1.1
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Fix Plan\n- [ ] Story 1.1: Old Feature\n- [ ] Story 1.2: Other Feature\n`
      );

      // New BMAD output WITHOUT story 1.1
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.2: Other Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // Should NOT warn about uncompleted stories
      expect(result.warnings).not.toContainEqual(
        expect.stringMatching(/completed.*story.*1\.1.*removed|orphan/i)
      );
    });
  });

  describe("story ID change detection (Bug #3)", () => {
    it("warns when completed story ID appears to have been renumbered", async () => {
      // Setup: story 1.1 completed with title "Login Feature"
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Fix Plan\n- [x] Story 1.1: Login Feature\n- [ ] Story 1.2: Signup\n`
      );

      // New BMAD output with same title but different ID (1.2 instead of 1.1)
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Auth\n\n### Story 1.2: Login Feature\n\nUser login.\n\n### Story 1.3: Signup\n\nUser signup.\n`
      );

      const result = await runTransition(testDir);

      // Should warn about potential renumbering
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/story.*1\.1.*renumber|id.*change|Login Feature.*moved/i)
      );
    });
  });

  describe("fix-plan spec links use detected stories filename (Bug #2b)", () => {
    it("uses detected stories filename in fix plan spec links", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("specs/planning-artifacts/epics-and-stories.md#story-1-1");
      expect(fixPlan).not.toContain("planning-artifacts/stories.md#story");
    });

    it("uses stories.md in links when file is named stories.md", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("specs/planning-artifacts/stories.md#story-1-1");
    });
  });

  describe("stale file cleanup", () => {
    it("removes stale files from .ralph/specs/ on re-transition", async () => {
      // First transition: copy artifact to specs
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/old-artifact.md"),
        `# Old Artifact\nThis will be removed.\n`
      );
      await runTransition(testDir);

      // Verify old-artifact.md was copied
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/old-artifact.md"))
      ).resolves.toBeUndefined();

      // Second transition: old-artifact.md removed from source
      await rm(join(testDir, "_bmad-output/planning-artifacts/old-artifact.md"));
      await runTransition(testDir);

      // Stale file should be gone from specs
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/old-artifact.md"))
      ).rejects.toThrow();
    });
  });

  describe("truncation warnings (Bug #9)", () => {
    it("warns when PRD goals are truncated", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      // Create PRD with very long Executive Summary (>5000 chars)
      const longContent = "A".repeat(6000);
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        `# PRD\n\n## Executive Summary\n\n${longContent}\n\n## Other Section\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // Should warn about truncation
      expect(result.warnings).toContainEqual(expect.stringMatching(/truncat/i));
    });
  });

  describe("no stories file error path", () => {
    it("throws when no file matches the stories pattern", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      // Create files that do NOT match the stories pattern
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        `# PRD\n\nSome content.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\nSome content.\n`
      );

      await expect(runTransition(testDir)).rejects.toThrow(/no epics\/stories file found/i);
    });
  });

  describe("zero parsed stories error path", () => {
    it("throws when stories file parses to zero stories", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      // File matches stories pattern but has no parseable stories
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `# Stories\n\nThis file has no properly formatted stories.\n\nJust some text.\n`
      );

      await expect(runTransition(testDir)).rejects.toThrow(/no stories parsed/i);
    });
  });

  describe("PROMPT.md placeholder replacement", () => {
    it("replaces [YOUR PROJECT NAME] with actual project name", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Create existing PROMPT.md with placeholder
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        `# Ralph Instructions for [YOUR PROJECT NAME]\n\nYou are working on [YOUR PROJECT NAME].\n`
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(prompt).not.toContain("[YOUR PROJECT NAME]");
      expect(prompt).toContain("test-project");
    });

    it("generates new PROMPT.md when no placeholder present", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Existing PROMPT.md without the placeholder
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        `# Old prompt content\n\nNo placeholder here.\n`
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      // Should be regenerated from template (contains Ralph Development Instructions)
      expect(prompt).toContain("Ralph Development Instructions");
      expect(prompt).toContain("test-project");
    });
  });

  describe("tech stack + @AGENT.md customization", () => {
    it("customizes @AGENT.md when architecture has tech stack", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Architecture with tech stack section mentioning Node.js + vitest
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\n## Tech Stack\n\n- Node.js\n- TypeScript\n- vitest\n\n## Other\n`
      );
      // Template @AGENT.md with placeholder bash blocks
      await writeFile(
        join(testDir, ".ralph/@AGENT.md"),
        [
          "# Agent",
          "",
          "## Project Setup",
          "```bash",
          "echo setup",
          "```",
          "",
          "## Running Tests",
          "```bash",
          "echo test",
          "```",
          "",
          "## Build Commands",
          "```bash",
          "echo build",
          "```",
          "",
          "## Development Server",
          "```bash",
          "echo dev",
          "```",
        ].join("\n")
      );

      await runTransition(testDir);

      const agent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(agent).toContain("npm install");
      expect(agent).toContain("npx vitest run");
    });

    it("warns but does not fail when @AGENT.md is missing", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Architecture with tech stack
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\n## Tech Stack\n\n- Node.js\n- TypeScript\n\n## Other\n`
      );
      // No @AGENT.md file exists - should warn, not crash

      const result = await runTransition(testDir);

      // Should succeed without crashing
      expect(result.storiesCount).toBe(1);
    });
  });

  describe("atomic specs copy", () => {
    it("preserves specs if cp fails mid-operation", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      // First transition to populate specs
      await runTransition(testDir);

      // Verify specs exist after first transition
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/stories.md"))
      ).resolves.toBeUndefined();
    });

    it("uses temp directory for atomic copy", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      // After successful transition, temp dir should be cleaned up
      await expect(access(join(testDir, ".ralph/specs.new"))).rejects.toThrow();

      // But specs should exist
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/stories.md"))
      ).resolves.toBeUndefined();
    });
  });

  describe("atomicWriteFile for generated files", () => {
    it("writes @fix_plan.md atomically", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      // Verify fix_plan was written
      const content = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(content).toContain("Story 1.1");
    });

    it("writes PROMPT.md atomically", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("Ralph");
    });
  });
});
