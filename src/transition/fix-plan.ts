import type { Story, FixPlanItemWithTitle } from "./types.js";

function buildSpecPath(planningSpecsSubpath: string, fileName: string): string {
  const normalizedPath = [planningSpecsSubpath, fileName].filter(Boolean).join("/");
  return `specs/${normalizedPath}`;
}

export function generateFixPlan(
  stories: Story[],
  storiesFileName?: string,
  planningSpecsSubpath = "planning-artifacts"
): string {
  const lines = ["# Ralph Fix Plan", "", "## Stories to Implement", ""];

  let currentEpic = "";
  for (const story of stories) {
    if (story.epic !== currentEpic) {
      currentEpic = story.epic;
      lines.push(`### ${currentEpic}`);
      if (story.epicDescription) {
        lines.push(`> Goal: ${story.epicDescription}`);
      }
      lines.push("");
    }
    lines.push(`- [ ] Story ${story.id}: ${story.title}`);

    // Add description lines (max 3, split on sentence boundaries)
    if (story.description) {
      const descParts = story.description.split(/,\s*(?=So that|I want)|(?<=\.)\s+/);
      for (const part of descParts.slice(0, 3)) {
        if (part.trim()) lines.push(`  > ${part.trim()}`);
      }
    }

    // Add acceptance criteria
    for (const ac of story.acceptanceCriteria) {
      lines.push(`  > AC: ${ac}`);
    }

    // Add spec-link for easy reference to full story details
    const anchor = story.id.replace(".", "-");
    const fileName = storiesFileName || story.sourceFile || "stories.md";
    const specPath = buildSpecPath(planningSpecsSubpath, fileName);
    lines.push(`  > Spec: ${specPath}#story-${anchor}`);
  }

  lines.push(
    "",
    "## Completed",
    "",
    "## Notes",
    "- Follow TDD methodology (red-green-refactor)",
    "- One story per Ralph loop iteration",
    "- Update this file after completing each story",
    ""
  );

  return lines.join("\n");
}

export function hasFixPlanProgress(content: string): boolean {
  return /^\s*-\s*\[x\]/im.test(content);
}

export function parseFixPlan(content: string): FixPlanItemWithTitle[] {
  const items: FixPlanItemWithTitle[] = [];
  // Match: - [x] Story 1.1: Title  or  - [ ] Story 2.3: Title
  const pattern = /^\s*-\s*\[([ xX])\]\s*Story\s+(\d+\.\d+):\s*(.+?)$/gm;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    items.push({
      id: match[2]!,
      completed: match[1]!.toLowerCase() === "x",
      title: match[3]?.trim(),
    });
  }
  return items;
}

/**
 * Detects completed stories that are no longer in the new BMAD output.
 * Returns warnings for each orphaned completed story.
 */
export function detectOrphanedCompletedStories(
  existingItems: FixPlanItemWithTitle[],
  newStoryIds: Set<string>
): string[] {
  const warnings: string[] = [];
  for (const item of existingItems) {
    if (item.completed && !newStoryIds.has(item.id)) {
      const titlePart = item.title ? ` "${item.title}"` : "";
      warnings.push(
        `Completed story ${item.id}${titlePart} was removed from BMAD output. Work may be orphaned.`
      );
    }
  }
  return warnings;
}

/**
 * Detects stories that may have been renumbered by comparing titles.
 * Returns warnings when a completed story's title appears under a different ID.
 * Skips stories that were already auto-preserved via title-based merge.
 */
export function detectRenumberedStories(
  existingItems: FixPlanItemWithTitle[],
  newStories: Story[],
  preservedIds?: Set<string>
): string[] {
  const warnings: string[] = [];

  // Build a map of new story titles (lowercased) to IDs
  const newTitleToId = new Map<string, string>();
  for (const story of newStories) {
    newTitleToId.set(normalizeTitle(story.title), story.id);
  }

  // Check each completed story
  for (const item of existingItems) {
    if (!item.completed || !item.title) continue;

    const normalizedTitle = normalizeTitle(item.title);
    const newId = newTitleToId.get(normalizedTitle);

    // If title exists under a different ID, warn about renumbering
    // (unless it was already auto-preserved)
    if (newId && newId !== item.id && !preservedIds?.has(newId)) {
      warnings.push(
        `Story "${item.title}" appears to have been renumbered from ${item.id} to ${newId}. Completion status was not preserved.`
      );
    }
  }

  return warnings;
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().trim();
}

/**
 * Builds a map from normalized (lowercased) title to story ID for completed items.
 */
export function buildCompletedTitleMap(items: FixPlanItemWithTitle[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (item.completed && item.title) {
      map.set(normalizeTitle(item.title), item.id);
    }
  }
  return map;
}

export function mergeFixPlanProgress(
  newFixPlan: string,
  completedIds: Set<string>,
  titleMap?: Map<string, string>,
  completedTitles?: Map<string, string>
): string {
  // Replace [ ] with [x] for completed story IDs or title matches
  return newFixPlan.replace(
    /^(\s*-\s*)\[ \](\s*Story\s+(\d+\.\d+):)/gm,
    (match, prefix, suffix, id) => {
      if (completedIds.has(id)) return `${prefix}[x]${suffix}`;

      // Title-based fallback: check if title matches a completed story
      if (titleMap && completedTitles) {
        const title = titleMap.get(id);
        if (title && completedTitles.has(normalizeTitle(title))) {
          return `${prefix}[x]${suffix}`;
        }
      }

      return match;
    }
  );
}
