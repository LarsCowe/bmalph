import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { mkdir, rm, writeFile } from "fs/promises";

vi.mock("chalk");

vi.mock("../../src/watch/dashboard.js", () => ({
  startDashboard: vi.fn().mockResolvedValue(undefined),
}));

import { watchCommand } from "../../src/commands/watch.js";
import { startDashboard } from "../../src/watch/dashboard.js";

const mockStartDashboard = vi.mocked(startDashboard);

describe("watchCommand", () => {
  let testDir: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDir = join(
      tmpdir(),
      `bmalph-watch-cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      /* Windows file locking */
    }
  });

  it("fails when project is not initialized", async () => {
    const emptyDir = join(
      tmpdir(),
      `bmalph-watch-empty-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(emptyDir, { recursive: true });

    await watchCommand({ projectDir: emptyDir });

    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;

    try {
      await rm(emptyDir, { recursive: true, force: true });
    } catch {
      /* Windows file locking */
    }
  });

  it("starts dashboard with default interval", async () => {
    await writeFile(
      join(testDir, "bmalph", "config.json"),
      JSON.stringify({
        name: "test-project",
        description: "",
        createdAt: "2026-02-25T00:00:00Z",
      })
    );

    await watchCommand({ projectDir: testDir });

    expect(mockStartDashboard).toHaveBeenCalledWith({
      projectDir: testDir,
      interval: 2000,
    });
  });

  it("starts dashboard with custom interval", async () => {
    await writeFile(
      join(testDir, "bmalph", "config.json"),
      JSON.stringify({
        name: "test-project",
        description: "",
        createdAt: "2026-02-25T00:00:00Z",
      })
    );

    await watchCommand({ projectDir: testDir, interval: "5000" });

    expect(mockStartDashboard).toHaveBeenCalledWith({
      projectDir: testDir,
      interval: 5000,
    });
  });

  it("rejects interval below 500ms", async () => {
    await writeFile(
      join(testDir, "bmalph", "config.json"),
      JSON.stringify({
        name: "test-project",
        description: "",
        createdAt: "2026-02-25T00:00:00Z",
      })
    );

    await watchCommand({ projectDir: testDir, interval: "100" });

    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("rejects non-numeric interval", async () => {
    await writeFile(
      join(testDir, "bmalph", "config.json"),
      JSON.stringify({
        name: "test-project",
        description: "",
        createdAt: "2026-02-25T00:00:00Z",
      })
    );

    await watchCommand({ projectDir: testDir, interval: "abc" });

    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });

  it("accepts interval at minimum boundary of 500ms", async () => {
    await writeFile(
      join(testDir, "bmalph", "config.json"),
      JSON.stringify({
        name: "test-project",
        description: "",
        createdAt: "2026-02-25T00:00:00Z",
      })
    );

    await watchCommand({ projectDir: testDir, interval: "500" });

    expect(mockStartDashboard).toHaveBeenCalledWith({
      projectDir: testDir,
      interval: 500,
    });
  });
});
