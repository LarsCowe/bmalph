import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

    it("config-specified path takes priority over candidates", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: my-custom-dir\n");
      await mkdir(join(testDir, "my-custom-dir"), { recursive: true });
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(join(testDir, "my-custom-dir"));
    });

    it("falls back to candidates when config path doesn't exist", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: nonexistent-dir\n");
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(join(testDir, "_bmad-output/planning-artifacts"));
    });

    it("falls back to candidates when _bmad/config.yaml is missing", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(join(testDir, "_bmad-output/planning-artifacts"));
    });

    it("blocks path traversal from config-specified path", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: ../../sensitive\n");
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(join(testDir, "_bmad-output/planning-artifacts"));
    });

    it("blocks sibling directory with matching prefix via path traversal", async () => {
      const siblingDir = `${testDir}-evil`;
      await mkdir(siblingDir, { recursive: true });
      try {
        await mkdir(join(testDir, "_bmad"), { recursive: true });
        await writeFile(
          join(testDir, "_bmad/config.yaml"),
          `planning_artifacts: ../${testDir.split("/").pop()}-evil\n`
        );
        await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

        const result = await findArtifactsDir(testDir);

        expect(result).toBe(join(testDir, "_bmad-output/planning-artifacts"));
      } finally {
        await rm(siblingDir, { recursive: true, force: true });
      }
    });

    it("ignores whitespace-only planning_artifacts value", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: '   '\n");
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(join(testDir, "_bmad-output/planning-artifacts"));
    });

    it("falls back to candidates when config-specified path is a file", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: my-file.txt\n");
      await writeFile(join(testDir, "my-file.txt"), "not a directory");
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(join(testDir, "_bmad-output/planning-artifacts"));
    });

    it("blocks absolute path outside project directory", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: /etc/passwd\n");
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });

      const result = await findArtifactsDir(testDir);

      expect(result).toBe(join(testDir, "_bmad-output/planning-artifacts"));
    });

    it("returns null when config path is invalid and no candidates exist", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await writeFile(join(testDir, "_bmad/config.yaml"), "planning_artifacts: nonexistent-dir\n");

      const result = await findArtifactsDir(testDir);

      expect(result).toBeNull();
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
