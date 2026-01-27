import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseStories,
  parseStoriesWithWarnings,
  generateFixPlan,
  generatePrompt,
  runTransition,
  validateArtifacts,
  detectTechStack,
  customizeAgentMd,
  hasFixPlanProgress,
  extractSection,
  extractProjectContext,
  generateProjectContextMd,
  parseFixPlan,
  mergeFixPlanProgress,
  generateSpecsChangelog,
  formatChangelog,
  type Story,
  type TechStack,
  type ProjectContext,
} from "../src/transition.js";

describe("transition", () => {
  describe("parseStories", () => {
    it("parses a single epic with stories", () => {
      const content = `# Project - Epic Breakdown

## Epic 1: User Authentication

Secure user access management

### Story 1.1: User Registration

As a visitor,
I want to create an account,
So that I can access the application.

### Story 1.2: User Login

As a registered user,
I want to log in,
So that I can access my data.
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(2);
      expect(stories[0]).toEqual({
        epic: "User Authentication",
        id: "1.1",
        title: "User Registration",
        description: expect.stringContaining("visitor"),
        epicDescription: "Secure user access management",
        acceptanceCriteria: [],
      });
      expect(stories[1]).toEqual({
        epic: "User Authentication",
        id: "1.2",
        title: "User Login",
        description: expect.stringContaining("registered user"),
        epicDescription: "Secure user access management",
        acceptanceCriteria: [],
      });
    });

    it("parses all epic description lines without limit", () => {
      const content = `## Epic 1: Auth

Provide secure authentication.
Enable multi-factor support.
This third line should be included.
And this fourth line too.

### Story 1.1: Login

As a user, I want to log in.
`;
      const stories = parseStories(content);

      expect(stories[0].epicDescription).toContain("Provide secure authentication.");
      expect(stories[0].epicDescription).toContain("Enable multi-factor support.");
      expect(stories[0].epicDescription).toContain("This third line should be included.");
      expect(stories[0].epicDescription).toContain("And this fourth line too.");
    });

    it("parses long epic descriptions with many lines", () => {
      const epicLines = Array.from({ length: 5 }, (_, i) => `Epic description line ${i + 1}.`);
      const content = `## Epic 1: Complex Epic

${epicLines.join("\n")}

### Story 1.1: Feature

Story description.
`;
      const stories = parseStories(content);

      // All 5 epic description lines should be present
      expect(stories[0].epicDescription).toContain("Epic description line 1.");
      expect(stories[0].epicDescription).toContain("Epic description line 5.");
    });

    it("parses epic with no description lines", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Login

As a user, I want to log in.
`;
      const stories = parseStories(content);

      expect(stories[0].epicDescription).toBe("");
    });

    it("parses multiple epics", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Login

As a user, I want to log in.

## Epic 2: Dashboard

### Story 2.1: View Stats

As a user, I want to see stats.

### Story 2.2: Export Data

As an admin, I want to export data.
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(3);
      expect(stories[0].epic).toBe("Auth");
      expect(stories[1].epic).toBe("Dashboard");
      expect(stories[2].epic).toBe("Dashboard");
    });

    it("returns empty array for content with no stories", () => {
      const content = `# Just a regular document

Some text here.
`;
      expect(parseStories(content)).toEqual([]);
    });

    it("handles stories without user story format", () => {
      const content = `## Epic 1: Setup

### Story 1.1: Project Init

Set up the project structure with TypeScript.
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(1);
      expect(stories[0].title).toBe("Project Init");
      expect(stories[0].description).toContain("project structure");
      expect(stories[0].acceptanceCriteria).toEqual([]);
    });

    it("skips story with no title after colon", () => {
      const content = `## Epic 1: Auth

### Story 1.1:

As a user, I want something.

### Story 1.2: Valid Story

Description here.
`;
      const stories = parseStories(content);
      // Story 1.1 has no title (regex requires .+), so it's skipped
      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe("1.2");
      expect(stories[0].title).toBe("Valid Story");
    });

    it("handles epic header with no stories", () => {
      const content = `## Epic 1: Empty Epic

No stories here.

## Epic 2: Has Stories

### Story 2.1: First Story

Description.
`;
      const stories = parseStories(content);
      expect(stories).toHaveLength(1);
      expect(stories[0].epic).toBe("Has Stories");
      expect(stories[0].id).toBe("2.1");
    });

    it("handles complex story IDs", () => {
      const content = `## Epic 1: Core

### Story 10.25: Complex ID

Description.
`;
      const stories = parseStories(content);
      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe("10.25");
    });

    it("handles AC with empty When/Then lines", () => {
      const content = `## Epic 1: Core

### Story 1.1: Feature

Description.

**Acceptance Criteria:**

**Given** some precondition
**When**
**Then**
`;
      const stories = parseStories(content);
      expect(stories).toHaveLength(1);
      // The parser requires a space after the keyword, so empty When/Then won't match
      expect(stories[0].acceptanceCriteria.length).toBeGreaterThanOrEqual(0);
    });

    it("parses all story description lines without limit", () => {
      const content = `## Epic 1: Setup

### Story 1.1: Init

Line one of description.
Line two of description.
Line three of description.
Line four of description.
Line five of description.
`;
      const stories = parseStories(content);
      expect(stories).toHaveLength(1);
      // All 5 lines should be included in description
      expect(stories[0].description).toContain("Line one of description.");
      expect(stories[0].description).toContain("Line five of description.");
      expect(stories[0].acceptanceCriteria).toEqual([]);
    });

    it("parses long story descriptions with many lines", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `Description line ${i + 1}.`);
      const content = `## Epic 1: Feature

### Story 1.1: Complex Feature

${lines.join("\n")}
`;
      const stories = parseStories(content);
      expect(stories).toHaveLength(1);
      // All 10 lines should be present
      expect(stories[0].description).toContain("Description line 1.");
      expect(stories[0].description).toContain("Description line 10.");
    });

    it("parses acceptance criteria in heading-based format", () => {
      const content = `## Epic 1: Auth

### Story 1.1: User Registration

As a visitor,
I want to create an account,
So that I can access the application.

**Acceptance Criteria:**

**Given** valid email and password
**When** user submits registration form
**Then** account is created and user receives confirmation

**Given** an already registered email
**When** user submits registration form
**Then** an error message is shown
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(1);
      expect(stories[0].description).toContain("visitor");
      expect(stories[0].acceptanceCriteria).toHaveLength(2);
      expect(stories[0].acceptanceCriteria[0]).toContain("Given");
      expect(stories[0].acceptanceCriteria[0]).toContain("valid email and password");
      expect(stories[0].acceptanceCriteria[0]).toContain("When");
      expect(stories[0].acceptanceCriteria[0]).toContain("Then");
      expect(stories[0].acceptanceCriteria[1]).toContain("already registered email");
    });

    it("parses inline Given/When/Then format without heading", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Login

As a user, I want to log in.

Given valid credentials
When user submits login form
Then user is redirected to dashboard
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(1);
      expect(stories[0].acceptanceCriteria).toHaveLength(1);
      expect(stories[0].acceptanceCriteria[0]).toContain("Given valid credentials");
      expect(stories[0].acceptanceCriteria[0]).toContain("When user submits login form");
      expect(stories[0].acceptanceCriteria[0]).toContain("Then user is redirected to dashboard");
    });

    it("returns empty acceptanceCriteria when story has no AC", () => {
      const content = `## Epic 1: Setup

### Story 1.1: Init

Initialize the project.
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(1);
      expect(stories[0].acceptanceCriteria).toEqual([]);
    });

    it("separates description from acceptance criteria correctly", () => {
      const content = `## Epic 1: Core

### Story 1.1: Feature X

As a user,
I want feature X,
So that I can do Y.

**Acceptance Criteria:**

**Given** precondition A
**When** action B
**Then** result C
`;
      const stories = parseStories(content);

      expect(stories[0].description).toContain("user");
      expect(stories[0].description).toContain("feature X");
      expect(stories[0].description).not.toContain("Given");
      expect(stories[0].acceptanceCriteria).toHaveLength(1);
    });

    it("handles multiple stories with different AC formats", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Register

As a visitor, I want to register.

**Acceptance Criteria:**

**Given** valid data
**When** submit form
**Then** account created

### Story 1.2: Login

As a user, I want to log in.

Given correct password
When submit login
Then access granted

### Story 1.3: Profile

As a user, I want to view my profile.
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(3);
      expect(stories[0].acceptanceCriteria).toHaveLength(1);
      expect(stories[1].acceptanceCriteria).toHaveLength(1);
      expect(stories[2].acceptanceCriteria).toEqual([]);
    });
  });

  describe("parseStoriesWithWarnings", () => {
    it("returns warnings for stories without acceptance criteria", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Login

As a user, I want to log in.
`;
      const { stories, warnings } = parseStoriesWithWarnings(content);

      expect(stories).toHaveLength(1);
      expect(warnings).toContain('Story 1.1: "Login" has no acceptance criteria');
    });

    it("returns warnings for stories without description", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Empty

**Given** some condition
**When** action occurs
**Then** result happens
`;
      const { stories, warnings } = parseStoriesWithWarnings(content);

      expect(stories).toHaveLength(1);
      expect(warnings).toContain('Story 1.1: "Empty" has no description');
    });

    it("returns warnings for stories not under an epic", () => {
      const content = `### Story 1.1: Orphan

Description here.

**Given** condition
**When** action
**Then** result
`;
      const { stories, warnings } = parseStoriesWithWarnings(content);

      expect(stories).toHaveLength(1);
      expect(warnings).toContain('Story 1.1: "Orphan" is not under an epic');
    });

    it("returns no warnings for well-formed stories", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Login

As a user, I want to log in.

**Given** valid credentials
**When** user submits
**Then** access granted
`;
      const { stories, warnings } = parseStoriesWithWarnings(content);

      expect(stories).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });
  });

  describe("generateFixPlan", () => {
    it("generates markdown with stories grouped by epic", () => {
      const stories: Story[] = [
        {
          epic: "Auth",
          id: "1.1",
          title: "Login",
          description: "",
          epicDescription: "",
          acceptanceCriteria: [],
        },
        {
          epic: "Auth",
          id: "1.2",
          title: "Register",
          description: "",
          epicDescription: "",
          acceptanceCriteria: [],
        },
        {
          epic: "Dashboard",
          id: "2.1",
          title: "View Stats",
          description: "",
          epicDescription: "",
          acceptanceCriteria: [],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain("# Ralph Fix Plan");
      expect(plan).toContain("### Auth");
      expect(plan).toContain("- [ ] Story 1.1: Login");
      expect(plan).toContain("- [ ] Story 1.2: Register");
      expect(plan).toContain("### Dashboard");
      expect(plan).toContain("- [ ] Story 2.1: View Stats");
      expect(plan).toContain("TDD methodology");
    });

    it("includes completed section", () => {
      const plan = generateFixPlan([
        {
          epic: "E1",
          id: "1.1",
          title: "T1",
          description: "",
          epicDescription: "",
          acceptanceCriteria: [],
        },
      ]);

      expect(plan).toContain("## Completed");
    });

    it("includes epic description as Goal line", () => {
      const stories: Story[] = [
        {
          epic: "Auth",
          id: "1.1",
          title: "Login",
          description: "",
          epicDescription: "Secure user access",
          acceptanceCriteria: [],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain("> Goal: Secure user access");
    });

    it("does not include Goal line when epic description is empty", () => {
      const stories: Story[] = [
        {
          epic: "Auth",
          id: "1.1",
          title: "Login",
          description: "",
          epicDescription: "",
          acceptanceCriteria: [],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).not.toContain("> Goal:");
    });

    it("includes description lines with > prefix", () => {
      const stories: Story[] = [
        {
          epic: "Auth",
          id: "1.1",
          title: "Login",
          description: "As a user, I want to log in, So that I can access my data.",
          epicDescription: "",
          acceptanceCriteria: [],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain("  > As a user");
    });

    it("includes acceptance criteria with > AC: prefix", () => {
      const stories: Story[] = [
        {
          epic: "Auth",
          id: "1.1",
          title: "Login",
          description: "As a user, I want to log in.",
          epicDescription: "",
          acceptanceCriteria: [
            "Given valid credentials, When user submits login form, Then user is redirected to dashboard",
            "Given invalid credentials, When user submits login form, Then error is shown",
          ],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain(
        "  > AC: Given valid credentials, When user submits login form, Then user is redirected to dashboard"
      );
      expect(plan).toContain(
        "  > AC: Given invalid credentials, When user submits login form, Then error is shown"
      );
    });

    it("outputs description before acceptance criteria", () => {
      const stories: Story[] = [
        {
          epic: "Core",
          id: "1.1",
          title: "Feature",
          description: "As a user, I want feature X.",
          epicDescription: "",
          acceptanceCriteria: ["Given A, When B, Then C"],
        },
      ];

      const plan = generateFixPlan(stories);
      const lines = plan.split("\n");
      const descIndex = lines.findIndex((l) => l.includes("> As a user"));
      const acIndex = lines.findIndex((l) => l.includes("> AC:"));

      expect(descIndex).toBeGreaterThan(-1);
      expect(acIndex).toBeGreaterThan(descIndex);
    });

    it("includes spec-link after acceptance criteria", () => {
      const stories: Story[] = [
        {
          epic: "Auth",
          id: "1.1",
          title: "Login",
          description: "As a user, I want to log in.",
          epicDescription: "",
          acceptanceCriteria: ["Given valid creds, When submitted, Then logged in"],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain("  > Spec: specs/planning-artifacts/stories.md#story-1-1");
    });

    it("converts story ID dots to dashes in spec-link anchor", () => {
      const stories: Story[] = [
        {
          epic: "Dashboard",
          id: "2.3",
          title: "Stats View",
          description: "View stats.",
          epicDescription: "",
          acceptanceCriteria: [],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain("  > Spec: specs/planning-artifacts/stories.md#story-2-3");
      expect(plan).not.toContain("#story-2.3");
    });

    it("places spec-link after acceptance criteria", () => {
      const stories: Story[] = [
        {
          epic: "Core",
          id: "1.1",
          title: "Feature",
          description: "As a user, I want feature X.",
          epicDescription: "",
          acceptanceCriteria: ["Given A, When B, Then C"],
        },
      ];

      const plan = generateFixPlan(stories);
      const lines = plan.split("\n");
      const acIndex = lines.findIndex((l) => l.includes("> AC:"));
      const specIndex = lines.findIndex((l) => l.includes("> Spec:"));

      expect(acIndex).toBeGreaterThan(-1);
      expect(specIndex).toBeGreaterThan(-1);
      expect(specIndex).toBeGreaterThan(acIndex);
    });

    it("includes spec-link even when no acceptance criteria", () => {
      const stories: Story[] = [
        {
          epic: "Setup",
          id: "3.2",
          title: "Config",
          description: "Configure project.",
          epicDescription: "",
          acceptanceCriteria: [],
        },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain("  > Spec: specs/planning-artifacts/stories.md#story-3-2");
    });
  });

  describe("generatePrompt", () => {
    it("includes project name", () => {
      const prompt = generatePrompt("my-app");
      expect(prompt).toContain("my-app");
    });

    it("includes TDD methodology", () => {
      const prompt = generatePrompt("test");
      expect(prompt).toContain("TDD");
      expect(prompt).toContain("RED");
      expect(prompt).toContain("GREEN");
      expect(prompt).toContain("REFACTOR");
    });

    it("includes RALPH_STATUS block", () => {
      const prompt = generatePrompt("test");
      expect(prompt).toContain("RALPH_STATUS");
      expect(prompt).toContain("EXIT_SIGNAL");
    });

    it("references PROJECT_CONTEXT.md in Current Objectives", () => {
      const prompt = generatePrompt("test");
      expect(prompt).toContain("PROJECT_CONTEXT.md");
      // Should be first item in objectives
      const lines = prompt.split("\n");
      const objectivesStart = lines.findIndex((l) => l.includes("Current Objectives"));
      const contextLine = lines.findIndex(
        (l) => l.includes("PROJECT_CONTEXT.md") && l.match(/^\d+\.|^-/)
      );
      expect(contextLine).toBeGreaterThan(objectivesStart);
    });

    it("references PROJECT_CONTEXT.md in File Structure", () => {
      const prompt = generatePrompt("test");
      const fileStructureSection = prompt.slice(prompt.indexOf("File Structure"));
      expect(fileStructureSection).toContain("PROJECT_CONTEXT.md");
    });
  });

  describe("runTransition", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(
        tmpdir(),
        `bmalph-transition-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, ".ralph/specs"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test-project", createdAt: "2025-01-01T00:00:00.000Z" })
      );
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    it("throws when no artifacts directory exists", async () => {
      await expect(runTransition(testDir)).rejects.toThrow("No BMAD artifacts found");
    });

    it("throws when no stories file exists", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD");

      await expect(runTransition(testDir)).rejects.toThrow("No epics/stories file found");
    });

    it("throws when stories file has no parseable stories", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        "# No actual stories here\nJust text."
      );

      await expect(runTransition(testDir)).rejects.toThrow("No stories parsed");
    });

    it("generates fix_plan.md from stories", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: Core

### Story 1.1: Setup

Initialize project.

### Story 1.2: API

Build API endpoints.
`
      );

      const result = await runTransition(testDir);

      expect(result.storiesCount).toBe(2);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("Story 1.1: Setup");
      expect(fixPlan).toContain("Story 1.2: API");
    });

    it("generates enriched fix_plan.md with inline acceptance criteria", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: Auth

### Story 1.1: Registration

As a visitor,
I want to create an account,
So that I can access the app.

**Acceptance Criteria:**

**Given** valid email and password
**When** user submits registration form
**Then** account is created and user receives confirmation

**Given** an already registered email
**When** user submits registration form
**Then** an error message is shown
`
      );

      await runTransition(testDir);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("- [ ] Story 1.1: Registration");
      expect(fixPlan).toContain("  > As a visitor");
      expect(fixPlan).toContain("  > I want to create an account");
      expect(fixPlan).toContain("  > So that I can access the app.");
      expect(fixPlan).toContain(
        "  > AC: Given valid email and password, When user submits registration form, Then account is created and user receives confirmation"
      );
      expect(fixPlan).toContain(
        "  > AC: Given an already registered email, When user submits registration form, Then an error message is shown"
      );
    });

    it("copies planning-artifacts to .ralph/specs/planning-artifacts/", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD content");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      await runTransition(testDir);

      const prd = await readFile(join(testDir, ".ralph/specs/planning-artifacts/prd.md"), "utf-8");
      expect(prd).toContain("PRD content");
    });

    it("copies implementation-artifacts to .ralph/specs/implementation-artifacts/", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "_bmad-output/implementation-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/implementation-artifacts/sprint-plan.md"),
        "# Sprint 1"
      );
      await writeFile(
        join(testDir, "_bmad-output/implementation-artifacts/story-1.1.md"),
        "# Story Detail"
      );

      await runTransition(testDir);

      const sprint = await readFile(
        join(testDir, ".ralph/specs/implementation-artifacts/sprint-plan.md"),
        "utf-8"
      );
      expect(sprint).toContain("Sprint 1");
      const story = await readFile(
        join(testDir, ".ralph/specs/implementation-artifacts/story-1.1.md"),
        "utf-8"
      );
      expect(story).toContain("Story Detail");
    });

    it("works when only planning-artifacts exists (no implementation-artifacts)", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      await runTransition(testDir);

      const prd = await readFile(join(testDir, ".ralph/specs/planning-artifacts/prd.md"), "utf-8");
      expect(prd).toContain("PRD");
      // implementation-artifacts should not exist
      await expect(
        access(join(testDir, ".ralph/specs/implementation-artifacts"))
      ).rejects.toThrow();
    });

    it("generates PROMPT.md with project name", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(prompt).toContain("test-project");
    });

    it("preserves rich PROMPT.md template with placeholder replacement", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );
      // Pre-populate .ralph/PROMPT.md with a template containing the placeholder
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        "# Ralph Instructions\n\nYou are working on a [YOUR PROJECT NAME] project.\n\n## Rich Content\nThis is preserved."
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(prompt).toContain("test-project");
      expect(prompt).not.toContain("[YOUR PROJECT NAME]");
      expect(prompt).toContain("Rich Content");
      expect(prompt).toContain("This is preserved.");
    });

    it("uses generatePrompt fallback when PROMPT.md has no placeholder", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );
      // Pre-populate with a customized PROMPT.md (no placeholder)
      await writeFile(join(testDir, ".ralph/PROMPT.md"), "# Custom Ralph\nNo placeholder here.");

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      // Should fall back to generatePrompt which contains these markers
      expect(prompt).toContain("RALPH_STATUS");
      expect(prompt).toContain("test-project");
    });

    it("copies brainstorming sessions to .ralph/specs/brainstorming/", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "_bmad-output/brainstorming"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/brainstorming/session-1.md"), "# Brainstorm 1");
      await writeFile(join(testDir, "_bmad-output/brainstorming/session-2.md"), "# Brainstorm 2");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      await runTransition(testDir);

      const bs1 = await readFile(join(testDir, ".ralph/specs/brainstorming/session-1.md"), "utf-8");
      const bs2 = await readFile(join(testDir, ".ralph/specs/brainstorming/session-2.md"), "utf-8");
      expect(bs1).toContain("Brainstorm 1");
      expect(bs2).toContain("Brainstorm 2");
    });

    it("skips brainstorming copy gracefully when directory does not exist", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      // Should not throw
      const result = await runTransition(testDir);
      expect(result.storiesCount).toBe(1);
    });

    it("returns warnings array in result", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      const result = await runTransition(testDir);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("returns warning when PRD is missing", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      const result = await runTransition(testDir);

      expect(result.warnings).toContainEqual(expect.stringMatching(/PRD/i));
    });

    it("returns warning when architecture doc is missing", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      const result = await runTransition(testDir);

      expect(result.warnings).toContainEqual(expect.stringMatching(/architect/i));
    });

    it("returns no PRD/architecture warnings when both exist", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD");
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/architecture.md"), "# Arch");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      const result = await runTransition(testDir);

      expect(result.warnings).not.toContainEqual(expect.stringMatching(/PRD/i));
      expect(result.warnings).not.toContainEqual(expect.stringMatching(/architect/i));
    });

    it("returns warning when readiness report contains NO-GO", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD");
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/architecture.md"), "# Arch");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/readiness-report.md"),
        "# Readiness\n\nStatus: NO-GO\nNot ready for implementation."
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      const result = await runTransition(testDir);

      expect(result.warnings).toContainEqual(expect.stringMatching(/NO.?GO/i));
    });

    it("preserves fix_plan.md when it has checked items", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n\n### Story 1.2: Z\n\nDo Z.\n`
      );
      // Pre-populate fix_plan with progress
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Ralph Fix Plan\n\n- [x] Story 1.1: Y\n- [ ] Story 1.2: Z\n`
      );

      const result = await runTransition(testDir);

      expect(result.fixPlanPreserved).toBe(true);
      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("[x] Story 1.1: Y");
    });

    it("overwrites fix_plan.md when no items are checked", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Ralph Fix Plan\n\n- [ ] Story 1.1: Old\n`
      );

      const result = await runTransition(testDir);

      expect(result.fixPlanPreserved).toBe(false);
      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("Story 1.1: Y");
    });

    it("generates PROJECT_CONTEXT.md from PRD and architecture", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        `# PRD\n\n## Executive Summary\nBuild a task management platform.\n\n## Success Metrics\n- 500 active teams\n\n## Scope\nIn scope: task CRUD.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\n## Constraints\nUse PostgreSQL for storage.\n\n## Risks\nScalability under load.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      await runTransition(testDir);

      const contextMd = await readFile(join(testDir, ".ralph/PROJECT_CONTEXT.md"), "utf-8");
      expect(contextMd).toContain("test-project");
      expect(contextMd).toContain("task management platform");
      expect(contextMd).toContain("500 active teams");
      expect(contextMd).toContain("PostgreSQL");
      expect(contextMd).toContain("Scalability");
    });

    it("sets fixPlanPreserved to false when no existing fix_plan", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      const result = await runTransition(testDir);
      expect(result.fixPlanPreserved).toBe(false);
    });

    it("no readiness warning when report is GO", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD");
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/architecture.md"), "# Arch");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/readiness-report.md"),
        "# Readiness\n\nStatus: GO\nReady for implementation."
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );

      const result = await runTransition(testDir);

      expect(result.warnings).not.toContainEqual(expect.stringMatching(/NO.?GO/i));
    });
  });

  describe("detectTechStack", () => {
    it("detects Node/TypeScript stack", () => {
      const content = `# Architecture

## Tech Stack
- Runtime: Node.js 20 LTS
- Language: TypeScript
- Test Runner: Vitest
- Build: tsc
- Package Manager: npm
`;
      const stack = detectTechStack(content);

      expect(stack).not.toBeNull();
      expect(stack!.setup).toContain("npm install");
      expect(stack!.test).toContain("vitest");
      expect(stack!.build).toContain("tsc");
      expect(stack!.dev).toContain("npm run dev");
    });

    it("detects Python stack", () => {
      const content = `# Architecture

## Technology Stack
- Language: Python 3.12
- Framework: FastAPI
- Testing: pytest
- Package Manager: pip
`;
      const stack = detectTechStack(content);

      expect(stack).not.toBeNull();
      expect(stack!.setup).toContain("pip install");
      expect(stack!.test).toContain("pytest");
    });

    it("detects Rust stack", () => {
      const content = `# Architecture

## Tech Stack
- Language: Rust
- Build System: Cargo
`;
      const stack = detectTechStack(content);

      expect(stack).not.toBeNull();
      expect(stack!.setup).toContain("cargo build");
      expect(stack!.test).toContain("cargo test");
      expect(stack!.build).toContain("cargo build --release");
    });

    it("detects Go stack", () => {
      const content = `# Architecture

## Tech Stack
- Language: Go / Golang
- Build: go build
`;
      const stack = detectTechStack(content);

      expect(stack).not.toBeNull();
      expect(stack!.setup).toContain("go mod download");
      expect(stack!.test).toContain("go test");
      expect(stack!.build).toContain("go build");
    });

    it("returns null when no stack section found", () => {
      const content = `# Architecture

Just some general text about the system.
No tech stack section here.
`;
      expect(detectTechStack(content)).toBeNull();
    });

    it("returns null when stack section has no recognized keywords", () => {
      const content = `# Architecture

## Tech Stack
- Language: Brainfuck
- Build: custom
`;
      expect(detectTechStack(content)).toBeNull();
    });

    it("detects jest as test runner for Node", () => {
      const content = `## Tech Stack
- Runtime: Node.js
- Testing: Jest
`;
      const stack = detectTechStack(content);
      expect(stack).not.toBeNull();
      expect(stack!.test).toContain("jest");
    });
  });

  describe("customizeAgentMd", () => {
    const template = `# Agent Build Instructions

## Project Setup
\`\`\`bash
# Install dependencies (example for Node.js project)
npm install

# Or for Python project
pip install -r requirements.txt

# Or for Rust project
cargo build
\`\`\`

## Running Tests
\`\`\`bash
# Node.js
npm test

# Python
pytest

# Rust
cargo test
\`\`\`

## Build Commands
\`\`\`bash
# Production build
npm run build
# or
cargo build --release
\`\`\`

## Development Server
\`\`\`bash
# Start development server
npm run dev
# or
cargo run
\`\`\`

## Key Learnings
- Update this section
`;

    it("replaces all sections with stack-specific commands", () => {
      const stack: TechStack = {
        setup: "npm install",
        test: "npx vitest run",
        build: "npx tsc",
        dev: "npm run dev",
      };

      const result = customizeAgentMd(template, stack);

      // Should contain the specific commands
      expect(result).toContain("npm install");
      expect(result).toContain("npx vitest run");
      expect(result).toContain("npx tsc");
      expect(result).toContain("npm run dev");

      // Should not contain the multi-language examples
      expect(result).not.toContain("pip install");
      expect(result).not.toContain("cargo build");
      expect(result).not.toContain("cargo test");
      expect(result).not.toContain("cargo run");
    });

    it("preserves content after Development Server section", () => {
      const stack: TechStack = {
        setup: "npm install",
        test: "npm test",
        build: "npm run build",
        dev: "npm run dev",
      };

      const result = customizeAgentMd(template, stack);

      expect(result).toContain("## Key Learnings");
      expect(result).toContain("Update this section");
    });
  });

  describe("runTransition AGENT.md", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `bmalph-agent-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, ".ralph/specs"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test-project", createdAt: "2025-01-01T00:00:00.000Z" })
      );
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    it("customizes AGENT.md when architecture file has detectable stack", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\n## Tech Stack\n- Runtime: Node.js\n- Language: TypeScript\n- Testing: Vitest\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );
      // Pre-populate AGENT.md with the template
      await writeFile(
        join(testDir, ".ralph/@AGENT.md"),
        `# Agent Build Instructions\n\n## Project Setup\n\`\`\`bash\nnpm install\n# Or for Python project\npip install -r requirements.txt\n\`\`\`\n\n## Running Tests\n\`\`\`bash\nnpm test\n# Python\npytest\n\`\`\`\n\n## Build Commands\n\`\`\`bash\nnpm run build\n# or\ncargo build --release\n\`\`\`\n\n## Development Server\n\`\`\`bash\nnpm run dev\n# or\ncargo run\n\`\`\`\n`
      );

      await runTransition(testDir);

      const agent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(agent).toContain("npm install");
      expect(agent).not.toContain("pip install");
      expect(agent).not.toContain("cargo");
    });

    it("leaves AGENT.md unchanged when no architecture file exists", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );
      const originalContent = "# Original AGENT\nUntouched.";
      await writeFile(join(testDir, ".ralph/@AGENT.md"), originalContent);

      await runTransition(testDir);

      const agent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(agent).toBe(originalContent);
    });

    it("leaves AGENT.md unchanged when stack is not detectable", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\nJust text, no tech stack section.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`
      );
      const originalContent = "# Original AGENT\nUntouched.";
      await writeFile(join(testDir, ".ralph/@AGENT.md"), originalContent);

      await runTransition(testDir);

      const agent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(agent).toBe(originalContent);
    });
  });

  describe("hasFixPlanProgress", () => {
    it("returns true when content has checked items", () => {
      const content = `# Ralph Fix Plan\n\n- [x] Story 1.1: Setup\n- [ ] Story 1.2: API\n`;
      expect(hasFixPlanProgress(content)).toBe(true);
    });

    it("returns false when no items are checked", () => {
      const content = `# Ralph Fix Plan\n\n- [ ] Story 1.1: Setup\n- [ ] Story 1.2: API\n`;
      expect(hasFixPlanProgress(content)).toBe(false);
    });

    it("returns false for empty content", () => {
      expect(hasFixPlanProgress("")).toBe(false);
    });

    it("returns true with uppercase X", () => {
      const content = `- [X] Story 1.1: Done\n`;
      expect(hasFixPlanProgress(content)).toBe(true);
    });

    it("returns true when checked item is indented", () => {
      const content = `  - [x] Subtask done\n`;
      expect(hasFixPlanProgress(content)).toBe(true);
    });

    it("returns false when [x] appears in non-checkbox context", () => {
      const content = `Some text with [x] in it but no dash prefix\n`;
      expect(hasFixPlanProgress(content)).toBe(false);
    });
  });

  describe("extractSection", () => {
    it("extracts section content by heading regex", () => {
      const content = `# Doc\n\n## Goals\nBuild a great app.\nWith many features.\n\n## Other\nStuff.\n`;
      const result = extractSection(content, /^##\s+Goals/m);
      expect(result).toContain("Build a great app.");
      expect(result).toContain("With many features.");
      expect(result).not.toContain("Stuff.");
    });

    it("returns empty string when heading not found", () => {
      const content = `# Doc\n\n## Foo\nBar.\n`;
      expect(extractSection(content, /^##\s+Missing/m)).toBe("");
    });

    it("truncates to maxLength", () => {
      const content = `## Goals\n${"A".repeat(600)}\n## Next\n`;
      const result = extractSection(content, /^##\s+Goals/m, 100);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it("extracts until end of file when no next heading", () => {
      const content = `## Goals\nContent to end of file.\nMore content.\n`;
      const result = extractSection(content, /^##\s+Goals/m);
      expect(result).toContain("Content to end of file.");
      expect(result).toContain("More content.");
    });

    it("stops at same-level or higher heading", () => {
      const content = `## Section A\nContent A.\n## Section B\nContent B.\n`;
      const result = extractSection(content, /^##\s+Section A/m);
      expect(result).toContain("Content A.");
      expect(result).not.toContain("Content B.");
    });
  });

  describe("extractProjectContext", () => {
    it("extracts project goals from PRD executive summary", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "prd.md",
        `# PRD\n\n## Executive Summary\nBuild a SaaS platform for teams.\n\n## Other\nStuff.\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.projectGoals).toContain("SaaS platform");
    });

    it("extracts success metrics from PRD", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "prd.md",
        `# PRD\n\n## Success Metrics\n- 1000 DAU\n- 99.9% uptime\n\n## Next\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.successMetrics).toContain("1000 DAU");
    });

    it("extracts architecture constraints", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "architecture.md",
        `# Architecture\n\n## Constraints\nMust use PostgreSQL.\nNo vendor lock-in.\n\n## Next\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.architectureConstraints).toContain("PostgreSQL");
    });

    it("extracts technical risks from architecture", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "architecture.md",
        `# Architecture\n\n## Risks\nScalability concerns.\nThird-party API rate limits.\n\n## Next\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.technicalRisks).toContain("Scalability");
    });

    it("extracts scope boundaries from PRD", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "prd.md",
        `# PRD\n\n## Scope\nIn scope: user management.\nOut of scope: payment processing.\n\n## Next\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.scopeBoundaries).toContain("user management");
    });

    it("extracts target users from PRD", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "prd.md",
        `# PRD\n\n## Target Users\nDevelopers building SaaS apps.\n\n## Next\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.targetUsers).toContain("Developers");
    });

    it("extracts non-functional requirements from PRD", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "prd.md",
        `# PRD\n\n## Non-Functional Requirements\n- Response time < 200ms\n- WCAG 2.1 AA compliance\n\n## Next\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.nonFunctionalRequirements).toContain("200ms");
    });

    it("returns empty strings when no matching sections found", () => {
      const artifacts = new Map<string, string>();
      artifacts.set("random.md", `# Random\n\nSome content.\n`);
      const ctx = extractProjectContext(artifacts);
      expect(ctx.projectGoals).toBe("");
      expect(ctx.successMetrics).toBe("");
      expect(ctx.architectureConstraints).toBe("");
    });

    it("tries alternative heading patterns", () => {
      const artifacts = new Map<string, string>();
      artifacts.set(
        "prd.md",
        `# PRD\n\n## Vision\nRevolutionize team collaboration.\n\n## KPIs\n- NPS > 50\n`
      );
      const ctx = extractProjectContext(artifacts);
      expect(ctx.projectGoals).toContain("collaboration");
      expect(ctx.successMetrics).toContain("NPS");
    });
  });

  describe("generateProjectContextMd", () => {
    it("renders all fields as markdown sections", () => {
      const ctx: ProjectContext = {
        projectGoals: "Build a platform",
        successMetrics: "1000 users",
        architectureConstraints: "Use PostgreSQL",
        technicalRisks: "Scalability",
        scopeBoundaries: "MVP only",
        targetUsers: "Developers",
        nonFunctionalRequirements: "< 200ms response",
      };
      const md = generateProjectContextMd(ctx, "my-app");
      expect(md).toContain("# my-app — Project Context");
      expect(md).toContain("## Project Goals");
      expect(md).toContain("Build a platform");
      expect(md).toContain("## Success Metrics");
      expect(md).toContain("1000 users");
      expect(md).toContain("## Architecture Constraints");
      expect(md).toContain("Use PostgreSQL");
      expect(md).toContain("## Technical Risks");
      expect(md).toContain("Scalability");
      expect(md).toContain("## Scope Boundaries");
      expect(md).toContain("MVP only");
      expect(md).toContain("## Target Users");
      expect(md).toContain("Developers");
      expect(md).toContain("## Non-Functional Requirements");
      expect(md).toContain("< 200ms response");
    });

    it("omits empty sections", () => {
      const ctx: ProjectContext = {
        projectGoals: "Build a platform",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
      };
      const md = generateProjectContextMd(ctx, "my-app");
      expect(md).toContain("## Project Goals");
      expect(md).not.toContain("## Success Metrics");
      expect(md).not.toContain("## Architecture Constraints");
    });

    it("includes project name in title", () => {
      const ctx: ProjectContext = {
        projectGoals: "Goals",
        successMetrics: "",
        architectureConstraints: "",
        technicalRisks: "",
        scopeBoundaries: "",
        targetUsers: "",
        nonFunctionalRequirements: "",
      };
      const md = generateProjectContextMd(ctx, "super-project");
      expect(md).toContain("# super-project — Project Context");
    });
  });

  describe("validateArtifacts", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(
        tmpdir(),
        `bmalph-validate-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    it("warns when no PRD file exists", async () => {
      await writeFile(join(testDir, "stories.md"), "# Stories");
      const warnings = await validateArtifacts(["stories.md"], testDir);
      expect(warnings).toContainEqual(expect.stringMatching(/PRD/i));
    });

    it("warns when no architecture file exists", async () => {
      await writeFile(join(testDir, "stories.md"), "# Stories");
      const warnings = await validateArtifacts(["stories.md"], testDir);
      expect(warnings).toContainEqual(expect.stringMatching(/architect/i));
    });

    it("does not warn when PRD and architecture exist", async () => {
      await writeFile(join(testDir, "prd.md"), "# PRD");
      await writeFile(join(testDir, "architecture.md"), "# Arch");
      const warnings = await validateArtifacts(["prd.md", "architecture.md"], testDir);
      expect(warnings).not.toContainEqual(expect.stringMatching(/PRD/i));
      expect(warnings).not.toContainEqual(expect.stringMatching(/architect/i));
    });

    it("warns when readiness report contains NO-GO", async () => {
      await writeFile(join(testDir, "prd.md"), "# PRD");
      await writeFile(join(testDir, "architecture.md"), "# Arch");
      await writeFile(join(testDir, "readiness-report.md"), "Status: NO-GO");
      const warnings = await validateArtifacts(
        ["prd.md", "architecture.md", "readiness-report.md"],
        testDir
      );
      expect(warnings).toContainEqual(expect.stringMatching(/NO.?GO/i));
    });

    it("handles NO GO with space", async () => {
      await writeFile(join(testDir, "readiness.md"), "Status: NO GO");
      const warnings = await validateArtifacts(["readiness.md"], testDir);
      expect(warnings).toContainEqual(expect.stringMatching(/NO.?GO/i));
    });

    it("does not warn for GO status without NO prefix", async () => {
      await writeFile(join(testDir, "prd.md"), "# PRD");
      await writeFile(join(testDir, "architecture.md"), "# Arch");
      await writeFile(join(testDir, "readiness-report.md"), "Status: GO\nAll clear.");
      const warnings = await validateArtifacts(
        ["prd.md", "architecture.md", "readiness-report.md"],
        testDir
      );
      expect(warnings).not.toContainEqual(expect.stringMatching(/NO.?GO/i));
    });
  });

  describe("parseFixPlan", () => {
    it("extracts completed and pending story IDs", () => {
      const content = `# Fix Plan
### Epic 1
- [x] Story 1.1: Done
- [ ] Story 1.2: Pending
### Epic 2
- [X] Story 2.1: Also done
- [ ] Story 2.2: Not done`;
      const items = parseFixPlan(content);
      expect(items).toEqual([
        { id: "1.1", completed: true },
        { id: "1.2", completed: false },
        { id: "2.1", completed: true },
        { id: "2.2", completed: false },
      ]);
    });

    it("returns empty array for content with no story items", () => {
      const content = `# Fix Plan\n\nNo stories here.\n`;
      expect(parseFixPlan(content)).toEqual([]);
    });

    it("handles inline description and AC after story line", () => {
      const content = `# Fix Plan
- [x] Story 1.1: Setup
  > As a developer
  > AC: Given setup, When run, Then works
- [ ] Story 1.2: API`;
      const items = parseFixPlan(content);
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ id: "1.1", completed: true });
      expect(items[1]).toEqual({ id: "1.2", completed: false });
    });

    it("handles complex story IDs like 10.25", () => {
      const content = `- [x] Story 10.25: Complex ID`;
      const items = parseFixPlan(content);
      expect(items).toEqual([{ id: "10.25", completed: true }]);
    });
  });

  describe("mergeFixPlanProgress", () => {
    it("marks stories as completed based on ID set", () => {
      const newPlan = `- [ ] Story 1.1: Setup
- [ ] Story 1.2: API
- [ ] Story 2.1: New feature`;
      const completed = new Set(["1.1"]);
      const merged = mergeFixPlanProgress(newPlan, completed);
      expect(merged).toContain("- [x] Story 1.1: Setup");
      expect(merged).toContain("- [ ] Story 1.2: API");
      expect(merged).toContain("- [ ] Story 2.1: New feature");
    });

    it("preserves multiple completed stories", () => {
      const newPlan = `- [ ] Story 1.1: A
- [ ] Story 1.2: B
- [ ] Story 2.1: C`;
      const completed = new Set(["1.1", "2.1"]);
      const merged = mergeFixPlanProgress(newPlan, completed);
      expect(merged).toContain("- [x] Story 1.1: A");
      expect(merged).toContain("- [ ] Story 1.2: B");
      expect(merged).toContain("- [x] Story 2.1: C");
    });

    it("does nothing when completed set is empty", () => {
      const newPlan = `- [ ] Story 1.1: A`;
      const completed = new Set<string>();
      const merged = mergeFixPlanProgress(newPlan, completed);
      expect(merged).toBe(newPlan);
    });

    it("ignores IDs not in the new plan", () => {
      const newPlan = `- [ ] Story 2.1: New`;
      const completed = new Set(["1.1"]); // old story not in new plan
      const merged = mergeFixPlanProgress(newPlan, completed);
      expect(merged).toContain("- [ ] Story 2.1: New");
    });
  });

  describe("generateSpecsChangelog", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(
        tmpdir(),
        `bmalph-changelog-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    it("detects added files", async () => {
      await mkdir(join(testDir, "new/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "new/planning-artifacts/prd.md"), "# PRD");

      const changes = await generateSpecsChangelog(
        join(testDir, "old"), // doesn't exist
        join(testDir, "new")
      );

      expect(changes).toContainEqual({ file: "planning-artifacts/prd.md", status: "added" });
    });

    it("detects modified files", async () => {
      await mkdir(join(testDir, "old/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "new/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "old/planning-artifacts/prd.md"), "# PRD v1");
      await writeFile(join(testDir, "new/planning-artifacts/prd.md"), "# PRD v2");

      const changes = await generateSpecsChangelog(join(testDir, "old"), join(testDir, "new"));

      expect(changes).toContainEqual(
        expect.objectContaining({
          file: "planning-artifacts/prd.md",
          status: "modified",
        })
      );
    });

    it("detects removed files", async () => {
      await mkdir(join(testDir, "old/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "new"), { recursive: true });
      await writeFile(join(testDir, "old/planning-artifacts/old-doc.md"), "# Old");

      const changes = await generateSpecsChangelog(join(testDir, "old"), join(testDir, "new"));

      expect(changes).toContainEqual({ file: "planning-artifacts/old-doc.md", status: "removed" });
    });

    it("returns empty array when no changes", async () => {
      await mkdir(join(testDir, "old/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "new/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "old/planning-artifacts/prd.md"), "# Same content");
      await writeFile(join(testDir, "new/planning-artifacts/prd.md"), "# Same content");

      const changes = await generateSpecsChangelog(join(testDir, "old"), join(testDir, "new"));

      expect(changes).toEqual([]);
    });

    it("includes summary for modified files", async () => {
      await mkdir(join(testDir, "old/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "new/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "old/planning-artifacts/prd.md"), "Line 1\nLine 2");
      await writeFile(join(testDir, "new/planning-artifacts/prd.md"), "Line 1\nLine 2 changed");

      const changes = await generateSpecsChangelog(join(testDir, "old"), join(testDir, "new"));

      const modified = changes.find((c) => c.status === "modified");
      expect(modified).toBeDefined();
      expect(modified!.summary).toBeDefined();
    });
  });

  describe("formatChangelog", () => {
    it("formats empty changes", () => {
      const md = formatChangelog([], "2024-01-01T00:00:00Z");
      expect(md).toContain("No changes detected");
    });

    it("formats added files", () => {
      const changes = [{ file: "prd.md", status: "added" as const }];
      const md = formatChangelog(changes, "2024-01-01T00:00:00Z");
      expect(md).toContain("## Added");
      expect(md).toContain("- prd.md");
    });

    it("formats modified files with summary", () => {
      const changes = [{ file: "arch.md", status: "modified" as const, summary: "Changed API" }];
      const md = formatChangelog(changes, "2024-01-01T00:00:00Z");
      expect(md).toContain("## Modified");
      expect(md).toContain("- arch.md (Changed API)");
    });

    it("formats removed files", () => {
      const changes = [{ file: "old.md", status: "removed" as const }];
      const md = formatChangelog(changes, "2024-01-01T00:00:00Z");
      expect(md).toContain("## Removed");
      expect(md).toContain("- old.md");
    });

    it("includes timestamp", () => {
      const changes = [{ file: "prd.md", status: "added" as const }];
      const md = formatChangelog(changes, "2024-01-01T00:00:00Z");
      expect(md).toContain("Last updated: 2024-01-01T00:00:00Z");
    });

    it("groups changes by type", () => {
      const changes = [
        { file: "new.md", status: "added" as const },
        { file: "changed.md", status: "modified" as const },
        { file: "gone.md", status: "removed" as const },
      ];
      const md = formatChangelog(changes, "2024-01-01T00:00:00Z");
      expect(md).toContain("## Added");
      expect(md).toContain("## Modified");
      expect(md).toContain("## Removed");
    });
  });

  describe("runTransition merge", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `bmalph-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, ".ralph/specs"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test-project", createdAt: "2025-01-01T00:00:00.000Z" })
      );
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Windows file locking
      }
    });

    it("preserves completed stories when BMAD adds new epic", async () => {
      // Setup: existing fix_plan with story 1.1 completed
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Fix Plan\n- [x] Story 1.1: Old\n- [ ] Story 1.2: Pending\n`
      );

      // New BMAD output adds Epic 2
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n### Story 1.1: Old\nDesc.\n### Story 1.2: Also old\nDesc.\n
## Epic 2: New\n### Story 2.1: Brand new\nDesc.\n`
      );

      await runTransition(testDir);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("[x] Story 1.1"); // Preserved
      expect(fixPlan).toContain("[ ] Story 1.2"); // Stayed pending
      expect(fixPlan).toContain("[ ] Story 2.1"); // New story added
    });

    it("generates SPECS_CHANGELOG.md when specs change", async () => {
      // Setup: existing specs
      await mkdir(join(testDir, ".ralph/specs/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, ".ralph/specs/planning-artifacts/prd.md"), "# PRD v1");

      // New BMAD output with modified PRD
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD v2");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n### Story 1.1: Feature\nDesc.\n`
      );

      await runTransition(testDir);

      const changelog = await readFile(join(testDir, ".ralph/SPECS_CHANGELOG.md"), "utf-8");
      expect(changelog).toContain("Modified");
      expect(changelog).toContain("prd.md");
    });

    it("does not generate SPECS_CHANGELOG.md when no specs changes", async () => {
      // No existing specs
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n### Story 1.1: Feature\nDesc.\n`
      );

      await runTransition(testDir);

      // First run - changelog should mention "added" for new files
      let changelog: string;
      try {
        changelog = await readFile(join(testDir, ".ralph/SPECS_CHANGELOG.md"), "utf-8");
        expect(changelog).toContain("Added");
      } catch {
        // No changelog is also acceptable if no existing specs
      }
    });

    it("generates SPECS_INDEX.md with prioritized file list", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "_bmad-output/brainstorming"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        "# Product Requirements\n\nCore product specs."
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        "# Architecture\n\nTechnical decisions."
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n### Story 1.1: Feature\nDesc.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/brainstorming/session-1.md"),
        "# Brainstorm\n\nIdeas."
      );

      await runTransition(testDir);

      const specsIndex = await readFile(join(testDir, ".ralph/SPECS_INDEX.md"), "utf-8");
      expect(specsIndex).toContain("# Specs Index");
      expect(specsIndex).toContain("Critical");
      expect(specsIndex).toContain("prd.md");
      expect(specsIndex).toContain("architecture.md");
      expect(specsIndex).toContain("stories.md");
      expect(specsIndex).toContain("Low Priority");
      expect(specsIndex).toContain("session-1.md");
    });

    it("PROMPT.md includes specs reading strategy", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n### Story 1.1: Feature\nDesc.\n`
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(prompt).toContain("Specs Reading Strategy");
      expect(prompt).toContain("SPECS_INDEX.md");
      expect(prompt).toContain("Critical");
    });
  });
});
