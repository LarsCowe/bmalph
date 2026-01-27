import type { SpecFileType, Priority, SpecFileMetadata, SpecsIndex } from "./types.js";
import { getMarkdownFilesWithContent } from "../utils/file-system.js";
import {
  LARGE_FILE_THRESHOLD_BYTES,
  DEFAULT_SNIPPET_MAX_LENGTH,
} from "../utils/constants.js";

/**
 * Detects the type of a spec file based on its filename.
 */
export function detectSpecFileType(filename: string, _content: string): SpecFileType {
  const lower = filename.toLowerCase();

  if (lower.includes("prd")) return "prd";
  if (lower.includes("arch")) return "architecture";
  // Check brainstorm before stories (brainstorm contains 'stor')
  if (lower.includes("brainstorm")) return "brainstorm";
  if (lower.includes("stor") || lower.includes("epic")) return "stories";
  if (lower.includes("ux")) return "ux";
  if (lower.includes("test")) return "test-design";
  if (lower.includes("readiness")) return "readiness";
  if (lower.includes("sprint")) return "sprint";

  return "other";
}

/**
 * Determines the reading priority for a spec file based on its type.
 */
export function determinePriority(type: SpecFileType, _size: number): Priority {
  switch (type) {
    case "prd":
    case "architecture":
    case "stories":
      return "critical";
    case "test-design":
    case "readiness":
      return "high";
    case "ux":
    case "sprint":
      return "medium";
    case "brainstorm":
    case "other":
    default:
      return "low";
  }
}

/**
 * Extracts a one-line description from file content.
 * Prefers the first heading, falls back to first non-empty line.
 */
export function extractDescription(content: string, maxLength = DEFAULT_SNIPPET_MAX_LENGTH): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  // Try to find a heading (# or ##)
  const headingMatch = /^#{1,2}\s+(.+)$/m.exec(trimmed);
  if (headingMatch) {
    let heading = headingMatch[1];
    // Remove markdown formatting
    heading = heading.replace(/\*\*([^*]+)\*\*/g, "$1");
    heading = heading.replace(/\*([^*]+)\*/g, "$1");
    heading = heading.replace(/`([^`]+)`/g, "$1");
    heading = heading.trim();

    if (heading.length > maxLength) {
      return heading.slice(0, maxLength - 3) + "...";
    }
    return heading;
  }

  // Fall back to first non-empty line
  const firstLine = trimmed.split("\n")[0].trim();
  if (firstLine.length > maxLength) {
    return firstLine.slice(0, maxLength - 3) + "...";
  }
  return firstLine;
}

/**
 * Generates a specs index from a specs directory.
 */
export async function generateSpecsIndex(specsDir: string): Promise<SpecsIndex> {
  const files = await getMarkdownFilesWithContent(specsDir);

  const metadata: SpecFileMetadata[] = files.map((file) => {
    const type = detectSpecFileType(file.path, file.content);
    const priority = determinePriority(type, file.size);
    const description = extractDescription(file.content);

    return {
      path: file.path,
      size: file.size,
      type,
      priority,
      description,
    };
  });

  // Sort by priority order: critical -> high -> medium -> low
  const priorityOrder: Record<Priority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  metadata.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalSizeKb: Math.round(totalSize / 1024),
    files: metadata,
  };
}

/**
 * Formats a specs index as markdown.
 */
export function formatSpecsIndexMd(index: SpecsIndex): string {
  const lines: string[] = [
    "# Specs Index",
    "",
    `Generated: ${index.generatedAt}`,
    `Total: ${index.totalFiles} files (${index.totalSizeKb} KB)`,
    "",
    "## Reading Order",
    "",
  ];

  const priorityConfig: { key: Priority; heading: string; description: string }[] = [
    { key: "critical", heading: "Critical (Always Read First)", description: "" },
    { key: "high", heading: "High Priority (Read for Implementation)", description: "" },
    { key: "medium", heading: "Medium Priority (Reference as Needed)", description: "" },
    { key: "low", heading: "Low Priority (Optional)", description: "" },
  ];

  let fileNumber = 1;

  for (const { key, heading } of priorityConfig) {
    const filesInPriority = index.files.filter((f) => f.priority === key);

    if (filesInPriority.length === 0) continue;

    lines.push(`### ${heading}`);

    for (const file of filesInPriority) {
      const sizeKb = Math.round(file.size / 1024);
      const isLarge = file.size >= LARGE_FILE_THRESHOLD_BYTES;

      let line = `${fileNumber}. **${file.path}** (${sizeKb} KB)`;
      if (isLarge) {
        line += " [LARGE]";
      }
      lines.push(line);

      // Add description
      if (file.description) {
        if (isLarge) {
          lines.push(`   ${file.description} - scan headers, read relevant sections`);
        } else {
          lines.push(`   ${file.description}`);
        }
      }

      lines.push("");
      fileNumber++;
    }
  }

  return lines.join("\n");
}
