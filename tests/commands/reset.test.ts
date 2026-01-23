import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
  },
}));

describe("reset command", () => {
  let testDir: string;
  let originalCwd: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-reset-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    await mkdir(join(testDir, "bmalph/artifacts/analysis"), { recursive: true });
    await writeFile(join(testDir, "bmalph/config.json"), "{}");
    await writeFile(join(testDir, "bmalph/state/current-phase.json"), "{}");
    await writeFile(join(testDir, "bmalph/artifacts/analysis/requirements.md"), "# Reqs");
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

  it("removes state directory on reset", async () => {
    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({});

    await expect(access(join(testDir, "bmalph/state"))).rejects.toThrow();
    // Artifacts should still exist
    await expect(
      access(join(testDir, "bmalph/artifacts/analysis/requirements.md"))
    ).resolves.toBeUndefined();
  });

  it("removes artifacts on hard reset", async () => {
    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ hard: true });

    await expect(access(join(testDir, "bmalph/state"))).rejects.toThrow();
    await expect(access(join(testDir, "bmalph/artifacts"))).rejects.toThrow();
  });

  it("fails when not initialized", async () => {
    await rm(join(testDir, "bmalph/config.json"));

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({});

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
