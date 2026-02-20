import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, readFile, readdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  exists,
  getFilesRecursive,
  getMarkdownFilesWithContent,
  atomicWriteFile,
} from "../../src/utils/file-system.js";

describe("file-system utilities", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("exists", () => {
    it("returns true for an existing file", async () => {
      const filePath = join(testDir, "existing.txt");
      await writeFile(filePath, "content");
      expect(await exists(filePath)).toBe(true);
    });

    it("returns true for an existing directory", async () => {
      expect(await exists(testDir)).toBe(true);
    });

    it("returns false for a non-existent path", async () => {
      expect(await exists(join(testDir, "nonexistent"))).toBe(false);
    });
  });

  describe("getFilesRecursive", () => {
    it("returns empty array for empty directory", async () => {
      const files = await getFilesRecursive(testDir);
      expect(files).toEqual([]);
    });

    it("returns empty array for non-existent directory", async () => {
      const files = await getFilesRecursive(join(testDir, "nonexistent"));
      expect(files).toEqual([]);
    });

    it("returns files in root directory", async () => {
      await writeFile(join(testDir, "file1.txt"), "content");
      await writeFile(join(testDir, "file2.md"), "markdown");

      const files = await getFilesRecursive(testDir);
      expect(files.sort()).toEqual(["file1.txt", "file2.md"]);
    });

    it("returns files in nested directories", async () => {
      await mkdir(join(testDir, "sub1"), { recursive: true });
      await mkdir(join(testDir, "sub2", "deep"), { recursive: true });
      await writeFile(join(testDir, "root.txt"), "");
      await writeFile(join(testDir, "sub1", "a.txt"), "");
      await writeFile(join(testDir, "sub2", "b.txt"), "");
      await writeFile(join(testDir, "sub2", "deep", "c.txt"), "");

      const files = await getFilesRecursive(testDir);
      const normalized = files.map((f) => f.replace(/\\/g, "/")).sort();
      expect(normalized).toEqual(["root.txt", "sub1/a.txt", "sub2/b.txt", "sub2/deep/c.txt"]);
    });

    it("re-throws non-ENOENT errors", async () => {
      // Use a file path (not a directory) to trigger ENOTDIR
      await writeFile(join(testDir, "not-a-dir"), "content");
      await expect(getFilesRecursive(join(testDir, "not-a-dir"))).rejects.toThrow();
    });

    it("uses forward slashes in paths on all platforms", async () => {
      await mkdir(join(testDir, "sub"), { recursive: true });
      await writeFile(join(testDir, "sub", "file.txt"), "");

      const files = await getFilesRecursive(testDir);
      expect(files[0]).toBe("sub/file.txt");
    });
  });

  describe("getMarkdownFilesWithContent", () => {
    it("returns empty array for empty directory", async () => {
      const files = await getMarkdownFilesWithContent(testDir);
      expect(files).toEqual([]);
    });

    it("returns empty array for non-existent directory", async () => {
      const files = await getMarkdownFilesWithContent(join(testDir, "nonexistent"));
      expect(files).toEqual([]);
    });

    it("only returns markdown files", async () => {
      await writeFile(join(testDir, "file.txt"), "text");
      await writeFile(join(testDir, "readme.md"), "markdown");
      await writeFile(join(testDir, "docs.MD"), "upper case");

      const files = await getMarkdownFilesWithContent(testDir);
      const paths = files.map((f) => f.path).sort();
      expect(paths).toEqual(["docs.MD", "readme.md"]);
    });

    it("includes content and size", async () => {
      await writeFile(join(testDir, "test.md"), "Hello World");

      const files = await getMarkdownFilesWithContent(testDir);
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("test.md");
      expect(files[0].content).toBe("Hello World");
      expect(files[0].size).toBe(11);
    });

    it("includes files from subdirectories", async () => {
      await mkdir(join(testDir, "docs"), { recursive: true });
      await writeFile(join(testDir, "root.md"), "root");
      await writeFile(join(testDir, "docs", "nested.md"), "nested");

      const files = await getMarkdownFilesWithContent(testDir);
      const paths = files.map((f) => f.path).sort();
      expect(paths).toEqual(["docs/nested.md", "root.md"]);
    });

    it("uses forward slashes in paths", async () => {
      await mkdir(join(testDir, "sub"), { recursive: true });
      await writeFile(join(testDir, "sub", "file.md"), "content");

      const files = await getMarkdownFilesWithContent(testDir);
      expect(files[0].path).toBe("sub/file.md");
    });

    it("re-throws non-ENOENT errors", async () => {
      await writeFile(join(testDir, "not-a-dir"), "content");
      await expect(getMarkdownFilesWithContent(join(testDir, "not-a-dir"))).rejects.toThrow();
    });
  });

  describe("atomicWriteFile", () => {
    it("writes content to the target file", async () => {
      const target = join(testDir, "output.json");
      await atomicWriteFile(target, '{"key":"value"}\n');

      const content = await readFile(target, "utf-8");
      expect(content).toBe('{"key":"value"}\n');
    });

    it("leaves no temp files after successful write", async () => {
      const target = join(testDir, "output.json");
      await atomicWriteFile(target, "content");

      const files = await readdir(testDir);
      const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
      expect(tmpFiles).toHaveLength(0);
    });

    it("overwrites existing file", async () => {
      const target = join(testDir, "output.json");
      await writeFile(target, "old content");
      await atomicWriteFile(target, "new content");

      const content = await readFile(target, "utf-8");
      expect(content).toBe("new content");
    });
  });
});
