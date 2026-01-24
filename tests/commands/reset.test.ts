import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

describe("reset command", () => {
  let testDir: string;
  let originalCwd: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-reset-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    await mkdir(join(testDir, "_bmad/core"), { recursive: true });
    await mkdir(join(testDir, ".ralph/specs"), { recursive: true });
    await writeFile(join(testDir, "bmalph/config.json"), "{}");
    await writeFile(join(testDir, "bmalph/state/current-phase.json"), "{}");
    await writeFile(join(testDir, "_bmad/core/test.yaml"), "test: true");
    await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash");
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

  it("removes state directory on reset", async () => {
    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({});

    await expect(access(join(testDir, "bmalph/state"))).rejects.toThrow();
    // _bmad and .ralph should still exist
    await expect(access(join(testDir, "_bmad/core/test.yaml"))).resolves.toBeUndefined();
    await expect(access(join(testDir, ".ralph/ralph_loop.sh"))).resolves.toBeUndefined();
  });

  it("removes all artifacts on hard reset", async () => {
    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ hard: true });

    await expect(access(join(testDir, "bmalph"))).rejects.toThrow();
    await expect(access(join(testDir, "_bmad"))).rejects.toThrow();
    await expect(access(join(testDir, ".ralph"))).rejects.toThrow();
  });

  it("reports not initialized when no config", async () => {
    await rm(join(testDir, "bmalph/config.json"));

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("not initialized"),
    );
  });
});
