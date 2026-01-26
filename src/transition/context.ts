import type { ProjectContext } from "./types.js";

export function extractSection(content: string, headingPattern: RegExp, maxLength = 500): string {
  const match = headingPattern.exec(content);
  if (!match) return "";

  // Determine heading level from the match
  const headingLevelMatch = match[0].match(/^(#{1,6})\s/);
  const level = headingLevelMatch ? headingLevelMatch[1].length : 2;

  const startIndex = (match.index ?? 0) + match[0].length;
  const rest = content.slice(startIndex);

  // Find next heading of same or higher level
  const nextHeadingPattern = new RegExp(`^#{1,${level}}\\s`, "m");
  const nextMatch = nextHeadingPattern.exec(rest);
  const sectionBody = nextMatch ? rest.slice(0, nextMatch.index) : rest;

  const trimmed = sectionBody.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}

function extractFromPatterns(content: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const result = extractSection(content, pattern);
    if (result) return result;
  }
  return "";
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

## Specs Reading Strategy
1. Read .ralph/SPECS_INDEX.md first for a prioritized overview of all spec files
2. Follow the reading order in SPECS_INDEX.md:
   - **Critical**: Always read fully (PRD, architecture, stories)
   - **High**: Read for implementation details (test design, readiness)
   - **Medium**: Reference as needed (UX specs, sprint plans)
   - **Low**: Optional background (brainstorming sessions)
3. For files marked [LARGE], scan headers first and read relevant sections

## Current Objectives
1. Read .ralph/PROJECT_CONTEXT.md for project goals, constraints, and scope
2. Read .ralph/SPECS_INDEX.md for prioritized spec file overview
3. Study .ralph/specs/ following the reading order in SPECS_INDEX.md:
   - planning-artifacts/: PRD, architecture, epics/stories, test design, UX
   - implementation-artifacts/: sprint plans, detailed stories (if present)
   - brainstorming/: brainstorming sessions (if present)
4. Check docs/ for project knowledge and research documents (if present)
5. Review .ralph/@fix_plan.md for current priorities
6. Implement the highest priority story using TDD
7. Run tests after each implementation
8. Update @fix_plan.md with your progress

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
- .ralph/SPECS_INDEX.md: Prioritized index of all spec files with reading order
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
