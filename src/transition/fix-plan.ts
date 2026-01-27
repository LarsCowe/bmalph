import type { Story, FixPlanItem } from "./types.js";

export function generateFixPlan(stories: Story[]): string {
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
    lines.push(`  > Spec: specs/planning-artifacts/stories.md#story-${anchor}`);
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

export function parseFixPlan(content: string): FixPlanItem[] {
  const items: FixPlanItem[] = [];
  // Match: - [x] Story 1.1: Title  or  - [ ] Story 2.3: Title
  const pattern = /^\s*-\s*\[([ xX])\]\s*Story\s+(\d+\.\d+):/gm;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    items.push({
      id: match[2],
      completed: match[1].toLowerCase() === "x",
    });
  }
  return items;
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
