import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  classifyArtifact,
  scanArtifacts,
  detectPhase,
  getMissing,
  suggestNext,
  scanProjectArtifacts,
} from "../../src/transition/artifact-scan.js";

describe("artifact-scan", () => {
  describe("classifyArtifact", () => {
    it("recognizes product brief", () => {
      expect(classifyArtifact("product-brief.md")).toEqual({
        phase: 1,
        name: "Product Brief",
        required: false,
      });
    });

    it("recognizes market research", () => {
      expect(classifyArtifact("market-research.md")).toEqual({
        phase: 1,
        name: "Market Research",
        required: false,
      });
    });

    it("recognizes domain research", () => {
      expect(classifyArtifact("domain-research.md")).toEqual({
        phase: 1,
        name: "Domain Research",
        required: false,
      });
    });

    it("recognizes technical research", () => {
      expect(classifyArtifact("tech-research.md")).toEqual({
        phase: 1,
        name: "Technical Research",
        required: false,
      });
    });

    it("recognizes technical research with full word", () => {
      expect(classifyArtifact("technical-research.md")).toEqual({
        phase: 1,
        name: "Technical Research",
        required: false,
      });
    });

    it("recognizes PRD", () => {
      expect(classifyArtifact("prd.md")).toEqual({
        phase: 2,
        name: "PRD",
        required: true,
      });
    });

    it("recognizes PRD case-insensitively", () => {
      expect(classifyArtifact("PRD.md")).toEqual({
        phase: 2,
        name: "PRD",
        required: true,
      });
    });

    it("recognizes UX design", () => {
      expect(classifyArtifact("ux-design.md")).toEqual({
        phase: 2,
        name: "UX Design",
        required: false,
      });
    });

    it("recognizes architecture", () => {
      expect(classifyArtifact("architecture.md")).toEqual({
        phase: 3,
        name: "Architecture",
        required: true,
      });
    });

    it("recognizes architect prefix", () => {
      expect(classifyArtifact("architect-doc.md")).toEqual({
        phase: 3,
        name: "Architecture",
        required: true,
      });
    });

    it("recognizes epics", () => {
      expect(classifyArtifact("epics-and-stories.md")).toEqual({
        phase: 3,
        name: "Epics & Stories",
        required: true,
      });
    });

    it("recognizes stories", () => {
      expect(classifyArtifact("user-stories.md")).toEqual({
        phase: 3,
        name: "Epics & Stories",
        required: true,
      });
    });

    it("recognizes readiness report", () => {
      expect(classifyArtifact("readiness-report.md")).toEqual({
        phase: 3,
        name: "Readiness Report",
        required: true,
      });
    });

    it("returns null for unknown files", () => {
      expect(classifyArtifact("random-notes.md")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(classifyArtifact("")).toBeNull();
    });
  });

  describe("scanArtifacts", () => {
    it("returns empty phases for empty file list", () => {
      const result = scanArtifacts([]);
      expect(result).toEqual({ 1: [], 2: [], 3: [] });
    });

    it("classifies files into correct phases", () => {
      const result = scanArtifacts(["product-brief.md", "prd.md", "architecture.md"]);

      expect(result[1]).toHaveLength(1);
      expect(result[1][0]).toMatchObject({ name: "Product Brief" });
      expect(result[2]).toHaveLength(1);
      expect(result[2][0]).toMatchObject({ name: "PRD" });
      expect(result[3]).toHaveLength(1);
      expect(result[3][0]).toMatchObject({ name: "Architecture" });
    });

    it("handles multiple artifacts in the same phase", () => {
      const result = scanArtifacts(["architecture.md", "epics.md", "readiness-report.md"]);

      expect(result[3]).toHaveLength(3);
    });

    it("skips unknown files", () => {
      const result = scanArtifacts(["readme.md", "prd.md", "notes.txt"]);

      expect(result[1]).toHaveLength(0);
      expect(result[2]).toHaveLength(1);
      expect(result[3]).toHaveLength(0);
    });

    it("includes filename in artifact entries", () => {
      const result = scanArtifacts(["product-brief.md"]);

      expect(result[1][0]).toMatchObject({
        name: "Product Brief",
        filename: "product-brief.md",
      });
    });
  });

  describe("detectPhase", () => {
    it("returns 1 when no artifacts exist", () => {
      const phases = { 1: [], 2: [], 3: [] };
      expect(detectPhase(phases)).toBe(1);
    });

    it("returns 1 when only phase 1 artifacts exist", () => {
      const phases = {
        1: [{ phase: 1, name: "Product Brief", required: false, filename: "brief.md" }],
        2: [],
        3: [],
      };
      expect(detectPhase(phases)).toBe(1);
    });

    it("returns 2 when phase 2 artifacts exist", () => {
      const phases = {
        1: [{ phase: 1, name: "Product Brief", required: false, filename: "brief.md" }],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [],
      };
      expect(detectPhase(phases)).toBe(2);
    });

    it("returns 3 when phase 3 artifacts exist", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [{ phase: 3, name: "Architecture", required: true, filename: "arch.md" }],
      };
      expect(detectPhase(phases)).toBe(3);
    });

    it("returns highest phase even with gaps", () => {
      const phases = {
        1: [],
        2: [],
        3: [{ phase: 3, name: "Architecture", required: true, filename: "arch.md" }],
      };
      expect(detectPhase(phases)).toBe(3);
    });
  });

  describe("getMissing", () => {
    it("returns all required artifacts for phase 3 when none exist", () => {
      const phases = { 1: [], 2: [], 3: [] };
      const missing = getMissing(phases);

      expect(missing).toContain("Architecture");
      expect(missing).toContain("Epics & Stories");
      expect(missing).toContain("Readiness Report");
    });

    it("returns missing required artifacts for phase 2", () => {
      const phases = { 1: [], 2: [], 3: [] };
      const missing = getMissing(phases);

      expect(missing).toContain("PRD");
      expect(missing).not.toContain("UX Design");
    });

    it("returns empty array when all required artifacts exist", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [
          { phase: 3, name: "Architecture", required: true, filename: "arch.md" },
          { phase: 3, name: "Epics & Stories", required: true, filename: "epics.md" },
          { phase: 3, name: "Readiness Report", required: true, filename: "readiness.md" },
        ],
      };
      const missing = getMissing(phases);

      expect(missing).toHaveLength(0);
    });

    it("only returns required artifacts, not optional ones", () => {
      const phases = { 1: [], 2: [], 3: [] };
      const missing = getMissing(phases);

      expect(missing).toContain("PRD");
      expect(missing).toContain("Architecture");
      expect(missing).not.toContain("Product Brief");
      expect(missing).not.toContain("UX Design");
    });

    it("includes required artifacts from all phases up to detected phase", () => {
      const phases = { 1: [], 2: [], 3: [] };
      const missing = getMissing(phases);

      expect(missing).toContain("PRD");
      expect(missing).toContain("Architecture");
      expect(missing).toContain("Epics & Stories");
      expect(missing).toContain("Readiness Report");
    });
  });

  describe("suggestNext", () => {
    it("suggests analyst for phase 1 with no artifacts", () => {
      const phases = { 1: [], 2: [], 3: [] };
      expect(suggestNext(phases, 1)).toContain("/analyst");
    });

    it("suggests PM for phase 2", () => {
      const phases = {
        1: [{ phase: 1, name: "Product Brief", required: false, filename: "brief.md" }],
        2: [],
        3: [],
      };
      expect(suggestNext(phases, 2)).toContain("/create-prd");
    });

    it("suggests architect when PRD exists but no architecture", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [],
      };
      expect(suggestNext(phases, 3)).toContain("/architect");
    });

    it("uses Cursor-specific master-agent guidance instead of slash commands", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [],
      };

      const suggestion = suggestNext(phases, 3, "cursor");

      expect(suggestion).toContain("_bmad/COMMANDS.md");
      expect(suggestion).toContain("run the BMAD master agent");
      expect(suggestion).not.toContain("/architect");
    });

    it("uses OpenCode-specific skill guidance instead of slash commands", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [],
      };

      const suggestion = suggestNext(phases, 3, "opencode");

      expect(suggestion).toContain(".opencode/skills");
      expect(suggestion).toContain("bmad-architect");
      expect(suggestion).not.toContain("/architect");
    });

    it("suggests create epics when architecture exists but no stories", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [{ phase: 3, name: "Architecture", required: true, filename: "arch.md" }],
      };
      expect(suggestNext(phases, 3)).toContain("/create-epics-stories");
    });

    it("suggests implementation-readiness when architecture and epics exist but readiness is missing", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [
          { phase: 3, name: "Architecture", required: true, filename: "arch.md" },
          { phase: 3, name: "Epics & Stories", required: true, filename: "epics.md" },
        ],
      };
      expect(suggestNext(phases, 3)).toContain("/implementation-readiness");
      expect(suggestNext(phases, 3)).not.toContain("/architect");
    });

    it("suggests check-implementation-readiness skill for Codex when readiness is missing", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [
          { phase: 3, name: "Architecture", required: true, filename: "arch.md" },
          { phase: 3, name: "Epics & Stories", required: true, filename: "epics.md" },
        ],
      };
      const suggestion = suggestNext(phases, 3, "codex");
      expect(suggestion).toContain("check-implementation-readiness");
      expect(suggestion).not.toContain("$architect");
    });

    it("suggests bmalph implement when all phase 3 artifacts exist", () => {
      const phases = {
        1: [],
        2: [{ phase: 2, name: "PRD", required: true, filename: "prd.md" }],
        3: [
          { phase: 3, name: "Architecture", required: true, filename: "arch.md" },
          { phase: 3, name: "Epics & Stories", required: true, filename: "epics.md" },
          { phase: 3, name: "Readiness Report", required: true, filename: "readiness.md" },
        ],
      };
      expect(suggestNext(phases, 3)).toContain("bmalph implement");
    });
  });

  describe("scanProjectArtifacts", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(
        tmpdir(),
        `bmalph-artifact-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

    it("returns null when no artifacts directory exists", async () => {
      const result = await scanProjectArtifacts(testDir);

      expect(result).toBeNull();
    });

    it("scans artifacts from planning-artifacts directory", async () => {
      const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");
      await writeFile(join(artifactsDir, "architecture.md"), "# Architecture");

      const result = await scanProjectArtifacts(testDir);

      expect(result).not.toBeNull();
      expect(result!.detectedPhase).toBe(3);
      expect(result!.found).toContain("prd.md");
      expect(result!.found).toContain("architecture.md");
    });

    it("returns the artifacts directory path", async () => {
      const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");

      const result = await scanProjectArtifacts(testDir);

      expect(result!.directory).toBe("_bmad-output/planning-artifacts");
    });

    it("includes missing required artifacts", async () => {
      const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");

      const result = await scanProjectArtifacts(testDir);

      expect(result!.missing).toContain("Architecture");
      expect(result!.missing).toContain("Epics & Stories");
      expect(result!.missing).toContain("Readiness Report");
    });

    it("includes phases map for checklist rendering", async () => {
      const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "product-brief.md"), "# Brief");
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");

      const result = await scanProjectArtifacts(testDir);

      expect(result!.phases[1]).toHaveLength(1);
      expect(result!.phases[2]).toHaveLength(1);
    });

    it("includes next action suggestion", async () => {
      const artifactsDir = join(testDir, "_bmad-output/planning-artifacts");
      await mkdir(artifactsDir, { recursive: true });
      await writeFile(join(artifactsDir, "prd.md"), "# PRD");

      const result = await scanProjectArtifacts(testDir);

      expect(result!.nextAction).toContain("/architect");
    });
  });
});
