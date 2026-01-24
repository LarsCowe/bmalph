import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readJsonFile } from "../../src/utils/json.js";
import { mkdir, rm, writeFile, chmod } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { platform } from "process";

describe("readJsonFile", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-json-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("returns null when file does not exist", async () => {
    const result = await readJsonFile(join(testDir, "nonexistent.json"));
    expect(result).toBeNull();
  });

  it("parses valid JSON file", async () => {
    const data = { name: "test", value: 42 };
    await writeFile(join(testDir, "valid.json"), JSON.stringify(data));

    const result = await readJsonFile<{ name: string; value: number }>(
      join(testDir, "valid.json")
    );
    expect(result).toEqual(data);
  });

  it("throws on corrupt/invalid JSON", async () => {
    await writeFile(join(testDir, "corrupt.json"), "{ not valid json !!!");

    await expect(readJsonFile(join(testDir, "corrupt.json"))).rejects.toThrow();
  });

  it("throws on permission error (non-Windows)", async () => {
    if (platform === "win32") return; // chmod doesn't work on Windows

    const filePath = join(testDir, "noperm.json");
    await writeFile(filePath, '{"key": "value"}');
    await chmod(filePath, 0o000);

    await expect(readJsonFile(filePath)).rejects.toThrow();

    // Restore permissions for cleanup
    await chmod(filePath, 0o644);
  });

  it("handles empty file as parse error", async () => {
    await writeFile(join(testDir, "empty.json"), "");

    await expect(readJsonFile(join(testDir, "empty.json"))).rejects.toThrow();
  });
});
