import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  detectSpecFileType,
  determinePriority,
  extractDescription,
  generateSpecsIndex,
  formatSpecsIndexMd,
} from "../../src/transition/specs-index.js";

describe("specs-index", () => {
  describe("detectSpecFileType", () => {
    it("detects PRD from 'prd' in filename", () => {
      expect(detectSpecFileType("prd.md", "# Product Requirements")).toBe("prd");
      expect(detectSpecFileType("my-prd.md", "content")).toBe("prd");
      expect(detectSpecFileType("PRD_v2.md", "content")).toBe("prd");
    });

    it("detects architecture from 'arch' in filename", () => {
      expect(detectSpecFileType("architecture.md", "# Architecture")).toBe("architecture");
      expect(detectSpecFileType("arch.md", "content")).toBe("architecture");
      expect(detectSpecFileType("technical-architecture.md", "content")).toBe("architecture");
    });

    it("detects stories from 'stories' or 'epics' in filename", () => {
      expect(detectSpecFileType("stories.md", "# Stories")).toBe("stories");
      expect(detectSpecFileType("epics-and-stories.md", "content")).toBe("stories");
      expect(detectSpecFileType("epic-breakdown.md", "content")).toBe("stories");
    });

    it("detects stories from singular 'story' in filename", () => {
      expect(detectSpecFileType("story.md", "# User Story")).toBe("stories");
      expect(detectSpecFileType("my-story.md", "content")).toBe("stories");
      expect(detectSpecFileType("user-story-auth.md", "content")).toBe("stories");
    });

    it("detects UX from 'ux' in filename", () => {
      expect(detectSpecFileType("ux-specs.md", "# UX")).toBe("ux");
      expect(detectSpecFileType("ux-design.md", "content")).toBe("ux");
    });

    it("detects test-design from test-related filenames", () => {
      expect(detectSpecFileType("test-design.md", "# Test Strategy")).toBe("test-design");
      expect(detectSpecFileType("test-plan.md", "content")).toBe("test-design");
      expect(detectSpecFileType("test-strategy.md", "content")).toBe("test-design");
      expect(detectSpecFileType("test-cases.md", "content")).toBe("test-design");
      expect(detectSpecFileType("testing-strategy.md", "content")).toBe("test-design");
    });

    it("does not misclassify non-test files containing 'test' substring", () => {
      expect(detectSpecFileType("latest-review.md", "content")).toBe("other");
      expect(detectSpecFileType("contest-results.md", "content")).toBe("other");
      expect(detectSpecFileType("attestation.md", "content")).toBe("other");
    });

    it("detects readiness from 'readiness' in filename", () => {
      expect(detectSpecFileType("readiness-report.md", "# Readiness")).toBe("readiness");
      expect(detectSpecFileType("readiness.md", "content")).toBe("readiness");
    });

    it("detects sprint from 'sprint' in filename", () => {
      expect(detectSpecFileType("sprint-plan.md", "# Sprint 1")).toBe("sprint");
      expect(detectSpecFileType("sprint-1.md", "content")).toBe("sprint");
    });

    it("detects brainstorm from 'brainstorm' in filename", () => {
      expect(detectSpecFileType("brainstorm-session.md", "# Ideas")).toBe("brainstorm");
      expect(detectSpecFileType("brainstorming.md", "content")).toBe("brainstorm");
    });

    it("detects stories over brainstorm when both patterns match (Bug #5)", () => {
      // File like "brainstorm-stories.md" should be detected as stories (critical), not brainstorm (low)
      expect(detectSpecFileType("brainstorm-stories.md", "# Stories")).toBe("stories");
      expect(detectSpecFileType("stories-brainstorm.md", "content")).toBe("stories");
      expect(detectSpecFileType("epic-brainstorm-stories.md", "content")).toBe("stories");
    });

    it("returns 'other' for unrecognized filenames", () => {
      expect(detectSpecFileType("notes.md", "content")).toBe("other");
      expect(detectSpecFileType("random-doc.md", "content")).toBe("other");
      expect(detectSpecFileType("meeting-notes.md", "content")).toBe("other");
    });

    it("is case insensitive", () => {
      expect(detectSpecFileType("PRD.MD", "content")).toBe("prd");
      expect(detectSpecFileType("ARCHITECTURE.md", "content")).toBe("architecture");
    });
  });

  describe("determinePriority", () => {
    it("returns critical for PRD/architecture/stories", () => {
      expect(determinePriority("prd", 1000)).toBe("critical");
      expect(determinePriority("architecture", 1000)).toBe("critical");
      expect(determinePriority("stories", 1000)).toBe("critical");
    });

    it("returns high for test-design/readiness", () => {
      expect(determinePriority("test-design", 1000)).toBe("high");
      expect(determinePriority("readiness", 1000)).toBe("high");
    });

    it("returns medium for ux/sprint", () => {
      expect(determinePriority("ux", 1000)).toBe("medium");
      expect(determinePriority("sprint", 1000)).toBe("medium");
    });

    it("returns low for brainstorm/other", () => {
      expect(determinePriority("brainstorm", 1000)).toBe("low");
      expect(determinePriority("other", 1000)).toBe("low");
    });

    it("does not downgrade critical files for large size", () => {
      // Critical files stay critical even when large
      expect(determinePriority("prd", 150000)).toBe("critical");
      expect(determinePriority("architecture", 150000)).toBe("critical");
    });
  });

  describe("extractDescription", () => {
    it("extracts first heading content", () => {
      const content = "# Project Requirements\n\nThis is the PRD for our project.";
      expect(extractDescription(content)).toBe("Project Requirements");
    });

    it("extracts h2 heading when no h1", () => {
      const content = "## Architecture Overview\n\nDetails here.";
      expect(extractDescription(content)).toBe("Architecture Overview");
    });

    it("truncates to maxLength", () => {
      const content = "# This is a very long heading that should be truncated to fit within limits";
      const result = extractDescription(content, 20);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it("handles empty content", () => {
      expect(extractDescription("")).toBe("");
      expect(extractDescription("   ")).toBe("");
    });

    it("extracts first non-empty line when no heading", () => {
      const content = "Some documentation without a heading\nSecond line.";
      expect(extractDescription(content)).toBe("Some documentation without a heading");
    });

    it("removes markdown formatting from heading", () => {
      const content = "# **Bold** and *italic* heading";
      expect(extractDescription(content)).toBe("Bold and italic heading");
    });
  });

  describe("generateSpecsIndex", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(
        tmpdir(),
        `bmalph-specs-index-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

    it("generates index from specs directory", async () => {
      await mkdir(join(testDir, "planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "planning-artifacts/prd.md"),
        "# Product Requirements\n\nContent here."
      );
      await writeFile(
        join(testDir, "planning-artifacts/architecture.md"),
        "# Architecture\n\nTech details."
      );

      const index = await generateSpecsIndex(testDir);

      expect(index.totalFiles).toBe(2);
      expect(index.files).toHaveLength(2);
      expect(index.files.map((f) => f.type)).toContain("prd");
      expect(index.files.map((f) => f.type)).toContain("architecture");
    });

    it("groups files by priority", async () => {
      await mkdir(join(testDir, "planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "brainstorming"), { recursive: true });
      await writeFile(join(testDir, "planning-artifacts/prd.md"), "# PRD");
      await writeFile(join(testDir, "brainstorming/session-1.md"), "# Brainstorm");

      const index = await generateSpecsIndex(testDir);

      const prdFile = index.files.find((f) => f.type === "prd");
      const brainstormFile = index.files.find((f) => f.type === "brainstorm");

      expect(prdFile?.priority).toBe("critical");
      expect(brainstormFile?.priority).toBe("low");
    });

    it("handles empty directory", async () => {
      const index = await generateSpecsIndex(testDir);

      expect(index.totalFiles).toBe(0);
      expect(index.files).toEqual([]);
    });

    it("handles nested directories", async () => {
      await mkdir(join(testDir, "planning-artifacts/sub"), { recursive: true });
      await writeFile(join(testDir, "planning-artifacts/sub/nested-prd.md"), "# Nested PRD");

      const index = await generateSpecsIndex(testDir);

      expect(index.totalFiles).toBe(1);
      expect(index.files[0].path).toContain("sub");
    });

    it("calculates file sizes correctly", async () => {
      const content = "A".repeat(1000);
      await writeFile(join(testDir, "doc.md"), content);

      const index = await generateSpecsIndex(testDir);

      expect(index.files[0].size).toBe(1000);
      expect(index.totalSizeKb).toBeCloseTo(1, 0);
    });

    it("only includes markdown files", async () => {
      await writeFile(join(testDir, "doc.md"), "# Doc");
      await writeFile(join(testDir, "data.json"), '{"key": "value"}');
      await writeFile(join(testDir, "image.png"), "binary");

      const index = await generateSpecsIndex(testDir);

      expect(index.totalFiles).toBe(1);
      expect(index.files[0].path).toBe("doc.md");
    });
  });

  describe("formatSpecsIndexMd", () => {
    it("includes file count and total size", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 5,
        totalSizeKb: 125,
        files: [],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toContain("Total: 5 files");
      expect(md).toContain("125 KB");
    });

    it("groups files by priority", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 3,
        totalSizeKb: 50,
        files: [
          {
            path: "prd.md",
            size: 15000,
            type: "prd" as const,
            priority: "critical" as const,
            description: "PRD",
          },
          {
            path: "test.md",
            size: 8000,
            type: "test-design" as const,
            priority: "high" as const,
            description: "Tests",
          },
          {
            path: "notes.md",
            size: 4000,
            type: "brainstorm" as const,
            priority: "low" as const,
            description: "Notes",
          },
        ],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toContain("### Critical");
      expect(md).toContain("### High Priority");
      expect(md).toContain("### Low Priority");
      expect(md).toContain("prd.md");
      expect(md).toContain("test.md");
      expect(md).toContain("notes.md");
    });

    it("marks large files with [LARGE]", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 1,
        totalSizeKb: 100,
        files: [
          {
            path: "ux-specs.md",
            size: 75000,
            type: "ux" as const,
            priority: "medium" as const,
            description: "UX",
          },
        ],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toContain("[LARGE]");
      expect(md).toContain("scan headers");
    });

    it("includes file descriptions", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 1,
        totalSizeKb: 15,
        files: [
          {
            path: "prd.md",
            size: 15000,
            type: "prd" as const,
            priority: "critical" as const,
            description: "Product requirements for MVP",
          },
        ],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toContain("Product requirements for MVP");
    });

    it("includes generated timestamp", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 0,
        totalSizeKb: 0,
        files: [],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toContain("Generated: 2024-01-25T10:30:00Z");
    });

    it("formats file sizes in KB", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 1,
        totalSizeKb: 28,
        files: [
          {
            path: "arch.md",
            size: 28000,
            type: "architecture" as const,
            priority: "critical" as const,
            description: "Arch",
          },
        ],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toContain("28 KB");
    });

    it("numbers files in reading order", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 3,
        totalSizeKb: 30,
        files: [
          {
            path: "prd.md",
            size: 10000,
            type: "prd" as const,
            priority: "critical" as const,
            description: "PRD",
          },
          {
            path: "arch.md",
            size: 10000,
            type: "architecture" as const,
            priority: "critical" as const,
            description: "Arch",
          },
          {
            path: "notes.md",
            size: 10000,
            type: "brainstorm" as const,
            priority: "low" as const,
            description: "Notes",
          },
        ],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toMatch(/1\.\s+\*\*.*prd\.md/);
      expect(md).toMatch(/2\.\s+\*\*.*arch\.md/);
      expect(md).toMatch(/3\.\s+\*\*.*notes\.md/);
    });

    it("omits empty priority sections", () => {
      const index = {
        generatedAt: "2024-01-25T10:30:00Z",
        totalFiles: 1,
        totalSizeKb: 10,
        files: [
          {
            path: "prd.md",
            size: 10000,
            type: "prd" as const,
            priority: "critical" as const,
            description: "PRD",
          },
        ],
      };

      const md = formatSpecsIndexMd(index);

      expect(md).toContain("### Critical");
      expect(md).not.toContain("### High Priority");
      expect(md).not.toContain("### Medium Priority");
      expect(md).not.toContain("### Low Priority");
    });
  });
});
