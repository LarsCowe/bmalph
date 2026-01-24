import { readFile, writeFile, readdir, cp, mkdir, access } from "fs/promises";
import { join } from "path";
import { debug } from "./utils/logger.js";

export interface Story {
  epic: string;
  epicDescription: string;
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

export async function findArtifactsDir(projectDir: string): Promise<string | null> {
  const candidates = [
    "_bmad-output/planning-artifacts",
    "_bmad-output/planning_artifacts",
    "docs/planning",
  ];

  for (const candidate of candidates) {
    const fullPath = join(projectDir, candidate);
    debug(`Checking artifacts dir: ${fullPath}`);
    try {
      await access(fullPath);
      debug(`Found artifacts at: ${fullPath}`);
      return fullPath;
    } catch {
      continue;
    }
  }
  debug(`No artifacts found. Checked: ${candidates.join(", ")}`);
  return null;
}

function isGivenLine(line: string): boolean {
  return /^\*?\*?Given\*?\*?\s/.test(line.trim());
}

function isGwtLine(line: string): boolean {
  return /^\*?\*?(Given|When|Then)\*?\*?\s/.test(line.trim());
}

function stripBold(text: string): string {
  return text.replace(/\*\*/g, "");
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
  const stories: Story[] = [];
  let currentEpic = "";
  let currentEpicDescription = "";

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match Epic headers: ## Epic N: Title
    const epicMatch = line.match(/^##\s+Epic\s+\d+:\s+(.+)/);
    if (epicMatch) {
      currentEpic = epicMatch[1].trim();
      // Collect max 2 non-empty lines between epic header and first story/next heading
      const descLines: string[] = [];
      for (let j = i + 1; j < lines.length && descLines.length < 2; j++) {
        if (lines[j].match(/^#{2,3}\s/)) break;
        const trimmed = lines[j].trim();
        if (trimmed) descLines.push(trimmed);
      }
      currentEpicDescription = descLines.join(" ");
      continue;
    }

    // Match Story headers: ### Story N.M: Title
    const storyMatch = line.match(/^###\s+Story\s+([\d.]+):\s+(.+)/);
    if (storyMatch) {
      const id = storyMatch[1];
      const title = storyMatch[2].trim();

      // Collect all body lines until next heading
      const bodyLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^#{2,3}\s/)) break;
        bodyLines.push(lines[j]);
      }

      // Find where AC starts: either "**Acceptance Criteria:**" heading or first Given line
      let acStartIndex = bodyLines.findIndex((l) =>
        /^\*?\*?Acceptance Criteria\*?\*?:?/i.test(l.trim()),
      );

      if (acStartIndex === -1) {
        // Look for first Given/When/Then line as AC start
        acStartIndex = bodyLines.findIndex((l) => isGivenLine(l));
      }

      // Description: non-empty lines before AC (max 3)
      const descSource = acStartIndex > -1 ? bodyLines.slice(0, acStartIndex) : bodyLines;
      const descLines: string[] = [];
      for (const dl of descSource) {
        if (dl.trim()) descLines.push(dl.trim());
        if (descLines.length >= 3) break;
      }

      // Acceptance criteria: lines from AC start onward
      const acLines = acStartIndex > -1 ? bodyLines.slice(acStartIndex) : [];
      const acceptanceCriteria = parseAcBlocks(acLines);

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

  return stories;
}

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
  }

  lines.push("", "## Completed", "", "## Notes", "- Follow TDD methodology (red-green-refactor)", "- One story per Ralph loop iteration", "- Update this file after completing each story", "");

  return lines.join("\n");
}

export function generatePrompt(projectName: string): string {
  return `# Ralph Development Instructions

## Context
You are an autonomous AI development agent working on the ${projectName} project.
You follow BMAD-METHOD's developer (Amelia) persona and TDD methodology.

## Development Methodology (BMAD Dev Agent)

For each story in @fix_plan.md:
1. Read the story's inline acceptance criteria (lines starting with \`> AC:\`)
2. Write failing tests first (RED)
3. Implement minimum code to pass tests (GREEN)
4. Refactor while keeping tests green (REFACTOR)
5. Mark story as complete in @fix_plan.md
6. Commit with descriptive conventional commit message

## Current Objectives
1. Study .ralph/specs/* to learn about the project specifications
2. Review .ralph/@fix_plan.md for current priorities
3. Implement the highest priority story using TDD
4. Run tests after each implementation
5. Update @fix_plan.md with your progress

## Key Principles
- ONE story per loop - focus completely on it
- TDD: tests first, always
- Search the codebase before assuming something isn't implemented
- Write comprehensive tests with clear documentation
- Commit working changes with descriptive messages

## Testing Guidelines
- Write tests BEFORE implementation (TDD)
- Focus on acceptance criteria from the story
- Run the full test suite after implementation
- Fix any regressions immediately

## Status Reporting (CRITICAL)

At the end of your response, ALWAYS include this status block:

\`\`\`
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <number>
FILES_MODIFIED: <number>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <one line summary of what to do next>
---END_RALPH_STATUS---
\`\`\`

### When to set EXIT_SIGNAL: true
1. All items in @fix_plan.md are marked [x]
2. All tests are passing
3. No errors in the last execution
4. All requirements from specs/ are implemented

## File Structure
- .ralph/specs/: Project specifications (PRD, architecture, stories)
- .ralph/@fix_plan.md: Prioritized TODO list (one entry per story)
- .ralph/@AGENT.md: Project build and run instructions
- .ralph/PROMPT.md: This file
- .ralph/logs/: Loop execution logs

## Current Task
Follow .ralph/@fix_plan.md and implement the next incomplete story using TDD.
`;
}

export async function validateArtifacts(files: string[], artifactsDir: string): Promise<string[]> {
  const warnings: string[] = [];

  const hasPrd = files.some((f) => /prd/i.test(f));
  if (!hasPrd) {
    warnings.push("No PRD document found in planning artifacts");
  }

  const hasArchitecture = files.some((f) => /architect/i.test(f));
  if (!hasArchitecture) {
    warnings.push("No architecture document found in planning artifacts");
  }

  // Check readiness report for NO-GO
  const readinessFile = files.find((f) => /readiness/i.test(f));
  if (readinessFile) {
    try {
      const content = await readFile(join(artifactsDir, readinessFile), "utf-8");
      if (/NO[-\s]?GO/i.test(content)) {
        warnings.push("Readiness report indicates NO-GO status");
      }
    } catch {
      // Cannot read readiness file, skip
    }
  }

  return warnings;
}

export async function runTransition(projectDir: string): Promise<{ storiesCount: number; warnings: string[] }> {
  const artifactsDir = await findArtifactsDir(projectDir);
  if (!artifactsDir) {
    throw new Error(
      "No BMAD artifacts found. Run BMAD planning phases first (at minimum: Create PRD, Create Architecture, Create Epics and Stories).",
    );
  }

  // Find and parse stories file
  const files = await readdir(artifactsDir);
  const STORIES_PATTERN = /^(epics[-_]?(and[-_]?)?)?stor(y|ies)([-_]\d+)?\.md$/i;
  const storiesFile = files.find(
    (f) => STORIES_PATTERN.test(f) || /epic/i.test(f),
  );

  if (!storiesFile) {
    debug(`Files in artifacts dir: ${files.join(", ")}`);
    throw new Error(
      `No epics/stories file found in ${artifactsDir}. Available files: ${files.join(", ")}. Run 'CE' (Create Epics and Stories) first.`,
    );
  }
  debug(`Using stories file: ${storiesFile}`);

  const storiesContent = await readFile(join(artifactsDir, storiesFile), "utf-8");
  const stories = parseStories(storiesContent);

  if (stories.length === 0) {
    throw new Error("No stories parsed from the epics file. Ensure stories follow the format: ### Story N.M: Title");
  }

  // Generate fix_plan.md
  const fixPlan = generateFixPlan(stories);
  await writeFile(join(projectDir, ".ralph/@fix_plan.md"), fixPlan);

  // Copy specs (PRD, architecture, stories)
  await mkdir(join(projectDir, ".ralph/specs"), { recursive: true });
  for (const file of files) {
    await cp(
      join(artifactsDir, file),
      join(projectDir, ".ralph/specs", file),
      { recursive: true },
    );
  }

  // Copy brainstorming sessions if they exist
  const brainstormingDir = join(projectDir, "_bmad-output/brainstorming");
  try {
    await access(brainstormingDir);
    await cp(brainstormingDir, join(projectDir, ".ralph/specs/brainstorming"), { recursive: true });
    debug("Copied brainstorming sessions to .ralph/specs/brainstorming/");
  } catch {
    debug("No brainstorming directory found, skipping");
  }

  // Generate PROMPT.md
  let projectName = "project";
  try {
    const configContent = await readFile(join(projectDir, "bmalph/config.json"), "utf-8");
    const config = JSON.parse(configContent);
    projectName = config.name || projectName;
  } catch {
    // Use default name
  }

  const prompt = generatePrompt(projectName);
  await writeFile(join(projectDir, ".ralph/PROMPT.md"), prompt);

  // Validate artifacts and collect warnings
  const warnings = await validateArtifacts(files, artifactsDir);

  return { storiesCount: stories.length, warnings };
}
