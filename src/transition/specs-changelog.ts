import { readFile, readdir } from "fs/promises";
import { join } from "path";
import type { SpecsChange } from "./types.js";
import { debug } from "../utils/logger.js";

async function getFileListRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = entry.name;
      if (entry.isDirectory()) {
        const subFiles = await getFileListRecursive(join(dir, entry.name));
        files.push(...subFiles.map((f) => join(relativePath, f)));
      } else {
        files.push(relativePath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

function getFirstDiffLine(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i] || "";
    const newLine = newLines[i] || "";
    if (oldLine !== newLine) {
      // Return a truncated version of the changed line
      const line = newLine.trim().slice(0, 50);
      return line || "(line changed)";
    }
  }
  return "";
}

export async function generateSpecsChangelog(
  oldSpecsDir: string,
  newSourceDir: string,
): Promise<SpecsChange[]> {
  const changes: SpecsChange[] = [];

  // Get file lists
  const oldFiles = await getFileListRecursive(oldSpecsDir);
  const newFiles = await getFileListRecursive(newSourceDir);

  // Normalize path separators for comparison
  const normalize = (p: string) => p.replace(/\\/g, "/");
  const oldSet = new Set(oldFiles.map(normalize));
  const newSet = new Set(newFiles.map(normalize));

  // Check for added/modified files
  for (const file of newFiles) {
    const normalizedFile = normalize(file);
    if (!oldSet.has(normalizedFile)) {
      changes.push({ file: normalizedFile, status: "added" });
    } else {
      // Compare content
      const oldContent = await readFile(join(oldSpecsDir, file), "utf-8").catch((err) => {
        debug(`Could not read old spec file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        return "";
      });
      const newContent = await readFile(join(newSourceDir, file), "utf-8");
      if (oldContent !== newContent) {
        changes.push({
          file: normalizedFile,
          status: "modified",
          summary: getFirstDiffLine(oldContent, newContent),
        });
      }
    }
  }

  // Check for removed files
  for (const file of oldFiles) {
    const normalizedFile = normalize(file);
    if (!newSet.has(normalizedFile)) {
      changes.push({ file: normalizedFile, status: "removed" });
    }
  }

  return changes;
}

export function formatChangelog(changes: SpecsChange[], timestamp: string): string {
  if (changes.length === 0) {
    return `# Specs Changelog\n\nNo changes detected.\n`;
  }

  let md = `# Specs Changelog\n\nLast updated: ${timestamp}\n\n`;

  const added = changes.filter((c) => c.status === "added");
  const modified = changes.filter((c) => c.status === "modified");
  const removed = changes.filter((c) => c.status === "removed");

  if (added.length) {
    md += `## Added\n${added.map((c) => `- ${c.file}`).join("\n")}\n\n`;
  }
  if (modified.length) {
    md += `## Modified\n${modified.map((c) => `- ${c.file}${c.summary ? ` (${c.summary})` : ""}`).join("\n")}\n\n`;
  }
  if (removed.length) {
    md += `## Removed\n${removed.map((c) => `- ${c.file}`).join("\n")}\n\n`;
  }

  return md;
}
