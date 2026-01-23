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
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-status-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(testDir);
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    vi.resetModules();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking - ignore cleanup errors
    }
  });

  it("reports not initialized when no config", async () => {
    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
  });

  it("shows not started when no state", async () => {
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({
        name: "test",
        description: "test project",
        level: 2,
        createdAt: "2025-01-01T00:00:00.000Z",
      })
    );

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("test");
    expect(output).toContain("Not started");
  });

  it("shows current state when running", async () => {
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({
        name: "my-app",
        description: "My application",
        level: 3,
        createdAt: "2025-01-01T00:00:00.000Z",
      })
    );
    await writeFile(
      join(testDir, "bmalph/state/current-phase.json"),
      JSON.stringify({
        currentPhase: 2,
        iteration: 5,
        status: "running",
        startedAt: "2025-01-01T00:00:00.000Z",
        lastUpdated: "2025-01-01T01:00:00.000Z",
      })
    );

    const { statusCommand } = await import("../../src/commands/status.js");
    await statusCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("my-app");
    expect(output).toContain("2/4");
    expect(output).toContain("Planning");
    expect(output).toContain("running");
  });
});
