import type { ProjectContext, TruncationInfo } from "./types.js";
import {
  NON_FUNCTIONAL_REQUIREMENTS_SECTION_PATTERNS,
  PRD_SCOPE_SECTION_PATTERNS,
  PROJECT_GOALS_SECTION_PATTERNS,
} from "./section-patterns.js";
import { SECTION_EXTRACT_MAX_LENGTH } from "../utils/constants.js";
import { collectTransitionArtifacts } from "./artifact-collection.js";

export interface ExtractProjectContextResult {
  context: ProjectContext;
  truncated: TruncationInfo[];
}

export interface ExtractSectionResult {
  content: string;
  wasTruncated: boolean;
  originalLength: number;
}

export function extractSection(
  content: string,
  headingPattern: RegExp,
  maxLength = SECTION_EXTRACT_MAX_LENGTH
): string {
  return extractSectionWithInfo(content, headingPattern, maxLength).content;
}

export function extractSectionWithInfo(
  content: string,
  headingPattern: RegExp,
  maxLength = SECTION_EXTRACT_MAX_LENGTH
): ExtractSectionResult {
  const match = headingPattern.exec(content);
  if (!match) return { content: "", wasTruncated: false, originalLength: 0 };

  // Determine heading level from the match
  const headingLevelMatch = match[0].match(/^(#{1,6})\s/);
  const level = headingLevelMatch ? headingLevelMatch[1]!.length : 2;

  const startIndex = match.index + match[0].length;
  const rest = content.slice(startIndex);

  // Find next heading of same or higher level
  const nextHeadingPattern = new RegExp(`^#{1,${level}}\\s`, "m");
  const nextMatch = nextHeadingPattern.exec(rest);
  const sectionBody = nextMatch ? rest.slice(0, nextMatch.index) : rest;

  const trimmed = sectionBody.trim();
  if (trimmed.length <= maxLength) {
    return { content: trimmed, wasTruncated: false, originalLength: trimmed.length };
  }
  return {
    content: trimmed.slice(0, maxLength),
    wasTruncated: true,
    originalLength: trimmed.length,
  };
}

interface ExtractFromPatternsResult {
  content: string;
  wasTruncated: boolean;
  originalLength: number;
}

export function extractFirstMatchingSection(
  content: string,
  patterns: readonly RegExp[],
  maxLength = SECTION_EXTRACT_MAX_LENGTH
): string {
  return extractFirstMatchingSectionWithInfo(content, patterns, maxLength).content;
}

export function extractFirstMatchingSectionWithInfo(
  content: string,
  patterns: readonly RegExp[],
  maxLength = SECTION_EXTRACT_MAX_LENGTH
): ExtractFromPatternsResult {
  for (const pattern of patterns) {
    const result = extractSectionWithInfo(content, pattern, maxLength);
    if (result.content) return result;
  }
  return { content: "", wasTruncated: false, originalLength: 0 };
}

export function extractMatchingSections(
  content: string,
  patterns: readonly RegExp[],
  maxLength = SECTION_EXTRACT_MAX_LENGTH
): string[] {
  const sections: string[] = [];

  for (const pattern of patterns) {
    const result = extractSectionWithInfo(content, pattern, maxLength);
    if (result.content) {
      sections.push(result.content);
    }
  }

  return sections;
}

export function extractProjectContext(artifacts: Map<string, string>): ExtractProjectContextResult {
  // Combine all content, keyed by likely role
  let prdContent = "";
  let archContent = "";
  let uxContent = "";
  let researchContent = "";
  const collectedArtifacts = collectTransitionArtifacts([...artifacts.keys()]);

  for (const [filename, content] of artifacts) {
    if (collectedArtifacts.prdFiles.includes(filename)) prdContent += "\n" + content;
    if (collectedArtifacts.architectureFiles.includes(filename)) archContent += "\n" + content;
    if (collectedArtifacts.readinessFiles.includes(filename)) archContent += "\n" + content;
    if (/ux/i.test(filename)) uxContent += "\n" + content;
    if (/research|market|domain|brief/i.test(filename)) researchContent += "\n" + content;
  }

  const allContent = prdContent + "\n" + archContent;
  const truncated: TruncationInfo[] = [];

  const fields: { field: keyof ProjectContext; source: string; patterns: RegExp[] }[] = [
    {
      field: "projectGoals",
      source: prdContent || allContent,
      patterns: [...PROJECT_GOALS_SECTION_PATTERNS],
    },
    {
      field: "successMetrics",
      source: prdContent || allContent,
      patterns: [
        /^##\s+Success (?:Criteria|Metrics)/m,
        /^##\s+KPIs?/m,
        /^##\s+Metrics/m,
        /^##\s+Key Performance/m,
      ],
    },
    {
      field: "architectureConstraints",
      source: archContent || allContent,
      patterns: [/^##\s+Constraints/m, /^##\s+ADR/m, /^##\s+Architecture Decision/m],
    },
    {
      field: "technicalRisks",
      source: archContent || allContent,
      patterns: [/^##\s+Risks/m, /^##\s+Technical Risks/m, /^##\s+Mitigations/m, /^##\s+Risk/m],
    },
    {
      field: "scopeBoundaries",
      source: prdContent || allContent,
      patterns: [...PRD_SCOPE_SECTION_PATTERNS, /^##\s+Boundaries/m],
    },
    {
      field: "targetUsers",
      source: prdContent || allContent,
      patterns: [/^##\s+Target Users/m, /^##\s+Users/m, /^##\s+Personas/m, /^##\s+User Profiles/m],
    },
    {
      field: "nonFunctionalRequirements",
      source: prdContent || allContent,
      patterns: [...NON_FUNCTIONAL_REQUIREMENTS_SECTION_PATTERNS],
    },
    {
      field: "designGuidelines",
      source: uxContent,
      patterns: [
        /^##\s+Design Principles/m,
        /^##\s+Design System/m,
        /^##\s+Core Experience/m,
        /^##\s+User Flows/m,
        /^##\s+Visual Foundation/m,
      ],
    },
    {
      field: "researchInsights",
      source: researchContent,
      patterns: [
        /^##\s+Key Findings/m,
        /^##\s+Recommendations/m,
        /^##\s+Market Analysis/m,
        /^##\s+Domain Insights/m,
        /^##\s+Summary/m,
      ],
    },
  ];

  const context: ProjectContext = {
    projectGoals: "",
    successMetrics: "",
    architectureConstraints: "",
    technicalRisks: "",
    scopeBoundaries: "",
    targetUsers: "",
    nonFunctionalRequirements: "",
    designGuidelines: "",
    researchInsights: "",
  };

  for (const { field, source, patterns } of fields) {
    const result = extractFirstMatchingSectionWithInfo(source, patterns);
    context[field] = result.content;
    if (result.wasTruncated) {
      truncated.push({
        field,
        originalLength: result.originalLength,
        truncatedTo: result.content.length,
      });
    }
  }

  return {
    context,
    truncated,
  };
}

/**
 * Converts truncation info into human-readable warnings.
 */
export function detectTruncation(truncated: TruncationInfo[]): string[] {
  return truncated.map(
    (t) =>
      `${t.field} was truncated from ${t.originalLength} to ${t.truncatedTo} characters. Some content may be missing.`
  );
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
    { heading: "Design Guidelines", content: context.designGuidelines },
    { heading: "Research Insights", content: context.researchInsights },
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

## Current Objectives
1. Read .ralph/@fix_plan.md and identify the next incomplete story
2. Check existing codebase for related code — especially which existing files need changes to integrate your work
3. Implement the story using TDD (red-green-refactor)
4. Run tests after implementation
5. Toggle the completed story checkbox in @fix_plan.md from \`- [ ]\` to \`- [x]\`
6. Commit with descriptive conventional commit message
7. Read specs ONLY if the story's inline acceptance criteria are insufficient

## Development Methodology (BMAD Dev Agent)

For each story in @fix_plan.md:
1. Read the story's inline acceptance criteria (lines starting with \`> AC:\`)
2. Write failing tests first (RED)
3. Implement minimum code to pass tests (GREEN)
4. Refactor while keeping tests green (REFACTOR)
5. Toggle the completed story checkbox
6. Commit with descriptive conventional commit message

## Specs Reference (Read On Demand)
- .ralph/SPECS_INDEX.md lists all spec files with paths and priorities
- .ralph/PROJECT_CONTEXT.md summarizes project goals, constraints, and scope
- Read specific specs only when the current story requires clarification
- For files marked [LARGE] in SPECS_INDEX.md, scan headers first

## Key Principles
- Write code within the first few minutes of each loop
- ONE story per loop - focus completely on it
- TDD: tests first, always
- Search the codebase before assuming something isn't implemented
- Creating new files is often only half the task — wire them into the existing application
- Commit working changes with descriptive messages

## Session Continuity
- If you have context from a previous loop, do NOT re-read spec files
- Resume implementation where you left off
- Only consult specs when you encounter ambiguity in the current story

## Progress Tracking (CRITICAL)
- Ralph tracks progress by counting story checkboxes in @fix_plan.md
- When you complete a story, change \`- [ ]\` to \`- [x]\` on that exact story line
- Do NOT remove, rewrite, or reorder story lines in @fix_plan.md
- Update the checkbox before committing so the monitor updates immediately
- Set \`TASKS_COMPLETED_THIS_LOOP\` to the exact number of story checkboxes toggled this loop
- Only valid values: 0 or 1

## Execution Guidelines
- Before making changes: search codebase using subagents
- After implementation: run essential tests for the modified code
- If tests fail: fix them as part of your current work
- Keep .ralph/@AGENT.md updated with build/run instructions
- No placeholder implementations - build it properly

## Testing Guidelines
- Write tests BEFORE implementation (TDD)
- Focus on acceptance criteria from the story
- Run the full test suite after implementation
- Fix any regressions immediately

## Autonomous Mode (CRITICAL)
- do not ask the user questions during loop execution
- do not use AskUserQuestion, EnterPlanMode, or ExitPlanMode during loop execution
- make the safest reasonable assumption and continue
- prefer small, reversible changes when requirements are ambiguous
- surface blockers in the Ralph status block instead of starting a conversation

## Self-Review Checklist (Before Reporting Status)

Before writing your RALPH_STATUS block, review your own work:

1. Re-read the diff of files you modified this loop — check for obvious bugs, typos, missing error handling
2. Verify you did not introduce regressions in existing functionality
3. Confirm your changes match the spec in .ralph/specs/ for the story you worked on
4. Check that new functions have proper error handling and edge case coverage
5. Ensure you did not leave TODO/FIXME/HACK comments without justification

If you find issues, fix them before reporting status.

## Status Reporting (CRITICAL)

At the end of your response, ALWAYS include this status block:

\`\`\`
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: 0 | 1
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
