import { readFile, readdir, stat } from "fs/promises";
import { join, extname } from "path";

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
  } catch {
    // Directory doesn't exist or can't be read
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
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files;
}
