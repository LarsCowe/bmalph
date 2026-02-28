import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildPlatformDoctorChecks,
  createInstructionsFileCheck,
} from "../../src/platform/doctor-checks.js";
import { claudeCodePlatform } from "../../src/platform/claude-code.js";
import { aiderPlatform } from "../../src/platform/aider.js";

describe("doctor-checks", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("createInstructionsFileCheck", () => {
    it("passes when instructions file contains BMAD snippet", async () => {
      await writeFile(join(testDir, "CONVENTIONS.md"), "## BMAD-METHOD Integration\n\nContent.");
      const check = createInstructionsFileCheck(aiderPlatform);
      const result = await check.check(testDir);
      expect(result.passed).toBe(true);
    });

    it("fails when instructions file is missing the snippet", async () => {
      await writeFile(join(testDir, "CONVENTIONS.md"), "# Some other content");
      const check = createInstructionsFileCheck(aiderPlatform);
      const result = await check.check(testDir);
      expect(result.passed).toBe(false);
      expect(result.detail).toContain("missing");
    });

    it("fails when instructions file does not exist", async () => {
      const check = createInstructionsFileCheck(aiderPlatform);
      const result = await check.check(testDir);
      expect(result.passed).toBe(false);
      expect(result.detail).toContain("not found");
    });
  });

  describe("buildPlatformDoctorChecks", () => {
    it("includes slash-command check for directory delivery platforms", () => {
      const checks = buildPlatformDoctorChecks(claudeCodePlatform);
      const ids = checks.map((c) => c.id);
      expect(ids).toContain("slash-command");
      expect(ids).toContain("instructions-file");
    });

    it("omits slash-command check for non-directory delivery platforms", () => {
      const checks = buildPlatformDoctorChecks(aiderPlatform);
      const ids = checks.map((c) => c.id);
      expect(ids).not.toContain("slash-command");
      expect(ids).toContain("instructions-file");
    });

    it("slash-command check passes when file exists", async () => {
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });
      await writeFile(join(testDir, ".claude/commands/bmalph.md"), "content");
      const checks = buildPlatformDoctorChecks(claudeCodePlatform);
      const slashCheck = checks.find((c) => c.id === "slash-command")!;
      const result = await slashCheck.check(testDir);
      expect(result.passed).toBe(true);
    });

    it("slash-command check fails when file missing", async () => {
      const checks = buildPlatformDoctorChecks(claudeCodePlatform);
      const slashCheck = checks.find((c) => c.id === "slash-command")!;
      const result = await slashCheck.check(testDir);
      expect(result.passed).toBe(false);
    });
  });
});
