import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  findArtifactsDir,
  validateArtifacts,
} from "../../src/transition/artifacts.js";

describe("artifacts", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-artifacts-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

  describe("findArtifactsDir", () => {
    it("returns path when _bmad-output/planning-artifacts exists", async () => {
      const artifactsPath = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsPath, { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(artifactsPath);
    });

    it("returns path when _bmad-output/planning_artifacts exists", async () => {
      const artifactsPath = join(testDir, "_bmad-output/planning_artifacts");
      await mkdir(artifactsPath, { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(artifactsPath);
    });

    it("returns path when docs/planning exists", async () => {
      const artifactsPath = join(testDir, "docs/planning");
      await mkdir(artifactsPath, { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(artifactsPath);
    });

    it("returns null when no artifacts directory exists", async () => {
      const result = await findArtifactsDir(testDir);

      expect(result).toBeNull();
    });

    it("prefers _bmad-output/planning-artifacts over docs/planning", async () => {
      const bmadPath = join(testDir, "_bmad-output/planning-artifacts");
      const docsPath = join(testDir, "docs/planning");
      await mkdir(bmadPath, { recursive: true });
      await mkdir(docsPath, { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(bmadPath);
    });
  });

  describe("validateArtifacts", () => {
    it("returns no warnings when PRD and architecture exist", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");
      await writeFile(join(artifactsDir, "architecture.md"), "# Architecture");

      const files = ["prd.md", "architecture.md"];
      const warnings = await validateArtifacts(files, artifactsDir);

      expect(warnings).toHaveLength(0);
    });

    it("warns when PRD is missing", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "architecture.md"), "# Architecture");

      const files = ["architecture.md"];
      const warnings = await validateArtifacts(files, artifactsDir);

      expect(warnings).toContain(
        "No PRD document found in planning artifacts"
      );
    });

    it("warns when architecture is missing", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");

      const files = ["prd.md"];
      const warnings = await validateArtifacts(files, artifactsDir);

      expect(warnings).toContain(
        "No architecture document found in planning artifacts"
      );
    });

    it("detects NO-GO status in readiness report", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");
      await writeFile(join(artifactsDir, "architecture.md"), "# Architecture");
      await writeFile(
        join(artifactsDir, "readiness-report.md"),
        `# Readiness Report

## Status

**NO-GO** - Missing test coverage requirements.
`
      );

      const files = ["prd.md", "architecture.md", "readiness-report.md"];
      const warnings = await validateArtifacts(files, artifactsDir);

      expect(warnings).toContain("Readiness report indicates NO-GO status");
    });

    it("detects NO GO status with space", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");
      await writeFile(join(artifactsDir, "architecture.md"), "# Architecture");
      await writeFile(
        join(artifactsDir, "readiness.md"),
        "Status: NO GO - Blocking issues remain."
      );

      const files = ["prd.md", "architecture.md", "readiness.md"];
      const warnings = await validateArtifacts(files, artifactsDir);

      expect(warnings).toContain("Readiness report indicates NO-GO status");
    });

    it("does not warn for GO status in readiness report", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");
      await writeFile(join(artifactsDir, "architecture.md"), "# Architecture");
      await writeFile(
        join(artifactsDir, "readiness.md"),
        `# Readiness Report

## Status

**GO** - All requirements met.
`
      );

      const files = ["prd.md", "architecture.md", "readiness.md"];
      const warnings = await validateArtifacts(files, artifactsDir);

      expect(warnings).toHaveLength(0);
    });

    it("handles unreadable readiness file gracefully", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");
      await writeFile(join(artifactsDir, "architecture.md"), "# Architecture");
      // No actual readiness file, just filename in list

      const files = [
        "prd.md",
        "architecture.md",
        "readiness-report.md", // Listed but not created
      ];
      const warnings = await validateArtifacts(files, artifactsDir);

      // Should not crash, just no NO-GO warning
      expect(warnings).toHaveLength(0);
    });

    it("detects PRD from various filename patterns", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });

      // Test various PRD filename patterns
      for (const filename of ["prd.md", "PRD.md", "my-prd.md", "prd-v2.md"]) {
        await writeFile(join(artifactsDir, filename), "# PRD");
        const files = [filename, "architecture.md"];
        const warnings = await validateArtifacts(files, artifactsDir);
        expect(
          warnings.find((w) => w.includes("No PRD"))
        ).toBeUndefined();
        await rm(join(artifactsDir, filename));
      }
    });

    it("detects architecture from various filename patterns", async () => {
      const artifactsDir = join(testDir, "artifacts");
      await mkdir(artifactsDir, { recursive: true });

      // Test various architecture filename patterns
      for (const filename of [
        "architecture.md",
        "ARCHITECTURE.md",
        "technical-architecture.md",
        "architect.md",
      ]) {
        await writeFile(join(artifactsDir, filename), "# Architecture");
        const files = ["prd.md", filename];
        const warnings = await validateArtifacts(files, artifactsDir);
        expect(
          warnings.find((w) => w.includes("No architecture"))
        ).toBeUndefined();
        await rm(join(artifactsDir, filename));
      }
    });
  });
});
