import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readConfig,
  writeConfig,
  readBmadConfig,
  type BmalphConfig,
} from "../../src/utils/config.js";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ garbage: true }));

    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await readConfig(testDir);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Config file is corrupted"));
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

describe("readBmadConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-bmad-config-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, "_bmad"), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("returns null when config file does not exist", async () => {
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
  });

  it("returns config when valid YAML with planning_artifacts", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: my-artifacts\n");
    const result = await readBmadConfig(testDir);
    expect(result).toEqual({ planning_artifacts: "my-artifacts" });
  });

  it("returns config when valid YAML with all fields", async () => {
    const yaml = `
planning_artifacts: my-artifacts
project_name: Test Project
platform: claude-code
`;
    await writeFile(join(testDir, "_bmad/config.yaml"), yaml);
    const result = await readBmadConfig(testDir);
    expect(result).toEqual({
      planning_artifacts: "my-artifacts",
      project_name: "Test Project",
      platform: "claude-code",
    });
  });

  it("returns null and warns for malformed YAML", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: [invalid");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Error reading BMAD config"));
    warnSpy.mockRestore();
  });

  it("returns null and warns for non-string planning_artifacts field", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: 123\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("bmadConfig.planning_artifacts must be a string")
    );
    warnSpy.mockRestore();
  });

  it("returns null and warns for boolean planning_artifacts field", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: true\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("bmadConfig.planning_artifacts must be a string")
    );
    warnSpy.mockRestore();
  });

  it("returns null and warns for object planning_artifacts field", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts:\n  foo: bar\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("bmadConfig.planning_artifacts must be a string")
    );
    warnSpy.mockRestore();
  });

  it("returns null and warns for empty YAML file", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Error reading BMAD config"));
    warnSpy.mockRestore();
  });

  it("returns null and warns when YAML parses to a scalar", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "just a string\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Error reading BMAD config"));
    warnSpy.mockRestore();
  });

  it("returns null and warns when YAML parses to an array", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "- item1\n- item2\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Error reading BMAD config"));
    warnSpy.mockRestore();
  });

  it("returns null and warns for non-string platform field", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "platform: 123\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("bmadConfig.platform must be a string")
    );
    warnSpy.mockRestore();
  });

  it("returns null and warns for non-string project_name field", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "project_name: true\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("bmadConfig.project_name must be a string")
    );
    warnSpy.mockRestore();
  });

  it("returns null and warns for non-string output_folder field", async () => {
    await writeFile(join(testDir, "_bmad/config.yaml"), "output_folder: 42\n");
    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await readBmadConfig(testDir);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("bmadConfig.output_folder must be a string")
    );
    warnSpy.mockRestore();
  });
});
