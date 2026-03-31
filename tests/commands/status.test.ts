import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("chalk");

describe("status command", () => {
  let testDir: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-test-status-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Reset module cache for fresh imports
    vi.resetModules();
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await rm(testDir, { recursive: true, force: true });
  });

  async function setupProject(platform?: string) {
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({
        name: "test",
        createdAt: new Date().toISOString(),
        ...(platform ? { platform } : {}),
      })
    );
  }

  async function setupState(state: { currentPhase: number; status: string }) {
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/state/current-phase.json"),
      JSON.stringify({
        currentPhase: state.currentPhase,
        status: state.status,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })
    );
  }

  async function setupRalphStatus(status: {
    loopCount?: number;
    status?: string;
    tasksCompleted?: number;
    tasksTotal?: number;
  }) {
    await mkdir(join(testDir, ".ralph"), { recursive: true });
    // Write snake_case keys matching real Ralph bash output
    await writeFile(
      join(testDir, ".ralph/status.json"),
      JSON.stringify({
        loop_count: status.loopCount ?? 0,
        status: status.status ?? "not_started",
        tasks_completed: status.tasksCompleted ?? 0,
        tasks_total: status.tasksTotal ?? 0,
      })
    );
  }

  describe("runStatus", () => {
    it("shows error when no project is initialized", async () => {
      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("not initialized");
    });

    it("shows corrupted config message when config exists but has wrong schema", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(join(testDir, "bmalph/config.json"), '{"invalid": true}');

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("corrupted");
      expect(output).toContain("bmalph doctor");
      expect(output).not.toContain("bmalph init");
    });

    it("shows corrupted config message when config contains broken JSON", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(join(testDir, "bmalph/config.json"), "{corrupt");

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("corrupted");
      expect(output).toContain("bmalph doctor");
      expect(output).not.toContain("bmalph init");
    });

    it("shows phase 1 status when in planning", async () => {
      await setupProject();
      await setupState({ currentPhase: 1, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("1 - Analysis");
      expect(output).toContain("planning");
    });

    it("shows phase 4 with Ralph status when implementing", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupRalphStatus({
        loopCount: 5,
        status: "running",
        tasksCompleted: 3,
        tasksTotal: 10,
      });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("4 - Implementation");
      expect(output).toContain("3/10");
    });

    it("shows default Ralph status when no status file exists", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("not started");
    });

    it("shows completed status", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "completed" });
      await setupRalphStatus({ status: "completed", tasksCompleted: 10, tasksTotal: 10 });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("completed");
    });

    it("suggests next action for phase 1", async () => {
      await setupProject();
      await setupState({ currentPhase: 1, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("/analyst");
    });

    it("uses Cursor-specific BMAD guidance instead of slash commands", async () => {
      await setupProject("cursor");
      await setupState({ currentPhase: 1, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_bmad/COMMANDS.md");
      expect(output).toContain("run the BMAD master agent");
      expect(output).not.toContain("/analyst");
      expect(output).not.toContain("/pm");
    });

    it("uses OpenCode-specific BMAD guidance instead of slash commands", async () => {
      await setupProject("opencode");
      await setupState({ currentPhase: 1, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".opencode/skills");
      expect(output).toContain("bmad-analyst");
      expect(output).not.toContain("/analyst");
      expect(output).not.toContain("/pm");
    });

    it("suggests bmalph implement for phase 3", async () => {
      await setupProject();
      await setupState({ currentPhase: 3, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bmalph implement");
    });

    it("suggests bmalph run for phase 4 not started", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bmalph run");
    });

    it("shows full-tier requirement for instructions-only platform at phase 4", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({
          name: "test",
          platform: "windsurf",
          createdAt: new Date().toISOString(),
        })
      );
      await setupState({ currentPhase: 4, status: "implementing" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("full-tier platform");
    });
  });

  describe("projectDir option", () => {
    it("uses projectDir instead of process.cwd() when provided", async () => {
      await setupProject();
      await setupState({ currentPhase: 1, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("1 - Analysis");
      expect(output).not.toContain("not initialized");
    });
  });

  describe("JSON output", () => {
    it("outputs valid JSON when json flag is true", async () => {
      await setupProject();
      await setupState({ currentPhase: 2, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true, projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("phase");
      expect(parsed).toHaveProperty("status");
      expect(parsed.phase).toBe(2);
    });

    it("includes Ralph status in JSON output for phase 4", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupRalphStatus({ loopCount: 3, status: "running", tasksCompleted: 2, tasksTotal: 5 });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true, projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("ralph");
      expect(parsed.ralph.loopCount).toBe(3);
      expect(parsed.ralph.tasksCompleted).toBe(2);
      expect(parsed.ralph.tasksTotal).toBe(5);
    });

    it("includes artifacts in JSON output for phases 1-3", async () => {
      await setupProject();
      const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "product-brief.md"), "# Brief");
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true, projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("artifacts");
      expect(parsed.artifacts.detectedPhase).toBe(2);
      expect(parsed.artifacts.found).toContain("prd.md");
      expect(parsed.artifacts.found).toContain("product-brief.md");
      expect(parsed.artifacts.missing).toContain("Architecture");
      expect(parsed.artifacts.directory).toBe("_bmad-output/planning-artifacts");
    });

    it("does not include artifacts in JSON output for phase 4", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true, projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).not.toHaveProperty("artifacts");
    });
  });

  describe("artifact detection", () => {
    async function setupArtifacts(files: string[]) {
      const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsDir, { recursive: true });
      for (const file of files) {
        await writeFile(join(artifactsDir, file), `# ${file}`);
      }
    }

    it("detects phase from artifacts when no state file exists", async () => {
      await setupProject();
      await setupArtifacts(["product-brief.md", "prd.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("2 - Planning");
      expect(output).toContain("detected from artifacts");
    });

    it("detects phase from artifacts when state has phase 1", async () => {
      await setupProject();
      await setupState({ currentPhase: 1, status: "planning" });
      await setupArtifacts(["product-brief.md", "prd.md", "architecture.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("3 - Solutioning");
      expect(output).toContain("detected from artifacts");
    });

    it("shows artifact checklist in human output", async () => {
      await setupProject();
      await setupArtifacts(["product-brief.md", "prd.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Artifacts");
      expect(output).toContain("Product Brief");
      expect(output).toContain("PRD");
      expect(output).toContain("Architecture");
      expect(output).toContain("required");
    });

    it("shows phase headings in artifact checklist", async () => {
      await setupProject();
      await setupArtifacts(["product-brief.md", "prd.md", "architecture.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Phase 1 - Analysis");
      expect(output).toContain("Phase 2 - Planning");
      expect(output).toContain("Phase 3 - Solutioning");
    });

    it("does not scan artifacts when state has phase 4", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupArtifacts(["prd.md", "architecture.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("4 - Implementation");
      expect(output).not.toContain("Artifacts");
      expect(output).not.toContain("detected from artifacts");
    });

    it("falls back to phase 1 when no artifacts directory exists", async () => {
      await setupProject();

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("1 - Analysis");
      expect(output).not.toContain("detected from artifacts");
    });

    it("uses artifact-based next action suggestion for detected phase", async () => {
      await setupProject();
      await setupArtifacts(["prd.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("/architect");
    });

    it("uses Cursor-specific artifact guidance without slash commands", async () => {
      await setupProject("cursor");
      await setupArtifacts(["prd.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_bmad/COMMANDS.md");
      expect(output).toContain("run the BMAD master agent");
      expect(output).not.toContain("/architect");
      expect(output).not.toContain("/create-epics-stories");
    });

    it("uses OpenCode-specific artifact guidance without slash commands", async () => {
      await setupProject("opencode");
      await setupArtifacts(["prd.md"]);

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".opencode/skills");
      expect(output).toContain("bmad-architect");
      expect(output).not.toContain("/architect");
      expect(output).not.toContain("/create-epics-stories");
    });
  });

  describe("completion mismatch detection", () => {
    it("shows completion message when Ralph completed but bmalph still implementing", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupRalphStatus({
        loopCount: 15,
        status: "completed",
        tasksCompleted: 10,
        tasksTotal: 10,
      });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Ralph has completed all tasks");
    });

    it("suggests reviewing changes as next action when Ralph completed", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupRalphStatus({
        loopCount: 15,
        status: "completed",
        tasksCompleted: 10,
        tasksTotal: 10,
      });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Review changes");
    });

    it("includes completion mismatch in JSON output when Ralph completed but bmalph implementing", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupRalphStatus({
        loopCount: 12,
        status: "completed",
        tasksCompleted: 8,
        tasksTotal: 8,
      });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true, projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed.completionMismatch).toBe(true);
    });

    it("does not flag completion mismatch in JSON when bmalph status is already completed", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "completed" });
      await setupRalphStatus({
        loopCount: 12,
        status: "completed",
        tasksCompleted: 8,
        tasksTotal: 8,
      });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true, projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed.completionMismatch).toBeUndefined();
    });

    it("detects completion mismatch from snake_case graceful_exit status", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupRalphStatus({
        loopCount: 10,
        status: "graceful_exit",
        tasksCompleted: 8,
        tasksTotal: 8,
      });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true, projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed.completionMismatch).toBe(true);
      expect(parsed.ralph.status).toBe("completed");
    });

    it("does not show completion message when Ralph is still running", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });
      await setupRalphStatus({
        loopCount: 5,
        status: "running",
        tasksCompleted: 3,
        tasksTotal: 10,
      });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ projectDir: testDir });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).not.toContain("Ralph has completed all tasks");
    });
  });
});
