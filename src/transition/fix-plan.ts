import type { Story, FixPlanItemWithTitle } from "./types.js";

export function generateFixPlan(stories: Story[], storiesFileName?: string): string {
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
    const fileName = storiesFileName ?? "stories.md";
    lines.push(`  > Spec: specs/planning-artifacts/${fileName}#story-${anchor}`);
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
 */
export function detectRenumberedStories(
  existingItems: FixPlanItemWithTitle[],
  newStories: Story[]
): string[] {
  const warnings: string[] = [];

  // Build a map of new story titles (lowercased) to IDs
  const newTitleToId = new Map<string, string>();
  for (const story of newStories) {
    newTitleToId.set(story.title.toLowerCase().trim(), story.id);
  }

  // Check each completed story
  for (const item of existingItems) {
    if (!item.completed || !item.title) continue;

    const normalizedTitle = item.title.toLowerCase().trim();
    const newId = newTitleToId.get(normalizedTitle);

    // If title exists under a different ID, warn about renumbering
    if (newId && newId !== item.id) {
      warnings.push(
        `Story "${item.title}" appears to have been renumbered from ${item.id} to ${newId}. Completion status was not preserved.`
      );
    }
  }

  return warnings;
}

export function mergeFixPlanProgress(newFixPlan: string, completedIds: Set<string>): string {
  // Replace [ ] with [x] for completed story IDs
  return newFixPlan.replace(
    /^(\s*-\s*)\[ \](\s*Story\s+(\d+\.\d+):)/gm,
    (match, prefix, suffix, id) => {
      return completedIds.has(id) ? `${prefix}[x]${suffix}` : match;
    }
  );
}
