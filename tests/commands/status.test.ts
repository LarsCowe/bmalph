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
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

describe("statusCommand", () => {
  let testDir: string;
  let originalCwd: () => string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-status-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    originalCwd = process.cwd;
    process.cwd = () => testDir;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    consoleLogSpy.mockRestore();
    vi.resetModules();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("shows error when not initialized", async () => {
    // Remove config to simulate uninitialized
    await rm(join(testDir, "bmalph"), { recursive: true, force: true });
    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
  });

  it("shows project info when initialized", async () => {
    const config = {
      name: "my-project",
      description: "A test",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify(config));

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("my-project");
  });

  it("shows current phase from state", async () => {
    const config = { name: "proj", description: "", createdAt: "2025-01-01T00:00:00.000Z" };
    const state = {
      currentPhase: 3,
      status: "planning",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: new Date().toISOString(),
    };
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify(config));
    await writeFile(join(testDir, "bmalph/state/current-phase.json"), JSON.stringify(state));

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("3");
    expect(output).toContain("Solutioning");
    expect(output).toContain("planning");
  });

  it("shows phase 1 when no state file exists", async () => {
    const config = { name: "proj", description: "", createdAt: "2025-01-01T00:00:00.000Z" };
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify(config));

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1");
    expect(output).toContain("Analysis");
  });

  it("shows Ralph status when available", async () => {
    const config = { name: "proj", description: "", createdAt: "2025-01-01T00:00:00.000Z" };
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify(config));
    await mkdir(join(testDir, ".ralph"), { recursive: true });
    await writeFile(
      join(testDir, ".ralph/status.json"),
      JSON.stringify({ loopCount: 5, status: "running", tasksCompleted: 3, tasksTotal: 10 })
    );

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("running");
  });

  it("shows idle Ralph status when no status file", async () => {
    const config = { name: "proj", description: "", createdAt: "2025-01-01T00:00:00.000Z" };
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify(config));

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("not_started");
  });
});
