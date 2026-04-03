import type { FixPlanItemWithTitle } from "../transition/types.js";
import type { FixPlanEpicGroup } from "./types.js";

const EPIC_HEADING_PATTERN = /^###\s+.+/;
const GOAL_LINE_PATTERN = /^>\s*Goal:\s*(.+)/;
const SECTION_HEADING_PATTERN = /^##\s+/;
const UNGROUPED_HEADING = "### Ungrouped Stories";

/**
 * Parses a fix plan into epic groups, preserving raw markdown blocks.
 *
 * Scans for `### ` headings and collects all content until the next heading
 * or the `## Completed`/`## Notes` section. Stories appearing before any
 * `### ` heading are collected into a synthetic "Ungrouped Stories" group.
 */
export function parseFixPlanWithEpics(content: string): FixPlanEpicGroup[] {
  const lines = content.split("\n");
  const groups: FixPlanEpicGroup[] = [];

  let currentHeading: string | null = null;
  let currentGoal: string | null = null;
  let currentBlockLines: string[] = [];
  let currentStories: FixPlanItemWithTitle[] = [];
  let orphanedBlockLines: string[] = [];
  let orphanedStories: FixPlanItemWithTitle[] = [];
  let inStoriesSection = false;

  for (const line of lines) {
    // Detect the "## Stories to Implement" section start
    if (/^##\s+Stories to Implement/i.test(line)) {
      inStoriesSection = true;
      continue;
    }

    // Stop at "## Completed", "## Notes", or any other ## section
    if (
      inStoriesSection &&
      SECTION_HEADING_PATTERN.test(line) &&
      !EPIC_HEADING_PATTERN.test(line)
    ) {
      break;
    }

    if (!inStoriesSection) {
      continue;
    }

    // New epic heading
    if (EPIC_HEADING_PATTERN.test(line)) {
      // Flush previous group
      if (currentHeading !== null) {
        groups.push(buildGroup(currentHeading, currentGoal, currentBlockLines, currentStories));
      } else if (orphanedStories.length > 0) {
        groups.push(buildGroup(UNGROUPED_HEADING, null, orphanedBlockLines, orphanedStories));
        orphanedBlockLines = [];
        orphanedStories = [];
      }

      currentHeading = line;
      currentGoal = null;
      currentBlockLines = [line];
      currentStories = [];
      continue;
    }

    // Goal line (only right after a heading, before any story)
    if (currentHeading !== null && currentStories.length === 0) {
      const goalMatch = line.match(GOAL_LINE_PATTERN);
      if (goalMatch) {
        currentGoal = goalMatch[1]!.trim();
        currentBlockLines.push(line);
        continue;
      }
    }

    // Story line or detail line
    if (currentHeading !== null) {
      currentBlockLines.push(line);
      collectStoryIfMatch(line, currentStories);
    } else {
      // Before any heading — collect as orphaned
      orphanedBlockLines.push(line);
      collectStoryIfMatch(line, orphanedStories);
    }
  }

  // Flush final group
  if (currentHeading !== null) {
    groups.push(buildGroup(currentHeading, currentGoal, currentBlockLines, currentStories));
  }

  // Flush any remaining orphaned stories (no epic heading appeared at all)
  if (orphanedStories.length > 0) {
    groups.push(buildGroup(UNGROUPED_HEADING, null, orphanedBlockLines, orphanedStories));
  }

  return groups;
}

/** Single-line story matcher (no global flag — safe for per-line matching). */
const STORY_LINE_PATTERN = /^\s*-\s*\[([ xX])\]\s*Story\s+([\d.]+):\s*(.+?)$/;

function collectStoryIfMatch(line: string, stories: FixPlanItemWithTitle[]): void {
  const match = STORY_LINE_PATTERN.exec(line);
  if (match) {
    stories.push({
      id: match[2]!,
      completed: match[1]!.toLowerCase() === "x",
      title: match[3]?.trim(),
    });
  }
}

function buildGroup(
  heading: string,
  goal: string | null,
  blockLines: string[],
  stories: FixPlanItemWithTitle[]
): FixPlanEpicGroup {
  // Trim trailing empty lines from the block
  while (blockLines.length > 0 && blockLines[blockLines.length - 1]!.trim() === "") {
    blockLines.pop();
  }

  return {
    rawBlock: blockLines.join("\n"),
    epicHeading: heading,
    epicGoal: goal,
    stories,
  };
}

const FIX_PLAN_HEADER = `# Ralph Fix Plan

## Stories to Implement
`;

const FIX_PLAN_FOOTER = `
## Completed

## Notes
- Follow TDD methodology (red-green-refactor)
- One story per Ralph loop iteration
- Update this file after completing each story
`;

/**
 * Generates a valid fix plan from a subset of epic groups.
 * Concatenates raw blocks verbatim — no reformatting.
 */
export function generateWorkerFixPlan(groups: FixPlanEpicGroup[]): string {
  if (groups.length === 0) {
    return FIX_PLAN_HEADER + FIX_PLAN_FOOTER;
  }

  const body = groups.map((g) => g.rawBlock).join("\n\n");
  return FIX_PLAN_HEADER + "\n" + body + "\n" + FIX_PLAN_FOOTER;
}
