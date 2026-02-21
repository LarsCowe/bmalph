import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { cursorPlatform } from "../../src/platform/cursor.js";
import { windsurfPlatform } from "../../src/platform/windsurf.js";
import { copilotPlatform } from "../../src/platform/copilot.js";
import { aiderPlatform } from "../../src/platform/aider.js";
import type { Platform } from "../../src/platform/types.js";

const idePlatforms: Array<{ platform: Platform; expectedFile: string }> = [
  { platform: cursorPlatform, expectedFile: ".cursor/rules/bmad.mdc" },
  { platform: windsurfPlatform, expectedFile: ".windsurf/rules/bmad.md" },
  { platform: copilotPlatform, expectedFile: ".github/copilot-instructions.md" },
  { platform: aiderPlatform, expectedFile: "CONVENTIONS.md" },
];

describe("IDE-only platforms", () => {
  for (const { platform, expectedFile } of idePlatforms) {
    describe(platform.displayName, () => {
      it("has tier instructions-only", () => {
        expect(platform.tier).toBe("instructions-only");
      });

      it("has commandDelivery kind none", () => {
        expect(platform.commandDelivery).toEqual({ kind: "none" });
      });

      it(`instructionsFile is ${expectedFile}`, () => {
        expect(platform.instructionsFile).toBe(expectedFile);
      });

      it("generateInstructionsSnippet does not contain slash command syntax", () => {
        const snippet = platform.generateInstructionsSnippet();
        expect(snippet).not.toMatch(/\/bmalph\b/);
        expect(snippet).not.toMatch(/\/analyst\b/);
        expect(snippet).not.toMatch(/\/architect\b/);
        expect(snippet).not.toMatch(/\/pm\b/);
      });

      it("generateInstructionsSnippet contains BMAD-METHOD Integration", () => {
        const snippet = platform.generateInstructionsSnippet();
        expect(snippet).toContain("BMAD-METHOD Integration");
      });

      it("getDoctorChecks returns at least 1 check", () => {
        const checks = platform.getDoctorChecks();
        expect(checks.length).toBeGreaterThanOrEqual(1);
      });
    });
  }

  describe("doctor checks with filesystem", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `bmalph-ide-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    for (const { platform, expectedFile } of idePlatforms) {
      it(`${platform.displayName} check passes when instructions file has marker`, async () => {
        const filePath = join(testDir, expectedFile);
        await mkdir(join(filePath, ".."), { recursive: true });
        await writeFile(filePath, "## BMAD-METHOD Integration\nContent");
        const checks = platform.getDoctorChecks();
        const instrCheck = checks.find((c) => c.id === "instructions-file")!;
        const result = await instrCheck.check(testDir);
        expect(result.passed).toBe(true);
      });

      it(`${platform.displayName} check fails when instructions file missing`, async () => {
        const checks = platform.getDoctorChecks();
        const instrCheck = checks.find((c) => c.id === "instructions-file")!;
        const result = await instrCheck.check(testDir);
        expect(result.passed).toBe(false);
      });

      it(`${platform.displayName} check fails when instructions file has wrong content`, async () => {
        const filePath = join(testDir, expectedFile);
        await mkdir(join(filePath, ".."), { recursive: true });
        await writeFile(filePath, "# My Project\n\nUnrelated content without the marker.");
        const checks = platform.getDoctorChecks();
        const instrCheck = checks.find((c) => c.id === "instructions-file")!;
        const result = await instrCheck.check(testDir);
        expect(result.passed).toBe(false);
        expect(result.detail).toContain("missing");
      });
    }
  });
});
