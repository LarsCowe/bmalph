import { describe, it, expect } from "vitest";
import {
  extractSection,
  extractProjectContext,
  generateProjectContextMd,
  generatePrompt,
  detectTruncation,
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
      expect(result).toBe("This is the executive summary content.\nIt spans multiple lines.");
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

    it("truncates to explicit maxLength when provided", () => {
      const content = `## Long Section

${"A".repeat(600)}

## Next Section
`;
      const result = extractSection(content, /^##\s+Long Section/m, 100);
      expect(result.length).toBe(100);
    });

    it("does not truncate content under 5000 chars (default limit)", () => {
      // Content just under 5000 chars should not be truncated
      const longContent = "B".repeat(4500);
      const content = `## Goals

${longContent}

## Next Section
`;
      const result = extractSection(content, /^##\s+Goals/m);
      expect(result).toBe(longContent);
    });

    it("truncates content over 5000 chars when no explicit maxLength", () => {
      // Content over 5000 chars should be truncated
      const veryLongContent = "C".repeat(6000);
      const content = `## Goals

${veryLongContent}

## Next Section
`;
      const result = extractSection(content, /^##\s+Goals/m);
      expect(result.length).toBe(5000);
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
      expect(result).toBe("This is the final section with no following heading.");
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
      const { context } = extractProjectContext(artifacts);
      expect(context.projectGoals).toContain("Our project aims to build a developer CLI tool.");
    });

    it("extracts project goals from Portuguese PRD headings", () => {
      const artifacts = new Map([
        [
          "prd-login.md",
          `# PRD

## Resumo Executivo

Construir uma ferramenta CLI para equipes de produto.

## Outro
`,
        ],
      ]);

      const { context } = extractProjectContext(artifacts);
      expect(context.projectGoals).toContain(
        "Construir uma ferramenta CLI para equipes de produto."
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
      const { context } = extractProjectContext(artifacts);
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
      const { context } = extractProjectContext(artifacts);
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
      const { context } = extractProjectContext(artifacts);
      expect(context.projectGoals).toContain("Project goals defined here.");
      expect(context.targetUsers).toContain("Developers and technical leads.");
      expect(context.architectureConstraints).toContain("Must use TypeScript.");
      expect(context.technicalRisks).toContain("Third-party API rate limits.");
    });

    it("extracts scope boundaries from Product Scope", () => {
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## Product Scope

- In scope: project onboarding
- Out of scope: marketplace billing

## Next
`,
        ],
      ]);
      const { context } = extractProjectContext(artifacts);

      expect(context.scopeBoundaries).toContain("project onboarding");
      expect(context.scopeBoundaries).toContain("marketplace billing");
    });

    it("extracts Spanish scope and non-functional requirements", () => {
      const artifacts = new Map([
        [
          "prd-billing.md",
          `# PRD

## Requisitos No Funcionales

- Mantener la auditoria disponible

## Alcance

- En alcance: autenticacion
- Fuera de alcance: facturacion
`,
        ],
      ]);

      const { context } = extractProjectContext(artifacts);

      expect(context.nonFunctionalRequirements).toContain("Mantener la auditoria disponible");
      expect(context.scopeBoundaries).toContain("autenticacion");
      expect(context.scopeBoundaries).toContain("facturacion");
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
      const { context } = extractProjectContext(artifacts);
      expect(context.successMetrics).toContain("95% test coverage");
    });

    it("handles empty artifacts map", () => {
      const artifacts = new Map<string, string>();
      const { context } = extractProjectContext(artifacts);
      expect(context.projectGoals).toBe("");
      expect(context.successMetrics).toBe("");
    });

    it("tracks truncation when content exceeds max length", () => {
      const longContent = "X".repeat(6000);
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## Executive Summary

${longContent}

## Other Section
`,
        ],
      ]);
      const { context, truncated } = extractProjectContext(artifacts);
      expect(context.projectGoals.length).toBe(5000);
      expect(truncated.length).toBeGreaterThan(0);
      expect(truncated[0].field).toBe("projectGoals");
      expect(truncated[0].originalLength).toBe(6000);
      expect(truncated[0].truncatedTo).toBe(5000);
    });

    it("returns empty truncated array when no content is truncated", () => {
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## Executive Summary

Short content.
`,
        ],
      ]);
      const { truncated } = extractProjectContext(artifacts);
      expect(truncated).toEqual([]);
    });

    it("extracts design guidelines from UX documents", () => {
      const artifacts = new Map([
        [
          "ux-specs.md",
          `# UX Specifications

## Design Principles

- Mobile-first responsive design
- Accessibility WCAG 2.1 AA compliance
- Consistent visual hierarchy

## User Flows

Login -> Dashboard -> Settings

## Other
`,
        ],
      ]);
      const { context } = extractProjectContext(artifacts);
      expect(context.designGuidelines).toContain("Mobile-first responsive design");
      expect(context.designGuidelines).toContain("Accessibility WCAG 2.1 AA compliance");
    });

    it("extracts research insights from research documents", () => {
      const artifacts = new Map([
        [
          "market-research.md",
          `# Market Research

## Key Findings

- 70% of developers prefer CLI tools over GUIs
- Average onboarding time is 15 minutes

## Recommendations

Prioritize documentation and quick-start guides.

## Other
`,
        ],
      ]);
      const { context } = extractProjectContext(artifacts);
      expect(context.researchInsights).toContain("70% of developers prefer CLI tools");
    });

    it("extracts from multiple UX heading patterns", () => {
      const artifacts = new Map([
        [
          "ux-design.md",
          `# UX Design

## Design System

Color palette: primary blue, accent green
Typography: Inter for body, mono for code

## Visual Foundation

Grid: 8px base unit

## Next Section
`,
        ],
      ]);
      const { context } = extractProjectContext(artifacts);
      expect(context.designGuidelines).toContain("Color palette");
    });

    it("extracts from multiple research heading patterns", () => {
      const artifacts = new Map([
        [
          "domain-brief.md",
          `# Domain Brief

## Domain Insights

The CI/CD market is growing at 18% annually.
Key players include GitHub Actions, GitLab CI.

## Other
`,
        ],
      ]);
      const { context } = extractProjectContext(artifacts);
      expect(context.researchInsights).toContain("CI/CD market is growing");
    });

    it("returns empty UX/research fields when no matching artifacts exist", () => {
      const artifacts = new Map([
        [
          "prd.md",
          `# PRD

## Executive Summary

Goals here.
`,
        ],
      ]);
      const { context } = extractProjectContext(artifacts);
      expect(context.designGuidelines).toBe("");
      expect(context.researchInsights).toBe("");
    });

    it("truncates long UX/research content", () => {
      const longContent = "D".repeat(6000);
      const artifacts = new Map([
        [
          "ux-specs.md",
          `# UX

## Design Principles

${longContent}

## Other
`,
        ],
      ]);
      const { context, truncated } = extractProjectContext(artifacts);
      expect(context.designGuidelines.length).toBe(5000);
      expect(truncated.some((t) => t.field === "designGuidelines")).toBe(true);
    });
  });

  describe("detectTruncation", () => {
    it("converts truncation info to warning strings", () => {
      const truncated = [
        { field: "projectGoals", originalLength: 6000, truncatedTo: 5000 },
        { field: "architectureConstraints", originalLength: 7000, truncatedTo: 5000 },
      ];
      const warnings = detectTruncation(truncated);
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain("projectGoals");
      expect(warnings[0]).toContain("6000");
      expect(warnings[0]).toContain("5000");
      expect(warnings[1]).toContain("architectureConstraints");
    });

    it("returns empty array when no truncation", () => {
      const warnings = detectTruncation([]);
      expect(warnings).toEqual([]);
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

    it("includes design guidelines section when present", () => {
      const context = {
        projectGoals: "Goals",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
        designGuidelines: "Mobile-first, WCAG 2.1 AA",
      };
      const md = generateProjectContextMd(context, "TestProject");

      expect(md).toContain("## Design Guidelines");
      expect(md).toContain("Mobile-first, WCAG 2.1 AA");
    });

    it("includes research insights section when present", () => {
      const context = {
        projectGoals: "Goals",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
        researchInsights: "70% of users prefer CLI tools",
      };
      const md = generateProjectContextMd(context, "TestProject");

      expect(md).toContain("## Research Insights");
      expect(md).toContain("70% of users prefer CLI tools");
    });

    it("omits design guidelines and research insights when empty", () => {
      const context = {
        projectGoals: "Goals",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
        designGuidelines: "",
        researchInsights: "",
      };
      const md = generateProjectContextMd(context, "TestProject");

      expect(md).not.toContain("## Design Guidelines");
      expect(md).not.toContain("## Research Insights");
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

    it("uses SPECS_INDEX.md instead of hardcoded planning subdirectories", () => {
      const prompt = generatePrompt("Test");

      expect(prompt).toContain("Use the exact spec paths listed in SPECS_INDEX.md");
      expect(prompt).not.toContain("planning-artifacts/:");
      expect(prompt).not.toContain("implementation-artifacts/:");
    });

    it("embeds project context when provided", () => {
      const context = {
        projectGoals: "Build a CLI tool for developers",
        successMetrics: "95% test coverage, <100ms response",
        architectureConstraints: "Must use TypeScript, Node.js 20+",
        technicalRisks: "",
        scopeBoundaries: "MVP: core features only",
        targetUsers: "",
        nonFunctionalRequirements: "",
      };
      const prompt = generatePrompt("TestProject", context);

      expect(prompt).toContain("### Project Goals");
      expect(prompt).toContain("Build a CLI tool for developers");
      expect(prompt).toContain("### Success Metrics");
      expect(prompt).toContain("95% test coverage");
      expect(prompt).toContain("### Architecture Constraints");
      expect(prompt).toContain("Must use TypeScript");
      expect(prompt).toContain("### Scope");
      expect(prompt).toContain("MVP: core features only");
    });

    it("omits empty context sections from prompt", () => {
      const context = {
        projectGoals: "Only goals are set",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
      };
      const prompt = generatePrompt("TestProject", context);

      expect(prompt).toContain("### Project Goals");
      expect(prompt).toContain("Only goals are set");
      expect(prompt).not.toContain("### Success Metrics");
      expect(prompt).not.toContain("### Architecture Constraints");
      expect(prompt).not.toContain("### Scope");
    });

    it("works without context parameter (backwards compatible)", () => {
      const prompt = generatePrompt("TestProject");
      expect(prompt).toContain("TestProject project");
      expect(prompt).toContain("RALPH_STATUS");
      expect(prompt).not.toContain("### Project Goals");
    });

    it("embeds design guidelines in prompt when provided", () => {
      const context = {
        projectGoals: "Build a CLI",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
        designGuidelines: "Mobile-first responsive layout",
      };
      const prompt = generatePrompt("TestProject", context);

      expect(prompt).toContain("### Design Guidelines");
      expect(prompt).toContain("Mobile-first responsive layout");
    });

    it("embeds research insights in prompt when provided", () => {
      const context = {
        projectGoals: "Build a CLI",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
        researchInsights: "Market analysis shows 70% CLI preference",
      };
      const prompt = generatePrompt("TestProject", context);

      expect(prompt).toContain("### Research Insights");
      expect(prompt).toContain("Market analysis shows 70% CLI preference");
    });

    it("omits design/research sections from prompt when empty", () => {
      const context = {
        projectGoals: "Build a CLI",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
        designGuidelines: "",
        researchInsights: "",
      };
      const prompt = generatePrompt("TestProject", context);

      expect(prompt).not.toContain("### Design Guidelines");
      expect(prompt).not.toContain("### Research Insights");
    });
  });
});
