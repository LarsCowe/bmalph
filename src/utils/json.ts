import { readFile } from "fs/promises";

/**
 * Reads and parses a JSON file with proper error discrimination:
 * - File not found → returns null
 * - Parse error → throws
 * - Permission error → throws
 */
export async function readJsonFile<T>(path: string): Promise<T | null> {
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }

  try {
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${path}: ${message}`);
  }
}
