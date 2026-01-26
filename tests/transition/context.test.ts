import { describe, it, expect } from "vitest";
import {
  extractSection,
  extractProjectContext,
  generateProjectContextMd,
  generatePrompt,
} from "../../src/transition/context.js";

describe("context", () => {
  describe("extractSection", () => {
    it("extracts section content after heading", () => {
      const content = `# Title

## Executive Summary

This is the executive summary content.
It spans multiple lines.

## Next Section

Different content here.
`;
      const result = extractSection(content, /^##\s+Executive Summary/m);
      expect(result).toBe(
        "This is the executive summary content.\nIt spans multiple lines."
      );
    });

    it("respects heading level hierarchy", () => {
      const content = `## Main Section

Content for main section.

### Subsection

Content for subsection.

## Another Main Section

This should not be included.
`;
      const result = extractSection(content, /^##\s+Main Section/m);
      expect(result).toContain("Content for main section.");
      expect(result).toContain("### Subsection");
      expect(result).toContain("Content for subsection.");
      expect(result).not.toContain("This should not be included.");
    });

    it("truncates to maxLength when content exceeds limit", () => {
      const content = `## Long Section

${"A".repeat(600)}

## Next Section
`;
      const result = extractSection(content, /^##\s+Long Section/m, 100);
      expect(result.length).toBe(100);
    });

    it("returns full content when under maxLength", () => {
      const content = `## Short Section

Brief content.

## Next Section
`;
      const result = extractSection(content, /^##\s+Short Section/m, 500);
      expect(result).toBe("Brief content.");
    });

    it("returns empty string when heading not found", () => {
      const content = "## Some Other Heading\n\nContent here.";
      const result = extractSection(content, /^##\s+Missing Heading/m);
      expect(result).toBe("");
    });

    it("handles section at end of document", () => {
      const content = `# Document

## Last Section

This is the final section with no following heading.
`;
      const result = extractSection(content, /^##\s+Last Section/m);
      expect(result).toBe(
        "This is the final section with no following heading."
      );
    });

    it("handles h1 headings correctly", () => {
      const content = `# Main Title

Introduction content.

# Second Title

Different content.
`;
      const result = extractSection(content, /^#\s+Main Title/m);
      expect(result).toBe("Introduction content.");
      expect(result).not.toContain("Different content");
    });
  });

  describe("extractProjectContext", () => {
    it("extracts project goals from PRD Executive Summary", () => {
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## Executive Summary

Our project aims to build a developer CLI tool.

## Other Section
`,
        ],
      ]);
      const context = extractProjectContext(artifacts);
      expect(context.projectGoals).toContain(
        "Our project aims to build a developer CLI tool."
      );
    });

    it("extracts architecture constraints", () => {
      const artifacts = new Map([
        [
          "architecture.md",
          `# Architecture

## Constraints

- Must work offline
- Node.js 20+ required

## Implementation
`,
        ],
      ]);
      const context = extractProjectContext(artifacts);
      expect(context.architectureConstraints).toContain("Must work offline");
      expect(context.architectureConstraints).toContain("Node.js 20+ required");
    });

    it("handles missing sections gracefully", () => {
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## Executive Summary

Goals here.
`,
        ],
      ]);
      const context = extractProjectContext(artifacts);
      expect(context.projectGoals).toBeTruthy();
      expect(context.successMetrics).toBe("");
      expect(context.architectureConstraints).toBe("");
      expect(context.technicalRisks).toBe("");
      expect(context.scopeBoundaries).toBe("");
      expect(context.targetUsers).toBe("");
      expect(context.nonFunctionalRequirements).toBe("");
    });

    it("extracts from multiple artifacts", () => {
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## Executive Summary

Project goals defined here.

## Target Users

Developers and technical leads.
`,
        ],
        [
          "architecture.md",
          `# Architecture

## Constraints

Must use TypeScript.

## Risks

Third-party API rate limits.
`,
        ],
      ]);
      const context = extractProjectContext(artifacts);
      expect(context.projectGoals).toContain("Project goals defined here.");
      expect(context.targetUsers).toContain("Developers and technical leads.");
      expect(context.architectureConstraints).toContain("Must use TypeScript.");
      expect(context.technicalRisks).toContain("Third-party API rate limits.");
    });

    it("extracts success metrics from KPIs section", () => {
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## KPIs

- 95% test coverage
- <100ms response time
`,
        ],
      ]);
      const context = extractProjectContext(artifacts);
      expect(context.successMetrics).toContain("95% test coverage");
    });

    it("handles empty artifacts map", () => {
      const artifacts = new Map<string, string>();
      const context = extractProjectContext(artifacts);
      expect(context.projectGoals).toBe("");
      expect(context.successMetrics).toBe("");
    });
  });

  describe("generateProjectContextMd", () => {
    it("formats sections with proper markdown headings", () => {
      const context = {
        projectGoals: "Build a CLI tool",
        successMetrics: "95% coverage",
        architectureConstraints: "Node.js only",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "Developers",
        nonFunctionalRequirements: "",
      };
      const md = generateProjectContextMd(context, "TestProject");

      expect(md).toContain("# TestProject — Project Context");
      expect(md).toContain("## Project Goals");
      expect(md).toContain("Build a CLI tool");
      expect(md).toContain("## Success Metrics");
      expect(md).toContain("95% coverage");
      expect(md).toContain("## Architecture Constraints");
      expect(md).toContain("Node.js only");
      expect(md).toContain("## Target Users");
      expect(md).toContain("Developers");
    });

    it("omits empty sections", () => {
      const context = {
        projectGoals: "Build a CLI tool",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
      };
      const md = generateProjectContextMd(context, "TestProject");

      expect(md).toContain("## Project Goals");
      expect(md).not.toContain("## Success Metrics");
      expect(md).not.toContain("## Architecture Constraints");
    });

    it("includes all non-empty sections", () => {
      const context = {
        projectGoals: "Goals",
        successMetrics: "Metrics",
        architectureConstraints: "Constraints",
        technicalRisks: "Risks",
        scopeBoundaries: "Scope",
        targetUsers: "Users",
        nonFunctionalRequirements: "NFRs",
      };
      const md = generateProjectContextMd(context, "FullProject");

      expect(md).toContain("## Project Goals");
      expect(md).toContain("## Success Metrics");
      expect(md).toContain("## Architecture Constraints");
      expect(md).toContain("## Technical Risks");
      expect(md).toContain("## Scope Boundaries");
      expect(md).toContain("## Target Users");
      expect(md).toContain("## Non-Functional Requirements");
    });
  });

  describe("generatePrompt", () => {
    it("includes project name in context section", () => {
      const prompt = generatePrompt("MyProject");
      expect(prompt).toContain("MyProject project");
    });

    it("includes TDD methodology instructions", () => {
      const prompt = generatePrompt("Test");
      expect(prompt).toContain("TDD");
      expect(prompt).toContain("Write failing tests first");
      expect(prompt).toContain("RED");
      expect(prompt).toContain("GREEN");
      expect(prompt).toContain("REFACTOR");
    });

    it("includes Ralph status block instructions", () => {
      const prompt = generatePrompt("Test");
      expect(prompt).toContain("---RALPH_STATUS---");
      expect(prompt).toContain("STATUS:");
      expect(prompt).toContain("EXIT_SIGNAL:");
    });

    it("includes specs reading strategy", () => {
      const prompt = generatePrompt("Test");
      expect(prompt).toContain("SPECS_INDEX.md");
      expect(prompt).toContain("Critical");
      expect(prompt).toContain("High");
      expect(prompt).toContain("Medium");
      expect(prompt).toContain("Low");
    });
  });
});
