import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    blue: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
    white: (s: string) => s,
  },
}));

describe("status command", () => {
  let testDir: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-test-status-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Reset module cache for fresh imports
    vi.resetModules();
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  async function setupProject() {
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ name: "test", createdAt: new Date().toISOString() })
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
    await writeFile(
      join(testDir, ".ralph/status.json"),
      JSON.stringify({
        loopCount: status.loopCount ?? 0,
        status: status.status ?? "not_started",
        tasksCompleted: status.tasksCompleted ?? 0,
        tasksTotal: status.tasksTotal ?? 0,
      })
    );
  }

  describe("runStatus", () => {
    it("shows error when no project is initialized", async () => {
      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("not initialized");
    });

    it("shows phase 1 status when in planning", async () => {
      await setupProject();
      await setupState({ currentPhase: 1, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus();

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
      await runStatus();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("4 - Implementation");
      expect(output).toContain("3/10");
    });

    it("shows default Ralph status when no status file exists", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "implementing" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("not started");
    });

    it("shows completed status", async () => {
      await setupProject();
      await setupState({ currentPhase: 4, status: "completed" });
      await setupRalphStatus({ status: "completed", tasksCompleted: 10, tasksTotal: 10 });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("completed");
    });

    it("suggests next action for phase 1", async () => {
      await setupProject();
      await setupState({ currentPhase: 1, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("/analyst");
    });

    it("suggests /bmalph-implement for phase 3 completed", async () => {
      await setupProject();
      await setupState({ currentPhase: 3, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("/bmalph-implement");
    });
  });

  describe("JSON output", () => {
    it("outputs valid JSON when json flag is true", async () => {
      await setupProject();
      await setupState({ currentPhase: 2, status: "planning" });

      const { runStatus } = await import("../../src/commands/status.js");
      await runStatus({ json: true });

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
      await runStatus({ json: true });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("ralph");
      expect(parsed.ralph.loopCount).toBe(3);
      expect(parsed.ralph.tasksCompleted).toBe(2);
      expect(parsed.ralph.tasksTotal).toBe(5);
    });
  });
});
