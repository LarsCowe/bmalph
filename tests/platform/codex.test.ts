import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { codexPlatform } from "../../src/platform/codex.js";

describe("codexPlatform", () => {
  it("has correct id, displayName, and tier", () => {
    expect(codexPlatform.id).toBe("codex");
    expect(codexPlatform.displayName).toBe("OpenAI Codex");
    expect(codexPlatform.tier).toBe("full");
  });

  it("instructionsFile is AGENTS.md", () => {
    expect(codexPlatform.instructionsFile).toBe("AGENTS.md");
  });

  it("commandDelivery is inline kind", () => {
    expect(codexPlatform.commandDelivery).toEqual({ kind: "inline" });
  });

  it("generateInstructionsSnippet contains BMAD-METHOD Integration", () => {
    const snippet = codexPlatform.generateInstructionsSnippet();
    expect(snippet).toContain("BMAD-METHOD Integration");
  });

  it("generateInstructionsSnippet does not contain slash command syntax", () => {
    const snippet = codexPlatform.generateInstructionsSnippet();
    expect(snippet).not.toMatch(/\/bmalph\b/);
    expect(snippet).not.toMatch(/\/analyst\b/);
    expect(snippet).not.toMatch(/\/architect\b/);
  });

  it("getDoctorChecks returns 1 check", () => {
    const checks = codexPlatform.getDoctorChecks();
    expect(checks).toHaveLength(1);
  });

  describe("doctor checks", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `bmalph-codex-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    it("instructions-file check passes when AGENTS.md has marker", async () => {
      await writeFile(join(testDir, "AGENTS.md"), "## BMAD-METHOD Integration\nContent here");
      const checks = codexPlatform.getDoctorChecks();
      const instrCheck = checks.find((c) => c.id === "instructions-file")!;
      const result = await instrCheck.check(testDir);
      expect(result.passed).toBe(true);
    });

    it("instructions-file check fails when AGENTS.md missing", async () => {
      const checks = codexPlatform.getDoctorChecks();
      const instrCheck = checks.find((c) => c.id === "instructions-file")!;
      const result = await instrCheck.check(testDir);
      expect(result.passed).toBe(false);
      expect(result.detail).toContain("not found");
    });
  });
});
