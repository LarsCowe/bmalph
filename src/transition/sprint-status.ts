import type { SprintStatusParseResult, SprintStoryStatus } from "./types.js";

const STORY_STATUSES = new Set<SprintStoryStatus>([
  "backlog",
  "ready-for-dev",
  "in-progress",
  "review",
  "done",
  "drafted",
]);
const EPIC_STATUSES = new Set(["backlog", "in-progress", "done", "contexted"]);
const RETROSPECTIVE_STATUSES = new Set(["optional", "done"]);

function parseIndentedEntry(line: string): { key: string; status: string } | null {
  const match = /^\s+([^:#]+):\s*([a-z-]+)\s*$/i.exec(line);
  if (!match) return null;

  return {
    key: match[1]!.trim(),
    status: match[2]!.trim().toLowerCase(),
  };
}

function storyIdFromKey(key: string): string | null {
  const match = /^(\d+)-(\d+)-.+$/.exec(key);
  if (!match) return null;
  return `${match[1]}.${match[2]}`;
}

export function parseSprintStatus(content: string): SprintStatusParseResult {
  const warnings: string[] = [];
  const fatalWarnings: string[] = [];
  const storyStatusById = new Map<string, SprintStoryStatus>();
  const lines = content.split(/\r?\n/);
  const developmentStatusIndex = lines.findIndex((line) => /^development_status:\s*$/i.test(line));

  if (developmentStatusIndex === -1) {
    return {
      storyStatusById,
      warnings: ['Sprint status is missing a "development_status" section'],
      valid: false,
    };
  }

  for (const line of lines.slice(developmentStatusIndex + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const entry = parseIndentedEntry(line);
    if (!entry) {
      fatalWarnings.push(`Sprint status entry could not be parsed: ${line.trim()}`);
      continue;
    }

    if (entry.key.endsWith("-retrospective")) {
      if (!RETROSPECTIVE_STATUSES.has(entry.status)) {
        warnings.push(
          `Sprint retrospective entry "${entry.key}" has invalid status "${entry.status}"`
        );
      }
      continue;
    }

    if (entry.key.startsWith("epic-")) {
      if (!EPIC_STATUSES.has(entry.status)) {
        warnings.push(`Sprint epic entry "${entry.key}" has invalid status "${entry.status}"`);
      }
      continue;
    }

    if (!STORY_STATUSES.has(entry.status as SprintStoryStatus)) {
      fatalWarnings.push(`Sprint story entry "${entry.key}" has invalid status "${entry.status}"`);
      continue;
    }

    const storyId = storyIdFromKey(entry.key);
    if (!storyId) {
      fatalWarnings.push(
        `Sprint story entry "${entry.key}" does not match the expected N-M-name format`
      );
      continue;
    }

    if (storyStatusById.has(storyId)) {
      fatalWarnings.push(`Sprint story entry "${entry.key}" duplicates story ID "${storyId}"`);
      continue;
    }

    storyStatusById.set(storyId, entry.status as SprintStoryStatus);
  }

  if (fatalWarnings.length > 0) {
    return {
      storyStatusById: new Map<string, SprintStoryStatus>(),
      warnings: [...warnings, ...fatalWarnings],
      valid: false,
    };
  }

  return {
    storyStatusById,
    warnings,
    valid: true,
  };
}
