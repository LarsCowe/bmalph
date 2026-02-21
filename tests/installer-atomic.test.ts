import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdir, rm, writeFile, access, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const { mockRename } = vi.hoisted(() => ({
  mockRename: vi.fn(),
}));

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
  return { ...actual, rename: mockRename };
});

import { copyBundledAssets } from "../src/installer.js";

describe("installer atomic copy", { timeout: 30000 }, () => {
  let testDir: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("restores original _bmad when final rename fails", async () => {
    testDir = join(tmpdir(), `bmalph-atomic-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Create an existing _bmad with a marker file
    const bmadDir = join(testDir, "_bmad");
    await mkdir(join(bmadDir, "core"), { recursive: true });
    await writeFile(join(bmadDir, "core", "marker.txt"), "original");

    const { rename: realRename } =
      await vi.importActual<typeof import("fs/promises")>("fs/promises");
    mockRename.mockImplementation(async (src: string, dest: string) => {
      // Fail the final swap: _bmad.new → _bmad
      if (String(src).endsWith("_bmad.new") && String(dest).endsWith("_bmad")) {
        throw new Error("Simulated rename failure");
      }
      return (realRename as typeof import("fs/promises").rename)(src, dest);
    });

    await expect(copyBundledAssets(testDir)).rejects.toThrow("Simulated rename failure");

    // Original _bmad should be restored
    await expect(access(join(bmadDir, "core"))).resolves.toBeUndefined();
    const content = await readFile(join(bmadDir, "core", "marker.txt"), "utf-8");
    expect(content).toBe("original");
  });

  it("cleans up _bmad.old on success", async () => {
    testDir = join(tmpdir(), `bmalph-atomic-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Create existing _bmad
    await mkdir(join(testDir, "_bmad", "core"), { recursive: true });
    await writeFile(join(testDir, "_bmad", "core", "marker.txt"), "will be replaced");

    const { rename: realRename } =
      await vi.importActual<typeof import("fs/promises")>("fs/promises");
    mockRename.mockImplementation(async (src: string, dest: string) => {
      return (realRename as typeof import("fs/promises").rename)(src, dest);
    });

    await copyBundledAssets(testDir);

    // _bmad.old should be cleaned up
    await expect(access(join(testDir, "_bmad.old"))).rejects.toThrow();
    // _bmad should exist with real content
    await expect(access(join(testDir, "_bmad", "core"))).resolves.toBeUndefined();
  });

  it("cleans up leftover _bmad.old from previous failed attempt", async () => {
    testDir = join(tmpdir(), `bmalph-atomic-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Create stale _bmad.old from a previous failed run
    await mkdir(join(testDir, "_bmad.old", "stale"), { recursive: true });
    await writeFile(join(testDir, "_bmad.old", "stale", "data.txt"), "stale data");

    const { rename: realRename } =
      await vi.importActual<typeof import("fs/promises")>("fs/promises");
    mockRename.mockImplementation(async (src: string, dest: string) => {
      return (realRename as typeof import("fs/promises").rename)(src, dest);
    });

    await copyBundledAssets(testDir);

    // Stale _bmad.old should be cleaned up
    await expect(access(join(testDir, "_bmad.old"))).rejects.toThrow();
  });

  it("handles first install when no _bmad exists", async () => {
    testDir = join(tmpdir(), `bmalph-atomic-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // No _bmad directory exists — first install
    const { rename: realRename } =
      await vi.importActual<typeof import("fs/promises")>("fs/promises");
    mockRename.mockImplementation(async (src: string, dest: string) => {
      return (realRename as typeof import("fs/promises").rename)(src, dest);
    });

    await copyBundledAssets(testDir);

    // _bmad should be created successfully
    await expect(access(join(testDir, "_bmad", "core"))).resolves.toBeUndefined();
    // No leftover .old or .new
    await expect(access(join(testDir, "_bmad.old"))).rejects.toThrow();
    await expect(access(join(testDir, "_bmad.new"))).rejects.toThrow();
  });
});
