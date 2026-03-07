import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prepareSpecsDirectory } from "../../src/transition/specs-sync.js";

describe("specs-sync", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-specs-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

  it("merges docs/planning artifacts into specs root when _bmad-output also exists", async () => {
    const artifactsDir = join(testDir, "docs/planning");
    const implementationArtifactsDir = join(testDir, "_bmad-output/implementation-artifacts");
    const specsTmpDir = join(testDir, ".ralph/specs.new");

    await mkdir(join(artifactsDir, "epics"), { recursive: true });
    await mkdir(implementationArtifactsDir, { recursive: true });

    await writeFile(join(artifactsDir, "prd.md"), "# PRD from docs/planning");
    await writeFile(join(artifactsDir, "epics/epic-1.md"), "## Epic 1\n\n### Story 1.1: Login");
    await writeFile(join(implementationArtifactsDir, "sprint-status.yaml"), "development_status:");

    await prepareSpecsDirectory(testDir, artifactsDir, ["prd.md", "epics/epic-1.md"], specsTmpDir);

    await expect(readFile(join(specsTmpDir, "prd.md"), "utf-8")).resolves.toContain(
      "PRD from docs/planning"
    );
    await expect(readFile(join(specsTmpDir, "epics/epic-1.md"), "utf-8")).resolves.toContain(
      "Story 1.1: Login"
    );
    await expect(
      readFile(join(specsTmpDir, "implementation-artifacts/sprint-status.yaml"), "utf-8")
    ).resolves.toContain("development_status");
  });

  it("preserves canonical planning-artifacts paths inside specs", async () => {
    const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
    const specsTmpDir = join(testDir, ".ralph/specs.new");

    await mkdir(artifactsDir, { recursive: true });
    await writeFile(join(artifactsDir, "prd.md"), "# Canonical PRD");

    await prepareSpecsDirectory(testDir, artifactsDir, ["prd.md"], specsTmpDir);

    await expect(
      readFile(join(specsTmpDir, "planning-artifacts/prd.md"), "utf-8")
    ).resolves.toContain("Canonical PRD");
  });
});
