import { readFile } from "fs/promises";
import { isEnoent } from "./errors.js";

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
    if (isEnoent(err)) {
      return null;
    }
    throw err;
  }

  try {
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    throw new Error(`Invalid JSON in ${path}`, { cause: err });
  }
}
