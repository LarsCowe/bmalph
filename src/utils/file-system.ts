import { access, readFile, readdir, stat, writeFile, rename, unlink } from "fs/promises";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { isEnoent } from "./errors.js";

/**
 * Checks whether a file or directory exists at the given path.
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
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
