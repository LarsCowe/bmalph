import type { Story } from "./types.js";

// Cached regex patterns for performance (compiled once at module load)
const GIVEN_LINE_PATTERN = /^\*?\*?Given\*?\*?\s/;
const GWT_LINE_PATTERN = /^\*?\*?(Given|When|Then)\*?\*?\s/;
const BOLD_PATTERN = /\*\*/g;
const EPIC_HEADER_PATTERN = /^##\s+Epic\s+\d+:\s+(.+)/;
const HEADING_PATTERN = /^#{2,3}\s/;
const STORY_HEADER_PATTERN = /^###\s+Story\s+([\d.]+):\s+(.+)/;
const STORY_ID_PATTERN = /^\d+\.\d+$/;
const AC_HEADING_PATTERN = /^\*?\*?Acceptance Criteria\*?\*?:?/i;

export interface ParseStoriesResult {
  stories: Story[];
  warnings: string[];
}

function isGivenLine(line: string): boolean {
  return GIVEN_LINE_PATTERN.test(line.trim());
}

function isGwtLine(line: string): boolean {
  return GWT_LINE_PATTERN.test(line.trim());
}

function stripBold(text: string): string {
  return text.replace(BOLD_PATTERN, "");
}

function parseAcBlocks(lines: string[]): string[] {
  const criteria: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isGivenLine(trimmed)) {
      // Start new criterion block
      if (current.length > 0) {
        criteria.push(current.map(stripBold).join(", "));
      }
      current = [trimmed];
    } else if (isGwtLine(trimmed)) {
      current.push(trimmed);
    }
  }

  if (current.length > 0) {
    criteria.push(current.map(stripBold).join(", "));
  }

  return criteria;
}

export function parseStories(content: string): Story[] {
  return parseStoriesWithWarnings(content).stories;
}

export function parseStoriesWithWarnings(content: string): ParseStoriesResult {
  const stories: Story[] = [];
  const warnings: string[] = [];
  let currentEpic = "";
  let currentEpicDescription = "";

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match Epic headers: ## Epic N: Title
    const epicMatch = line.match(EPIC_HEADER_PATTERN);
    if (epicMatch) {
      currentEpic = epicMatch[1].trim();
      // Collect all non-empty lines between epic header and first story/next heading
      const descLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (HEADING_PATTERN.test(lines[j])) break;
        const trimmed = lines[j].trim();
        if (trimmed) descLines.push(trimmed);
      }
      currentEpicDescription = descLines.join(" ");
      continue;
    }

    // Match Story headers: ### Story N.M: Title
    const storyMatch = line.match(STORY_HEADER_PATTERN);
    if (storyMatch) {
      const id = storyMatch[1];
      const title = storyMatch[2].trim();

      // Validate story ID format (should be like "1.1", "2.3", etc.)
      if (!STORY_ID_PATTERN.test(id)) {
        warnings.push(`Story "${title}" has malformed ID "${id}" (expected format: N.M)`);
      }

      // Collect all body lines until next heading
      const bodyLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (HEADING_PATTERN.test(lines[j])) break;
        bodyLines.push(lines[j]);
      }

      // Find where AC starts: either "**Acceptance Criteria:**" heading or first Given line
      let acStartIndex = bodyLines.findIndex((l) => AC_HEADING_PATTERN.test(l.trim()));

      if (acStartIndex === -1) {
        // Look for first Given/When/Then line as AC start
        acStartIndex = bodyLines.findIndex((l) => isGivenLine(l));
      }

      // Description: all non-empty lines before AC
      const descSource = acStartIndex > -1 ? bodyLines.slice(0, acStartIndex) : bodyLines;
      const descLines: string[] = [];
      for (const dl of descSource) {
        if (dl.trim()) descLines.push(dl.trim());
      }

      // Acceptance criteria: lines from AC start onward
      const acLines = acStartIndex > -1 ? bodyLines.slice(acStartIndex) : [];
      const acceptanceCriteria = parseAcBlocks(acLines);

      // Warn about stories with missing acceptance criteria
      if (acceptanceCriteria.length === 0) {
        warnings.push(`Story ${id}: "${title}" has no acceptance criteria`);
      }

      // Warn about stories without a description
      if (descLines.length === 0) {
        warnings.push(`Story ${id}: "${title}" has no description`);
      }

      // Warn about stories not assigned to an epic
      if (!currentEpic) {
        warnings.push(`Story ${id}: "${title}" is not under an epic`);
      }

      stories.push({
        epic: currentEpic,
        epicDescription: currentEpicDescription,
        id,
        title,
        description: descLines.join(" "),
        acceptanceCriteria,
      });
    }
  }

  return { stories, warnings };
}
