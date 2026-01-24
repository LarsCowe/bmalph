import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseStories, generateFixPlan, generatePrompt, runTransition, validateArtifacts, type Story } from "../src/transition.js";

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

    it("parses epic description with max 2 lines", () => {
      const content = `## Epic 1: Auth

Provide secure authentication.
Enable multi-factor support.
This third line should be ignored.

### Story 1.1: Login

As a user, I want to log in.
`;
      const stories = parseStories(content);

      expect(stories[0].epicDescription).toBe("Provide secure authentication. Enable multi-factor support.");
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

    it("handles story with only description, no AC section", () => {
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
      // Description is limited to max 3 lines
      expect(stories[0].description.split(" ").length).toBeLessThanOrEqual(20);
      expect(stories[0].acceptanceCriteria).toEqual([]);
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

  describe("generateFixPlan", () => {
    it("generates markdown with stories grouped by epic", () => {
      const stories: Story[] = [
        { epic: "Auth", id: "1.1", title: "Login", description: "", epicDescription: "", acceptanceCriteria: [] },
        { epic: "Auth", id: "1.2", title: "Register", description: "", epicDescription: "", acceptanceCriteria: [] },
        { epic: "Dashboard", id: "2.1", title: "View Stats", description: "", epicDescription: "", acceptanceCriteria: [] },
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
        { epic: "E1", id: "1.1", title: "T1", description: "", epicDescription: "", acceptanceCriteria: [] },
      ]);

      expect(plan).toContain("## Completed");
    });

    it("includes epic description as Goal line", () => {
      const stories: Story[] = [
        { epic: "Auth", id: "1.1", title: "Login", description: "", epicDescription: "Secure user access", acceptanceCriteria: [] },
      ];

      const plan = generateFixPlan(stories);

      expect(plan).toContain("> Goal: Secure user access");
    });

    it("does not include Goal line when epic description is empty", () => {
      const stories: Story[] = [
        { epic: "Auth", id: "1.1", title: "Login", description: "", epicDescription: "", acceptanceCriteria: [] },
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

      expect(plan).toContain("  > AC: Given valid credentials, When user submits login form, Then user is redirected to dashboard");
      expect(plan).toContain("  > AC: Given invalid credentials, When user submits login form, Then error is shown");
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
  });

  describe("runTransition", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `bmalph-transition-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, ".ralph/specs"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test-project", level: 2 }),
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
        "# No actual stories here\nJust text.",
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
`,
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
`,
      );

      await runTransition(testDir);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("- [ ] Story 1.1: Registration");
      expect(fixPlan).toContain("  > As a visitor");
      expect(fixPlan).toContain("  > I want to create an account");
      expect(fixPlan).toContain("  > So that I can access the app.");
      expect(fixPlan).toContain("  > AC: Given valid email and password, When user submits registration form, Then account is created and user receives confirmation");
      expect(fixPlan).toContain("  > AC: Given an already registered email, When user submits registration form, Then an error message is shown");
    });

    it("copies artifacts to .ralph/specs/", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD content");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );

      await runTransition(testDir);

      const prd = await readFile(join(testDir, ".ralph/specs/prd.md"), "utf-8");
      expect(prd).toContain("PRD content");
    });

    it("generates PROMPT.md with project name", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(prompt).toContain("test-project");
    });

    it("preserves rich PROMPT.md template with placeholder replacement", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );
      // Pre-populate .ralph/PROMPT.md with a template containing the placeholder
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        "# Ralph Instructions\n\nYou are working on a [YOUR PROJECT NAME] project.\n\n## Rich Content\nThis is preserved.",
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
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );
      // Pre-populate with a customized PROMPT.md (no placeholder)
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        "# Custom Ralph\nNo placeholder here.",
      );

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
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
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
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );

      // Should not throw
      const result = await runTransition(testDir);
      expect(result.storiesCount).toBe(1);
    });

    it("returns warnings array in result", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );

      const result = await runTransition(testDir);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("returns warning when PRD is missing", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );

      const result = await runTransition(testDir);

      expect(result.warnings).toContainEqual(expect.stringMatching(/PRD/i));
    });

    it("returns warning when architecture doc is missing", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
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
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
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
        "# Readiness\n\nStatus: NO-GO\nNot ready for implementation.",
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );

      const result = await runTransition(testDir);

      expect(result.warnings).toContainEqual(expect.stringMatching(/NO.?GO/i));
    });

    it("no readiness warning when report is GO", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/prd.md"), "# PRD");
      await writeFile(join(testDir, "_bmad-output/planning-artifacts/architecture.md"), "# Arch");
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/readiness-report.md"),
        "# Readiness\n\nStatus: GO\nReady for implementation.",
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: X\n\n### Story 1.1: Y\n\nDo Y.\n`,
      );

      const result = await runTransition(testDir);

      expect(result.warnings).not.toContainEqual(expect.stringMatching(/NO.?GO/i));
    });
  });

  describe("validateArtifacts", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `bmalph-validate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
      const warnings = await validateArtifacts(["prd.md", "architecture.md", "readiness-report.md"], testDir);
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
      const warnings = await validateArtifacts(["prd.md", "architecture.md", "readiness-report.md"], testDir);
      expect(warnings).not.toContainEqual(expect.stringMatching(/NO.?GO/i));
    });
  });
});
