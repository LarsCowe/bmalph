import { readFile, writeFile, readdir, cp, mkdir, access } from "fs/promises";
import { join } from "path";
import { debug } from "./utils/logger.js";

export interface ProjectContext {
  projectGoals: string;
  successMetrics: string;
  architectureConstraints: string;
  technicalRisks: string;
  scopeBoundaries: string;
  targetUsers: string;
  nonFunctionalRequirements: string;
}

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
1. Read .ralph/PROJECT_CONTEXT.md for project goals, constraints, and scope
2. Study .ralph/specs/ for BMAD planning output:
   - planning-artifacts/: PRD, architecture, epics/stories, test design, UX
   - implementation-artifacts/: sprint plans, detailed stories (if present)
   - brainstorming/: brainstorming sessions (if present)
3. Check docs/ for project knowledge and research documents (if present)
4. Review .ralph/@fix_plan.md for current priorities
5. Implement the highest priority story using TDD
6. Run tests after each implementation
7. Update @fix_plan.md with your progress

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
- .ralph/PROJECT_CONTEXT.md: High-level project goals, constraints, and scope
- .ralph/specs/: Project specifications (PRD, architecture, stories)
- .ralph/@fix_plan.md: Prioritized TODO list (one entry per story)
- .ralph/@AGENT.md: Project build and run instructions
- .ralph/PROMPT.md: This file
- .ralph/logs/: Loop execution logs

## Current Task
Follow .ralph/@fix_plan.md and implement the next incomplete story using TDD.
`;
}

export interface TechStack {
  setup: string;
  test: string;
  build: string;
  dev: string;
}

export function detectTechStack(content: string): TechStack | null {
  // Find tech stack section
  const stackMatch = content.match(/^##\s+(?:Tech(?:nology)?\s+Stack|Stack)/im);
  if (!stackMatch) return null;

  const startIndex = stackMatch.index!;
  // Extract section content until next ## heading or end
  const rest = content.slice(startIndex);
  const nextHeading = rest.slice(1).search(/^##\s/m);
  const sectionContent = nextHeading > -1 ? rest.slice(0, nextHeading + 1) : rest;

  // Detect language/runtime
  const isNode = /\bnode(?:\.js)?\b/i.test(sectionContent) || /\btypescript\b/i.test(sectionContent) || /\bnpm\b/i.test(sectionContent);
  const isPython = /\bpython\b/i.test(sectionContent) || /\bpip\b/i.test(sectionContent);
  const isRust = /\brust\b/i.test(sectionContent) || /\bcargo\b/i.test(sectionContent);
  const isGo = /\bgo\b/i.test(sectionContent) || /\bgolang\b/i.test(sectionContent);

  if (isNode) {
    // Detect specific test runner
    let testCmd = "npm test";
    if (/\bvitest\b/i.test(sectionContent)) testCmd = "npx vitest run";
    else if (/\bjest\b/i.test(sectionContent)) testCmd = "npx jest";
    else if (/\bmocha\b/i.test(sectionContent)) testCmd = "npx mocha";

    // Detect build command
    let buildCmd = "npm run build";
    if (/\btsc\b/i.test(sectionContent)) buildCmd = "npx tsc";

    return { setup: "npm install", test: testCmd, build: buildCmd, dev: "npm run dev" };
  }

  if (isPython) {
    let testCmd = "python -m pytest";
    if (/\bpytest\b/i.test(sectionContent)) testCmd = "pytest";
    else if (/\bunittest\b/i.test(sectionContent)) testCmd = "python -m unittest discover";

    return { setup: "pip install -r requirements.txt", test: testCmd, build: "python -m build", dev: "python -m uvicorn main:app --reload" };
  }

  if (isRust) {
    return { setup: "cargo build", test: "cargo test", build: "cargo build --release", dev: "cargo run" };
  }

  if (isGo) {
    return { setup: "go mod download", test: "go test ./...", build: "go build ./...", dev: "go run ." };
  }

  return null;
}

export function customizeAgentMd(template: string, stack: TechStack): string {
  const sections: { heading: string; command: string }[] = [
    { heading: "Project Setup", command: stack.setup },
    { heading: "Running Tests", command: stack.test },
    { heading: "Build Commands", command: stack.build },
    { heading: "Development Server", command: stack.dev },
  ];

  let result = template;
  for (const { heading, command } of sections) {
    // Replace code block content after the section heading
    const pattern = new RegExp(
      `(## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n)\`\`\`bash\\n[\\s\\S]*?\`\`\``,
      "m",
    );
    result = result.replace(pattern, `$1\`\`\`bash\n${command}\n\`\`\``);
  }

  return result;
}

export function hasFixPlanProgress(content: string): boolean {
  return /^\s*-\s*\[x\]/im.test(content);
}

export interface FixPlanItem {
  id: string;
  completed: boolean;
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

export function mergeFixPlanProgress(
  newFixPlan: string,
  completedIds: Set<string>,
): string {
  // Replace [ ] with [x] for completed story IDs
  return newFixPlan.replace(
    /^(\s*-\s*)\[ \](\s*Story\s+(\d+\.\d+):)/gm,
    (match, prefix, suffix, id) => {
      return completedIds.has(id) ? `${prefix}[x]${suffix}` : match;
    },
  );
}

export interface SpecsChange {
  file: string;
  status: "added" | "modified" | "removed";
  summary?: string;
}

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
      const oldContent = await readFile(join(oldSpecsDir, file), "utf-8").catch(() => "");
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

export function extractSection(content: string, headingPattern: RegExp, maxLength = 500): string {
  const match = headingPattern.exec(content);
  if (!match) return "";

  // Determine heading level from the match
  const headingLevelMatch = match[0].match(/^(#{1,6})\s/);
  const level = headingLevelMatch ? headingLevelMatch[1].length : 2;

  const startIndex = match.index! + match[0].length;
  const rest = content.slice(startIndex);

  // Find next heading of same or higher level
  const nextHeadingPattern = new RegExp(`^#{1,${level}}\\s`, "m");
  const nextMatch = nextHeadingPattern.exec(rest);
  const sectionBody = nextMatch ? rest.slice(0, nextMatch.index) : rest;

  const trimmed = sectionBody.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}

export function extractProjectContext(artifacts: Map<string, string>): ProjectContext {
  // Combine all content, keyed by likely role
  let prdContent = "";
  let archContent = "";

  for (const [filename, content] of artifacts) {
    if (/prd/i.test(filename)) prdContent += "\n" + content;
    if (/architect/i.test(filename)) archContent += "\n" + content;
    if (/readiness/i.test(filename)) archContent += "\n" + content;
  }

  const allContent = prdContent + "\n" + archContent;

  return {
    projectGoals: extractFromPatterns(prdContent || allContent, [
      /^##\s+Executive Summary/m,
      /^##\s+Vision/m,
      /^##\s+Goals/m,
      /^##\s+Project Goals/m,
    ]),
    successMetrics: extractFromPatterns(prdContent || allContent, [
      /^##\s+Success (?:Criteria|Metrics)/m,
      /^##\s+KPIs?/m,
      /^##\s+Metrics/m,
      /^##\s+Key Performance/m,
    ]),
    architectureConstraints: extractFromPatterns(archContent || allContent, [
      /^##\s+Constraints/m,
      /^##\s+ADR/m,
      /^##\s+Architecture Decision/m,
    ]),
    technicalRisks: extractFromPatterns(archContent || allContent, [
      /^##\s+Risks/m,
      /^##\s+Technical Risks/m,
      /^##\s+Mitigations/m,
      /^##\s+Risk/m,
    ]),
    scopeBoundaries: extractFromPatterns(prdContent || allContent, [
      /^##\s+Scope/m,
      /^##\s+In Scope/m,
      /^##\s+Out of Scope/m,
      /^##\s+Boundaries/m,
    ]),
    targetUsers: extractFromPatterns(prdContent || allContent, [
      /^##\s+Target Users/m,
      /^##\s+Users/m,
      /^##\s+Personas/m,
      /^##\s+User Profiles/m,
    ]),
    nonFunctionalRequirements: extractFromPatterns(prdContent || allContent, [
      /^##\s+Non-Functional/m,
      /^##\s+NFR/m,
      /^##\s+Quality/m,
      /^##\s+Quality Attributes/m,
    ]),
  };
}

function extractFromPatterns(content: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const result = extractSection(content, pattern);
    if (result) return result;
  }
  return "";
}

export function generateProjectContextMd(context: ProjectContext, projectName: string): string {
  const lines: string[] = [`# ${projectName} — Project Context`, ""];

  const sections: { heading: string; content: string }[] = [
    { heading: "Project Goals", content: context.projectGoals },
    { heading: "Success Metrics", content: context.successMetrics },
    { heading: "Architecture Constraints", content: context.architectureConstraints },
    { heading: "Technical Risks", content: context.technicalRisks },
    { heading: "Scope Boundaries", content: context.scopeBoundaries },
    { heading: "Target Users", content: context.targetUsers },
    { heading: "Non-Functional Requirements", content: context.nonFunctionalRequirements },
  ];

  for (const { heading, content } of sections) {
    if (content) {
      lines.push(`## ${heading}`, "", content, "");
    }
  }

  return lines.join("\n");
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

export async function runTransition(projectDir: string): Promise<{ storiesCount: number; warnings: string[]; fixPlanPreserved: boolean }> {
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

  // Check existing fix_plan for completed items (smart merge)
  let completedIds = new Set<string>();
  const fixPlanPath = join(projectDir, ".ralph/@fix_plan.md");
  try {
    const existingFixPlan = await readFile(fixPlanPath, "utf-8");
    const items = parseFixPlan(existingFixPlan);
    completedIds = new Set(items.filter((i) => i.completed).map((i) => i.id));
    debug(`Found ${completedIds.size} completed stories in existing fix_plan`);
  } catch {
    // No existing file, start fresh
  }

  // Generate new fix_plan from current stories, preserving completion status
  const newFixPlan = generateFixPlan(stories);
  const mergedFixPlan = mergeFixPlanProgress(newFixPlan, completedIds);
  await writeFile(fixPlanPath, mergedFixPlan);

  // Track whether progress was preserved for return value
  const fixPlanPreserved = completedIds.size > 0;

  // Generate changelog before overwriting specs/
  const specsDir = join(projectDir, ".ralph/specs");
  const bmadOutputDir = join(projectDir, "_bmad-output");
  try {
    await access(bmadOutputDir);
    const changes = await generateSpecsChangelog(specsDir, bmadOutputDir);
    if (changes.length > 0) {
      const changelog = formatChangelog(changes, new Date().toISOString());
      await writeFile(join(projectDir, ".ralph/SPECS_CHANGELOG.md"), changelog);
      debug(`Generated SPECS_CHANGELOG.md with ${changes.length} changes`);
    }
  } catch {
    // No bmad-output directory yet, skip changelog
  }

  // Copy entire _bmad-output/ tree to .ralph/specs/ (preserving structure)
  try {
    await access(bmadOutputDir);
    await cp(bmadOutputDir, join(projectDir, ".ralph/specs"), { recursive: true });
    debug("Copied _bmad-output/ to .ralph/specs/");
  } catch {
    // Fall back to just artifactsDir if _bmad-output root doesn't exist
    await mkdir(join(projectDir, ".ralph/specs"), { recursive: true });
    for (const file of files) {
      await cp(join(artifactsDir, file), join(projectDir, ".ralph/specs", file), { recursive: true });
    }
  }

  // Generate PROJECT_CONTEXT.md from planning artifacts
  const artifactContents = new Map<string, string>();
  for (const file of files) {
    if (file.endsWith(".md")) {
      try {
        const content = await readFile(join(artifactsDir, file), "utf-8");
        artifactContents.set(file, content);
      } catch {
        debug(`Could not read artifact: ${file}`);
      }
    }
  }

  let projectName = "project";
  try {
    const configContent = await readFile(join(projectDir, "bmalph/config.json"), "utf-8");
    const config = JSON.parse(configContent);
    projectName = config.name || projectName;
  } catch {
    // Use default name
  }

  if (artifactContents.size > 0) {
    const projectContext = extractProjectContext(artifactContents);
    const contextMd = generateProjectContextMd(projectContext, projectName);
    await writeFile(join(projectDir, ".ralph/PROJECT_CONTEXT.md"), contextMd);
    debug("Generated PROJECT_CONTEXT.md");
  }

  // Generate PROMPT.md
  // Try to preserve rich PROMPT.md template if it has the placeholder
  let prompt: string;
  try {
    const existingPrompt = await readFile(join(projectDir, ".ralph/PROMPT.md"), "utf-8");
    if (existingPrompt.includes("[YOUR PROJECT NAME]")) {
      prompt = existingPrompt.replace(/\[YOUR PROJECT NAME\]/g, projectName);
    } else {
      prompt = generatePrompt(projectName);
    }
  } catch {
    prompt = generatePrompt(projectName);
  }
  await writeFile(join(projectDir, ".ralph/PROMPT.md"), prompt);

  // Customize @AGENT.md based on detected tech stack from architecture
  const architectureFile = files.find((f) => /architect/i.test(f));
  if (architectureFile) {
    try {
      const archContent = await readFile(join(artifactsDir, architectureFile), "utf-8");
      const stack = detectTechStack(archContent);
      if (stack) {
        const agentPath = join(projectDir, ".ralph/@AGENT.md");
        const agentTemplate = await readFile(agentPath, "utf-8");
        const customized = customizeAgentMd(agentTemplate, stack);
        await writeFile(agentPath, customized);
        debug("Customized @AGENT.md with detected tech stack");
      }
    } catch {
      debug("Could not customize @AGENT.md");
    }
  }

  // Validate artifacts and collect warnings
  const warnings = await validateArtifacts(files, artifactsDir);

  return { storiesCount: stories.length, warnings, fixPlanPreserved };
}
