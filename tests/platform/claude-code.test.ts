import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { claudeCodePlatform } from "../../src/platform/claude-code.js";

describe("claudeCodePlatform", () => {
  it("has correct id, displayName, and tier", () => {
    expect(claudeCodePlatform.id).toBe("claude-code");
    expect(claudeCodePlatform.displayName).toBe("Claude Code");
    expect(claudeCodePlatform.tier).toBe("full");
  });

  it("instructionsFile is CLAUDE.md", () => {
    expect(claudeCodePlatform.instructionsFile).toBe("CLAUDE.md");
  });

  it("commandDelivery is directory kind with .claude/commands dir", () => {
    expect(claudeCodePlatform.commandDelivery).toEqual({
      kind: "directory",
      dir: ".claude/commands",
    });
  });

  it("generateInstructionsSnippet contains BMAD-METHOD Integration", () => {
    const snippet = claudeCodePlatform.generateInstructionsSnippet();
    expect(snippet).toContain("BMAD-METHOD Integration");
  });

  it("generateInstructionsSnippet contains slash command references", () => {
    const snippet = claudeCodePlatform.generateInstructionsSnippet();
    expect(snippet).toContain("/bmalph");
    expect(snippet).toContain("/analyst");
    expect(snippet).toContain("/architect");
    expect(snippet).toContain("/pm");
  });

  it("getDoctorChecks returns 2 checks", () => {
    const checks = claudeCodePlatform.getDoctorChecks();
    expect(checks).toHaveLength(2);
  });

  describe("doctor checks", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(
        tmpdir(),
        `bmalph-claude-code-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    it("slash-command check passes when file exists", async () => {
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });
      await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph");
      const checks = claudeCodePlatform.getDoctorChecks();
      const slashCheck = checks.find((c) => c.id === "slash-command")!;
      const result = await slashCheck.check(testDir);
      expect(result.passed).toBe(true);
    });

    it("slash-command check fails when file missing", async () => {
      const checks = claudeCodePlatform.getDoctorChecks();
      const slashCheck = checks.find((c) => c.id === "slash-command")!;
      const result = await slashCheck.check(testDir);
      expect(result.passed).toBe(false);
      expect(result.hint).toContain("bmalph init");
    });

    it("instructions-file check passes when CLAUDE.md has marker", async () => {
      await writeFile(join(testDir, "CLAUDE.md"), "## BMAD-METHOD Integration\nContent here");
      const checks = claudeCodePlatform.getDoctorChecks();
      const instrCheck = checks.find((c) => c.id === "instructions-file")!;
      const result = await instrCheck.check(testDir);
      expect(result.passed).toBe(true);
    });

    it("instructions-file check fails when CLAUDE.md missing", async () => {
      const checks = claudeCodePlatform.getDoctorChecks();
      const instrCheck = checks.find((c) => c.id === "instructions-file")!;
      const result = await instrCheck.check(testDir);
      expect(result.passed).toBe(false);
      expect(result.detail).toContain("not found");
    });
  });
});
