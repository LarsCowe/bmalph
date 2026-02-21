import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("resolveProjectPlatform", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-resolve-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("returns claude-code when config is missing", async () => {
    const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
    const platform = await resolveProjectPlatform(testDir);
    expect(platform.id).toBe("claude-code");
  });

  it("returns claude-code when config has no platform field", async () => {
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({
        name: "legacy-project",
        description: "No platform field",
        createdAt: "2025-01-01T00:00:00.000Z",
      })
    );

    const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
    const platform = await resolveProjectPlatform(testDir);
    expect(platform.id).toBe("claude-code");
  });

  it("returns codex when config specifies codex", async () => {
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({
        name: "codex-project",
        description: "A codex project",
        createdAt: "2025-06-15T10:30:00.000Z",
        platform: "codex",
      })
    );

    const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
    const platform = await resolveProjectPlatform(testDir);
    expect(platform.id).toBe("codex");
  });

  it("returns cursor when config specifies cursor", async () => {
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({
        name: "cursor-project",
        description: "A cursor project",
        createdAt: "2025-06-15T10:30:00.000Z",
        platform: "cursor",
      })
    );

    const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
    const platform = await resolveProjectPlatform(testDir);
    expect(platform.id).toBe("cursor");
  });

  it("falls back to claude-code when config.json is corrupt", async () => {
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(join(testDir, "bmalph/config.json"), "not valid json{{{");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
    const platform = await resolveProjectPlatform(testDir);
    expect(platform.id).toBe("claude-code");

    warnSpy.mockRestore();
  });
});
