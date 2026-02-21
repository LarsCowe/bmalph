import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { detectPlatform } from "../../src/platform/detect.js";

describe("detectPlatform", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-detect-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("returns claude-code when .claude/ exists", async () => {
    await mkdir(join(testDir, ".claude"), { recursive: true });
    const result = await detectPlatform(testDir);
    expect(result.detected).toBe("claude-code");
  });

  it("returns codex when AGENTS.md exists", async () => {
    await writeFile(join(testDir, "AGENTS.md"), "# Agents");
    const result = await detectPlatform(testDir);
    expect(result.detected).toBe("codex");
  });

  it("returns null when no markers found", async () => {
    const result = await detectPlatform(testDir);
    expect(result.detected).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });

  it("returns null with multiple candidates when both .claude/ and AGENTS.md exist", async () => {
    await mkdir(join(testDir, ".claude"), { recursive: true });
    await writeFile(join(testDir, "AGENTS.md"), "# Agents");
    const result = await detectPlatform(testDir);
    expect(result.detected).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("candidates array contains all matched platforms", async () => {
    await mkdir(join(testDir, ".claude"), { recursive: true });
    await writeFile(join(testDir, "AGENTS.md"), "# Agents");
    const result = await detectPlatform(testDir);
    expect(result.candidates).toContain("claude-code");
    expect(result.candidates).toContain("codex");
  });

  it("returns cursor when .cursor/ exists", async () => {
    await mkdir(join(testDir, ".cursor"), { recursive: true });
    const result = await detectPlatform(testDir);
    expect(result.detected).toBe("cursor");
  });

  it("returns copilot when .github/copilot-instructions.md exists", async () => {
    await mkdir(join(testDir, ".github"), { recursive: true });
    await writeFile(join(testDir, ".github/copilot-instructions.md"), "# Copilot");
    const result = await detectPlatform(testDir);
    expect(result.detected).toBe("copilot");
  });

  it("returns windsurf when .windsurf/ exists", async () => {
    await mkdir(join(testDir, ".windsurf"), { recursive: true });
    const result = await detectPlatform(testDir);
    expect(result.detected).toBe("windsurf");
  });

  it("returns aider when .aider.conf.yml exists", async () => {
    await writeFile(join(testDir, ".aider.conf.yml"), "model: gpt-4");
    const result = await detectPlatform(testDir);
    expect(result.detected).toBe("aider");
  });
});
