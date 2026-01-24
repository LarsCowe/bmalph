import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
  },
}));

describe("status command", () => {
  let testDir: string;
  let originalCwd: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-status-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(testDir);
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleSpy.mockRestore();
    vi.resetModules();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("reports not initialized when no config", async () => {
    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
  });

  it("shows no active phase when no state exists", async () => {
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ name: "test", description: "desc", level: 2, createdAt: "2025-01-01T00:00:00Z" }),
    );

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("test");
    expect(output).toContain("No active phase");
  });

  it("shows planning phase info for phases 1-3", async () => {
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ name: "my-app", level: 2 }),
    );
    await writeFile(
      join(testDir, "bmalph/state/current-phase.json"),
      JSON.stringify({
        currentPhase: 2,
        status: "planning",
        startedAt: "2025-01-01T00:00:00Z",
        lastUpdated: "2025-01-01T01:00:00Z",
      }),
    );

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("my-app");
    expect(output).toContain("2");
    expect(output).toContain("Planning");
    expect(output).toContain("CP");
  });

  it("shows ralph status for phase 4", async () => {
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ name: "my-app", level: 2 }),
    );
    await writeFile(
      join(testDir, "bmalph/state/current-phase.json"),
      JSON.stringify({
        currentPhase: 4,
        status: "implementing",
        startedAt: "2025-01-01T00:00:00Z",
        lastUpdated: "2025-01-01T01:00:00Z",
      }),
    );
    await mkdir(join(testDir, ".ralph"), { recursive: true });
    await writeFile(
      join(testDir, ".ralph/status.json"),
      JSON.stringify({ loopCount: 3, status: "running", tasksCompleted: 2, tasksTotal: 8 }),
    );

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Implementation");
    expect(output).toContain("3 iterations");
    expect(output).toContain("2/8");
    expect(output).toContain("Running");
  });
});
