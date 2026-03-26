import { access, readFile, readdir, stat, writeFile, rename, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { isEnoent } from "./errors.js";

/**
 * Checks whether a file or directory exists at the given path.
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (err) {
    if (isEnoent(err)) return false;
    throw err;
  }
}

/**
 * Checks whether a directory exists at the given path.
 * Returns false if the path doesn't exist or is a file.
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (err) {
    if (isEnoent(err)) return false;
    throw err;
  }
}

/**
 * Writes content to a file atomically using a temp file + rename.
 * Prevents partial writes from corrupting the target file.
 */
export async function atomicWriteFile(target: string, content: string): Promise<void> {
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, content, { flag: "wx" });
    await rename(tmp, target);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Recursively gets all files from a directory.
 * Returns relative paths using forward slashes (cross-platform).
 */
export async function getFilesRecursive(dir: string, basePath = ""): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await getFilesRecursive(join(dir, entry.name), relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  return files;
}

/**
 * Parse .gitignore content into a set of trimmed, non-empty lines.
 */
export function parseGitignoreLines(content: string): Set<string> {
  return new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

/**
 * Replace or remove a markdown section identified by a heading marker.
 * Finds the marker, then locates the next level-2 heading to determine section bounds.
 *
 * @param content - The full file content
 * @param marker - The section heading to find (e.g. "## BMAD-METHOD Integration")
 * @param replacement - New content for the section, or empty string to remove it
 * @returns Updated content with section replaced/removed
 */
export function replaceSection(content: string, marker: string, replacement: string): string {
  if (!content.includes(marker)) return content;

  const sectionStart = content.indexOf(marker);
  const before = content.slice(0, sectionStart);
  const afterSection = content.slice(sectionStart);

  const headingText = marker.startsWith("## ") ? marker.slice(3) : marker;
  const headingTextEscaped = headingText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextHeadingMatch = afterSection.match(new RegExp(`\\n## (?!${headingTextEscaped})`));
  const after = nextHeadingMatch ? afterSection.slice(nextHeadingMatch.index ?? 0) : "";

  return before.trimEnd() + replacement + after;
}

export interface FileWithContent {
  path: string;
  size: number;
  content: string;
}

/**
 * Recursively gets all markdown files from a directory with their content.
 * Returns relative paths using forward slashes (cross-platform).
 */
export async function getMarkdownFilesWithContent(
  dir: string,
  basePath = ""
): Promise<FileWithContent[]> {
  const files: FileWithContent[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await getMarkdownFilesWithContent(fullPath, relativePath);
        files.push(...subFiles);
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        const stats = await stat(fullPath);
        const content = await readFile(fullPath, "utf-8");
        files.push({
          path: relativePath,
          size: stats.size,
          content,
        });
      }
    }
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  return files;
}
