import { describe, it, expect } from "vitest";
import {
  validatePrd,
  validateArchitecture,
  validateStories,
  validateReadiness,
  runPreflight,
} from "../../src/transition/preflight.js";
import type { Story } from "../../src/transition/types.js";

const COMPLETE_PRD = `# Product Requirements Document

## Executive Summary

This document outlines the requirements for building a task management platform.

## Functional Requirements

- FR1: Users can create tasks
- FR2: Users can assign tasks to team members
- FR3: Users can set due dates

## Non-Functional Requirements

- Performance: Page load under 2 seconds
- Security: All data encrypted at rest

## Scope

- In scope: Task CRUD, user management
- Out of scope: Billing, third-party integrations
`;

const COMPLETE_ARCHITECTURE = `# Architecture Document

## Tech Stack

- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL with Prisma ORM

## Key Decisions

- Server-side rendering for SEO
- REST API for backend services
`;

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    epic: "Core Features",
    epicDescription: "The core feature set",
    id: "1.1",
    title: "Implement Login",
    description: "As a user, I want to log in to the application.",
    acceptanceCriteria: [
      "Given I am on the login page, When I enter valid credentials, Then I am redirected",
    ],
    ...overrides,
  };
}

describe("preflight", () => {
  describe("validatePrd", () => {
    it("returns no issues for complete PRD with all sections", () => {
      const issues = validatePrd(COMPLETE_PRD);

      expect(issues).toHaveLength(0);
    });

    it("returns W1 when content is null", () => {
      const issues = validatePrd(null);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        id: "W1",
        severity: "warning",
        message: expect.stringMatching(/no prd/i),
      });
    });

    it("returns W3 when missing Executive Summary, Vision, and Goals", () => {
      const prd = `# PRD\n\n## Functional Requirements\n\nSome requirements.\n\n## Non-Functional Requirements\n\nSome NFRs.\n\n## Scope\n\nSome scope.\n`;

      const issues = validatePrd(prd);

      const w3 = issues.find((i) => i.id === "W3");
      expect(w3).toBeDefined();
      expect(w3!.severity).toBe("warning");
    });

    it("accepts Vision as alternative to Executive Summary", () => {
      const prd = `# PRD\n\n## Vision\n\nOur vision.\n\n## Functional Requirements\n\nReqs.\n\n## Non-Functional Requirements\n\nNFRs.\n\n## Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W3")).toBeUndefined();
    });

    it("accepts Goals as alternative to Executive Summary", () => {
      const prd = `# PRD\n\n## Goals\n\nOur goals.\n\n## Functional Requirements\n\nReqs.\n\n## Non-Functional Requirements\n\nNFRs.\n\n## Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W3")).toBeUndefined();
    });

    it("accepts Project Goals as alternative to Executive Summary", () => {
      const prd = `# PRD\n\n## Project Goals\n\nOur goals.\n\n## Functional Requirements\n\nReqs.\n\n## Non-Functional Requirements\n\nNFRs.\n\n## Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W3")).toBeUndefined();
    });

    it("accepts Portuguese PRD headings", () => {
      const prd = `# PRD

## Resumo Executivo

Visao geral.

## Requisitos Funcionais

Reqs.

## Requisitos N\u00E3o Funcionais

NFRs.

## Escopo

Scope.
`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W3")).toBeUndefined();
      expect(issues.find((i) => i.id === "W4")).toBeUndefined();
      expect(issues.find((i) => i.id === "W5")).toBeUndefined();
      expect(issues.find((i) => i.id === "W6")).toBeUndefined();
    });

    it("accepts Spanish PRD headings", () => {
      const prd = `# PRD

## Resumen Ejecutivo

Vision general.

## Requisitos Funcionales

Reqs.

## Requisitos No Funcionales

NFRs.

## Alcance

Scope.
`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W3")).toBeUndefined();
      expect(issues.find((i) => i.id === "W4")).toBeUndefined();
      expect(issues.find((i) => i.id === "W5")).toBeUndefined();
      expect(issues.find((i) => i.id === "W6")).toBeUndefined();
    });

    it("returns W4 when missing Functional Requirements", () => {
      const prd = `# PRD\n\n## Executive Summary\n\nSummary.\n\n## Non-Functional Requirements\n\nNFRs.\n\n## Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      const w4 = issues.find((i) => i.id === "W4");
      expect(w4).toBeDefined();
      expect(w4!.severity).toBe("warning");
    });

    it("returns W5 when missing Non-Functional Requirements", () => {
      const prd = `# PRD\n\n## Executive Summary\n\nSummary.\n\n## Functional Requirements\n\nReqs.\n\n## Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      const w5 = issues.find((i) => i.id === "W5");
      expect(w5).toBeDefined();
      expect(w5!.severity).toBe("warning");
    });

    it("accepts NFR as alternative to Non-Functional Requirements", () => {
      const prd = `# PRD\n\n## Executive Summary\n\nSummary.\n\n## Functional Requirements\n\nReqs.\n\n## NFR\n\nNFRs.\n\n## Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W5")).toBeUndefined();
    });

    it("accepts Quality as alternative to Non-Functional Requirements", () => {
      const prd = `# PRD\n\n## Executive Summary\n\nSummary.\n\n## Functional Requirements\n\nReqs.\n\n## Quality\n\nQuality attrs.\n\n## Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W5")).toBeUndefined();
    });

    it("returns W6 when missing Scope section", () => {
      const prd = `# PRD\n\n## Executive Summary\n\nSummary.\n\n## Functional Requirements\n\nReqs.\n\n## Non-Functional Requirements\n\nNFRs.\n`;

      const issues = validatePrd(prd);

      const w6 = issues.find((i) => i.id === "W6");
      expect(w6).toBeDefined();
      expect(w6!.severity).toBe("warning");
    });

    it("accepts In Scope as alternative to Scope", () => {
      const prd = `# PRD\n\n## Executive Summary\n\nSummary.\n\n## Functional Requirements\n\nReqs.\n\n## Non-Functional Requirements\n\nNFRs.\n\n## In Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W6")).toBeUndefined();
    });

    it("accepts Product Scope as alternative to Scope", () => {
      const prd = `# PRD\n\n## Executive Summary\n\nSummary.\n\n## Functional Requirements\n\nReqs.\n\n## Non-Functional Requirements\n\nNFRs.\n\n## Product Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      expect(issues.find((i) => i.id === "W6")).toBeUndefined();
    });

    it("returns multiple warnings for PRD missing all sections", () => {
      const prd = `# PRD\n\nJust some text without proper sections.\n`;

      const issues = validatePrd(prd);

      const ids = issues.map((i) => i.id);
      expect(ids).toContain("W3");
      expect(ids).toContain("W4");
      expect(ids).toContain("W5");
      expect(ids).toContain("W6");
    });

    it("does not detect sections with ### heading level", () => {
      const prd = `# PRD\n\n### Executive Summary\n\nSummary.\n\n### Functional Requirements\n\nReqs.\n\n### Non-Functional Requirements\n\nNFRs.\n\n### Scope\n\nScope.\n`;

      const issues = validatePrd(prd);

      // ### headings should not match ## patterns, so all warnings fire
      expect(issues.map((i) => i.id)).toContain("W3");
      expect(issues.map((i) => i.id)).toContain("W4");
      expect(issues.map((i) => i.id)).toContain("W5");
      expect(issues.map((i) => i.id)).toContain("W6");
    });
  });

  describe("validateArchitecture", () => {
    it("returns no issues for complete architecture", () => {
      const issues = validateArchitecture(COMPLETE_ARCHITECTURE);

      expect(issues).toHaveLength(0);
    });

    it("returns W2 when content is null", () => {
      const issues = validateArchitecture(null);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        id: "W2",
        severity: "warning",
        message: expect.stringMatching(/no architecture/i),
      });
    });

    it("returns W7 when missing Tech Stack", () => {
      const arch = `# Architecture\n\n## Key Decisions\n\n- REST API\n- Microservices\n`;

      const issues = validateArchitecture(arch);

      const w7 = issues.find((i) => i.id === "W7");
      expect(w7).toBeDefined();
      expect(w7!.severity).toBe("warning");
    });

    it("accepts Technology Stack as alternative to Tech Stack", () => {
      const arch = `# Architecture\n\n## Technology Stack\n\n- React\n- Node.js\n`;

      const issues = validateArchitecture(arch);

      expect(issues.find((i) => i.id === "W7")).toBeUndefined();
    });

    it("accepts Starter Template Evaluation as a tech stack source", () => {
      const arch = `# Architecture\n\n## Starter Template Evaluation\n\n- Next.js starter with TypeScript and Vitest\n`;

      const issues = validateArchitecture(arch);

      expect(issues.find((i) => i.id === "W7")).toBeUndefined();
    });

    it("accepts Core Architectural Decisions as a tech stack source", () => {
      const arch = `# Architecture\n\n## Core Architectural Decisions\n\n- Use Node.js with TypeScript and Prisma\n`;

      const issues = validateArchitecture(arch);

      expect(issues.find((i) => i.id === "W7")).toBeUndefined();
    });
  });

  describe("validateStories", () => {
    it("returns no issues for well-formed stories with acceptance criteria", () => {
      const stories = [
        makeStory({ id: "1.1" }),
        makeStory({ id: "1.2", title: "Implement Signup" }),
        makeStory({ id: "2.1", title: "Dashboard" }),
      ];

      const issues = validateStories(stories, []);

      expect(issues).toHaveLength(0);
    });

    it("returns W8 for stories without acceptance criteria from parseWarnings", () => {
      const stories = [makeStory({ id: "1.1", acceptanceCriteria: [] })];
      const parseWarnings = ['Story 1.1: "Implement Login" has no acceptance criteria'];

      const issues = validateStories(stories, parseWarnings);

      const w8 = issues.find((i) => i.id === "W8");
      expect(w8).toBeDefined();
      expect(w8!.severity).toBe("warning");
      expect(w8!.message).toContain("1.1");
    });

    it("returns W9 for stories without description from parseWarnings", () => {
      const stories = [makeStory({ id: "2.1", description: "" })];
      const parseWarnings = ['Story 2.1: "Dashboard" has no description'];

      const issues = validateStories(stories, parseWarnings);

      const w9 = issues.find((i) => i.id === "W9");
      expect(w9).toBeDefined();
      expect(w9!.severity).toBe("warning");
    });

    it("returns W10 for stories not under an epic from parseWarnings", () => {
      const stories = [makeStory({ id: "1.1", epic: "" })];
      const parseWarnings = ['Story 1.1: "Implement Login" is not under an epic'];

      const issues = validateStories(stories, parseWarnings);

      const w10 = issues.find((i) => i.id === "W10");
      expect(w10).toBeDefined();
      expect(w10!.severity).toBe("warning");
    });

    it("returns I2 when fewer than 3 stories", () => {
      const stories = [makeStory({ id: "1.1" }), makeStory({ id: "1.2", title: "Signup" })];

      const issues = validateStories(stories, []);

      const i2 = issues.find((i) => i.id === "I2");
      expect(i2).toBeDefined();
      expect(i2!.severity).toBe("info");
    });

    it("does not return I2 when exactly 3 stories", () => {
      const stories = [
        makeStory({ id: "1.1" }),
        makeStory({ id: "1.2", title: "Signup" }),
        makeStory({ id: "2.1", title: "Dashboard" }),
      ];

      const issues = validateStories(stories, []);

      expect(issues.find((i) => i.id === "I2")).toBeUndefined();
    });

    it("surfaces multiple parse warnings as separate issues", () => {
      const stories = [makeStory({ id: "1.1" })];
      const parseWarnings = [
        'Story 1.1: "Implement Login" has no acceptance criteria',
        'Story 1.1: "Implement Login" has no description',
      ];

      const issues = validateStories(stories, parseWarnings);

      expect(issues.filter((i) => i.id === "W8")).toHaveLength(1);
      expect(issues.filter((i) => i.id === "W9")).toHaveLength(1);
    });
  });

  describe("validateReadiness", () => {
    it("returns I1 when no readiness file found", () => {
      const issues = validateReadiness(null);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        id: "I1",
        severity: "info",
        message: expect.stringMatching(/no readiness report/i),
      });
    });

    it("returns E1 when NO-GO status detected", () => {
      const content = `# Readiness Report\n\n## Status\n\n**NO-GO** - Missing test coverage.\n`;

      const issues = validateReadiness(content);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        id: "E1",
        severity: "error",
        message: expect.stringMatching(/no-go/i),
      });
      expect(issues[0]!.suggestion).toBeDefined();
    });

    it("returns no issues when GO status", () => {
      const content = `# Readiness Report\n\n## Status\n\n**GO** - All requirements met.\n`;

      const issues = validateReadiness(content);

      expect(issues).toHaveLength(0);
    });

    it("detects NO-GO with hyphen", () => {
      const issues = validateReadiness("Status: NO-GO");

      expect(issues[0]!.id).toBe("E1");
    });

    it("detects NO GO with space", () => {
      const issues = validateReadiness("Status: NO GO");

      expect(issues[0]!.id).toBe("E1");
    });

    it("detects No-Go mixed case", () => {
      const issues = validateReadiness("Status: No-Go");

      expect(issues[0]!.id).toBe("E1");
    });

    it("detects NOGO without separator", () => {
      const issues = validateReadiness("Status: NOGO");

      expect(issues[0]!.id).toBe("E1");
    });
  });

  describe("runPreflight", () => {
    it("aggregates all validator results", () => {
      const artifactContents = new Map<string, string>();
      const files: string[] = [];
      const stories = [makeStory({ id: "1.1" })];

      const result = runPreflight(artifactContents, files, stories, []);

      // Should have W1 (no PRD), W2 (no arch), I1 (no readiness), I2 (fewer than 3 stories)
      expect(result.issues.length).toBeGreaterThanOrEqual(4);
      const ids = result.issues.map((i) => i.id);
      expect(ids).toContain("W1");
      expect(ids).toContain("W2");
      expect(ids).toContain("I1");
      expect(ids).toContain("I2");
    });

    it("sets pass to true when no errors", () => {
      const artifactContents = new Map([
        ["prd.md", COMPLETE_PRD],
        ["architecture.md", COMPLETE_ARCHITECTURE],
      ]);
      const files = ["prd.md", "architecture.md"];
      const stories = [
        makeStory({ id: "1.1" }),
        makeStory({ id: "1.2", title: "Signup" }),
        makeStory({ id: "2.1", title: "Dashboard" }),
      ];

      const result = runPreflight(artifactContents, files, stories, []);

      expect(result.pass).toBe(true);
    });

    it("sets pass to false when errors present", () => {
      const nogoReadiness = `# Readiness Report\n\n**NO-GO** - Blocking issues.\n`;
      const artifactContents = new Map([
        ["prd.md", COMPLETE_PRD],
        ["architecture.md", COMPLETE_ARCHITECTURE],
        ["readiness.md", nogoReadiness],
      ]);
      const files = ["prd.md", "architecture.md", "readiness.md"];
      const stories = [
        makeStory({ id: "1.1" }),
        makeStory({ id: "1.2", title: "Signup" }),
        makeStory({ id: "2.1", title: "Dashboard" }),
      ];

      const result = runPreflight(artifactContents, files, stories, []);

      expect(result.pass).toBe(false);
      expect(result.issues.find((i) => i.id === "E1")).toBeDefined();
    });

    it("includes all warnings and infos regardless of errors", () => {
      const nogoReadiness = `# Readiness Report\n\n**NO-GO** - Blocking issues.\n`;
      const artifactContents = new Map([["readiness.md", nogoReadiness]]);
      const files = ["readiness.md"];
      const stories = [makeStory({ id: "1.1" })];

      const result = runPreflight(artifactContents, files, stories, []);

      // Should have E1, W1, W2, I2
      expect(result.issues.find((i) => i.id === "E1")).toBeDefined();
      expect(result.issues.find((i) => i.id === "W1")).toBeDefined();
      expect(result.issues.find((i) => i.id === "W2")).toBeDefined();
      expect(result.issues.find((i) => i.id === "I2")).toBeDefined();
    });

    it("finds PRD content by filename pattern", () => {
      const artifactContents = new Map([
        ["my-prd-v2.md", COMPLETE_PRD],
        ["architecture.md", COMPLETE_ARCHITECTURE],
      ]);
      const files = ["my-prd-v2.md", "architecture.md"];
      const stories = [
        makeStory({ id: "1.1" }),
        makeStory({ id: "1.2", title: "Signup" }),
        makeStory({ id: "2.1", title: "Dashboard" }),
      ];

      const result = runPreflight(artifactContents, files, stories, []);

      expect(result.issues.find((i) => i.id === "W1")).toBeUndefined();
    });

    it("finds architecture content by filename pattern", () => {
      const artifactContents = new Map([
        ["prd.md", COMPLETE_PRD],
        ["technical-architect.md", COMPLETE_ARCHITECTURE],
      ]);
      const files = ["prd.md", "technical-architect.md"];
      const stories = [
        makeStory({ id: "1.1" }),
        makeStory({ id: "1.2", title: "Signup" }),
        makeStory({ id: "2.1", title: "Dashboard" }),
      ];

      const result = runPreflight(artifactContents, files, stories, []);

      expect(result.issues.find((i) => i.id === "W2")).toBeUndefined();
    });
  });
});
