import { readFile } from "fs/promises";
import { join } from "path";
import type { SpecsChange } from "./types.js";
import { debug } from "../utils/logger.js";
import { formatError } from "../utils/errors.js";
import { getFilesRecursive } from "../utils/file-system.js";
import { DIFF_LINE_PREVIEW_LENGTH } from "../utils/constants.js";

function getFirstDiffLine(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i] || "";
    const newLine = newLines[i] || "";
    if (oldLine !== newLine) {
      // Return a truncated version of the changed line
      const line = newLine.trim().slice(0, DIFF_LINE_PREVIEW_LENGTH);
      return line || "(line changed)";
    }
  }
  return "";
}

export async function generateSpecsChangelog(
  oldSpecsDir: string,
  newSourceDir: string
): Promise<SpecsChange[]> {
  const changes: SpecsChange[] = [];

  // Get file lists (already uses forward slashes)
  const oldFiles = await getFilesRecursive(oldSpecsDir);
  const newFiles = await getFilesRecursive(newSourceDir);

  const oldSet = new Set(oldFiles);
  const newSet = new Set(newFiles);

  // Check for added/modified files
  for (const file of newFiles) {
    if (!oldSet.has(file)) {
      changes.push({ file, status: "added" });
    } else {
      // Compare content
      const oldContent = await readFile(join(oldSpecsDir, file), "utf-8").catch((err) => {
        debug(`Could not read old spec file ${file}: ${formatError(err)}`);
        return "";
      });
      const newContent = await readFile(join(newSourceDir, file), "utf-8");
      if (oldContent !== newContent) {
        changes.push({
          file,
          status: "modified",
          summary: getFirstDiffLine(oldContent, newContent),
        });
      }
    }
  }

  // Check for removed files
  for (const file of oldFiles) {
    if (!newSet.has(file)) {
      changes.push({ file, status: "removed" });
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
