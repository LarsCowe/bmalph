import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  generateSpecsChangelog,
  formatChangelog,
} from "../../src/transition/specs-changelog.js";

describe("specs-changelog", () => {
  let testDir: string;
  let oldSpecsDir: string;
  let newSourceDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-changelog-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    oldSpecsDir = join(testDir, "old-specs");
    newSourceDir = join(testDir, "new-source");
    await mkdir(oldSpecsDir, { recursive: true });
    await mkdir(newSourceDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  describe("generateSpecsChangelog", () => {
    it("detects added files", async () => {
      await writeFile(join(newSourceDir, "new-file.md"), "# New Content");

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        file: "new-file.md",
        status: "added",
      });
    });

    it("detects removed files", async () => {
      await writeFile(join(oldSpecsDir, "deleted-file.md"), "# Old Content");

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        file: "deleted-file.md",
        status: "removed",
      });
    });

    it("detects modified files", async () => {
      await writeFile(join(oldSpecsDir, "doc.md"), "# Original Content");
      await writeFile(join(newSourceDir, "doc.md"), "# Updated Content");

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe("doc.md");
      expect(changes[0].status).toBe("modified");
      expect(changes[0].summary).toBe("# Updated Content");
    });

    it("includes first differing line as summary for modified files", async () => {
      await writeFile(
        join(oldSpecsDir, "doc.md"),
        `# Title

This is line 2.
This is line 3.
`
      );
      await writeFile(
        join(newSourceDir, "doc.md"),
        `# Title

This line has changed!
This is line 3.
`
      );

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(1);
      expect(changes[0].summary).toBe("This line has changed!");
    });

    it("truncates summary to 50 characters", async () => {
      const longLine =
        "This is a very long line that exceeds the fifty character limit for summaries";
      await writeFile(join(oldSpecsDir, "doc.md"), "Original");
      await writeFile(join(newSourceDir, "doc.md"), longLine);

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes[0].summary).toBe(longLine.slice(0, 50));
      expect(changes[0].summary!.length).toBe(50);
    });

    it("does not report unchanged files", async () => {
      const content = "# Identical Content\n\nSame in both.";
      await writeFile(join(oldSpecsDir, "unchanged.md"), content);
      await writeFile(join(newSourceDir, "unchanged.md"), content);

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(0);
    });

    it("handles nested directories", async () => {
      await mkdir(join(oldSpecsDir, "sub"), { recursive: true });
      await mkdir(join(newSourceDir, "sub"), { recursive: true });
      await writeFile(join(newSourceDir, "sub/nested.md"), "# Nested");

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(1);
      expect(changes[0].file).toBe("sub/nested.md");
      expect(changes[0].status).toBe("added");
    });

    it("normalizes path separators for comparison", async () => {
      await mkdir(join(oldSpecsDir, "folder"), { recursive: true });
      await mkdir(join(newSourceDir, "folder"), { recursive: true });
      const content = "# Same content";
      await writeFile(join(oldSpecsDir, "folder", "file.md"), content);
      await writeFile(join(newSourceDir, "folder", "file.md"), content);

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      // Should recognize as same file despite potential path separator differences
      expect(changes).toHaveLength(0);
    });

    it("handles multiple changes at once", async () => {
      await writeFile(join(oldSpecsDir, "kept.md"), "Original");
      await writeFile(join(oldSpecsDir, "removed.md"), "Will be deleted");

      await writeFile(join(newSourceDir, "kept.md"), "Modified");
      await writeFile(join(newSourceDir, "added.md"), "New file");

      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(3);
      expect(changes.find((c) => c.status === "added")).toBeDefined();
      expect(changes.find((c) => c.status === "modified")).toBeDefined();
      expect(changes.find((c) => c.status === "removed")).toBeDefined();
    });

    it("handles empty directories", async () => {
      const changes = await generateSpecsChangelog(oldSpecsDir, newSourceDir);

      expect(changes).toHaveLength(0);
    });

    it("handles missing old directory gracefully", async () => {
      const nonExistentOld = join(testDir, "does-not-exist");
      await writeFile(join(newSourceDir, "new.md"), "# New");

      const changes = await generateSpecsChangelog(nonExistentOld, newSourceDir);

      expect(changes).toHaveLength(1);
      expect(changes[0].status).toBe("added");
    });
  });

  describe("formatChangelog", () => {
    it("includes timestamp in header", () => {
      const changes = [{ file: "doc.md", status: "added" as const }];
      const timestamp = "2024-01-25T10:30:00Z";

      const md = formatChangelog(changes, timestamp);

      expect(md).toContain("# Specs Changelog");
      expect(md).toContain("Last updated: 2024-01-25T10:30:00Z");
    });

    it("handles empty changes array", () => {
      const md = formatChangelog([], "2024-01-25T10:30:00Z");

      expect(md).toContain("# Specs Changelog");
      expect(md).toContain("No changes detected.");
    });

    it("groups changes by type", () => {
      const changes = [
        { file: "added1.md", status: "added" as const },
        { file: "added2.md", status: "added" as const },
        { file: "modified.md", status: "modified" as const, summary: "line 1" },
        { file: "removed.md", status: "removed" as const },
      ];

      const md = formatChangelog(changes, "2024-01-25");

      expect(md).toContain("## Added");
      expect(md).toContain("- added1.md");
      expect(md).toContain("- added2.md");
      expect(md).toContain("## Modified");
      expect(md).toContain("- modified.md (line 1)");
      expect(md).toContain("## Removed");
      expect(md).toContain("- removed.md");
    });

    it("includes summary for modified files", () => {
      const changes = [
        {
          file: "doc.md",
          status: "modified" as const,
          summary: "Changed heading",
        },
      ];

      const md = formatChangelog(changes, "2024-01-25");

      expect(md).toContain("- doc.md (Changed heading)");
    });

    it("handles modified files without summary", () => {
      const changes = [
        {
          file: "doc.md",
          status: "modified" as const,
        },
      ];

      const md = formatChangelog(changes, "2024-01-25");

      expect(md).toContain("- doc.md");
      expect(md).not.toContain("()");
    });

    it("omits empty sections", () => {
      const changes = [{ file: "added.md", status: "added" as const }];

      const md = formatChangelog(changes, "2024-01-25");

      expect(md).toContain("## Added");
      expect(md).not.toContain("## Modified");
      expect(md).not.toContain("## Removed");
    });
  });
});
