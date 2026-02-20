import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readConfig, writeConfig, type BmalphConfig } from "../../src/utils/config.js";
import { mkdir, rm, readdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("config", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-test-${Date.now()}`);
    await mkdir(join(testDir, "bmalph"), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("returns null when config does not exist", async () => {
    const config = await readConfig(testDir);
    expect(config).toBeNull();
  });

  it("writes and reads config", async () => {
    const config: BmalphConfig = {
      name: "test-project",
      description: "A test",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    await writeConfig(testDir, config);
    const result = await readConfig(testDir);

    expect(result).toEqual(config);
  });

  it("creates bmalph directory if it does not exist", async () => {
    // Remove the directory created in beforeEach
    await rm(join(testDir, "bmalph"), { recursive: true, force: true });

    const config: BmalphConfig = {
      name: "new-project",
      description: "Should create directory",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    await writeConfig(testDir, config);
    const result = await readConfig(testDir);

    expect(result).toEqual(config);
  });

  it("returns null and warns when config file has invalid structure", async () => {
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ garbage: true })
    );

    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await readConfig(testDir);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Config file is corrupted")
    );
    warnSpy.mockRestore();
  });

  it("leaves no temp files after write", async () => {
    const config: BmalphConfig = {
      name: "atomic-project",
      description: "Test atomic write",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    await writeConfig(testDir, config);

    const files = await readdir(join(testDir, "bmalph"));
    const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
    expect(tmpFiles).toHaveLength(0);
  });
});
