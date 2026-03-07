import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findArtifactsDir, resolvePlanningSpecsSubpath } from "../../src/transition/artifacts.js";

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

  describe("resolvePlanningSpecsSubpath", () => {
    it("returns planning-artifacts for the canonical BMAD root", () => {
      const result = resolvePlanningSpecsSubpath(
        testDir,
        join(testDir, "_bmad-output/planning-artifacts")
      );

      expect(result).toBe("planning-artifacts");
    });

    it("returns planning_artifacts for underscore-based BMAD roots", () => {
      const result = resolvePlanningSpecsSubpath(
        testDir,
        join(testDir, "_bmad-output/planning_artifacts")
      );

      expect(result).toBe("planning_artifacts");
    });

    it("returns an empty path for docs/planning fallback roots", () => {
      const result = resolvePlanningSpecsSubpath(testDir, join(testDir, "docs/planning"));

      expect(result).toBe("");
    });
  });

  // NOTE: validateArtifacts tests were removed — validation is now handled by runPreflight
});
