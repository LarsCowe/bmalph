import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseStories, generateFixPlan, generatePrompt, runTransition, type Story } from "../src/transition.js";

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
        acceptanceCriteria: [],
      });
      expect(stories[1]).toEqual({
        epic: "User Authentication",
        id: "1.2",
        title: "User Login",
        description: expect.stringContaining("registered user"),
        acceptanceCriteria: [],
      });
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
        { epic: "Auth", id: "1.1", title: "Login", description: "", acceptanceCriteria: [] },
        { epic: "Auth", id: "1.2", title: "Register", description: "", acceptanceCriteria: [] },
        { epic: "Dashboard", id: "2.1", title: "View Stats", description: "", acceptanceCriteria: [] },
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
        { epic: "E1", id: "1.1", title: "T1", description: "", acceptanceCriteria: [] },
      ]);

      expect(plan).toContain("## Completed");
    });

    it("includes description lines with > prefix", () => {
      const stories: Story[] = [
        {
          epic: "Auth",
          id: "1.1",
          title: "Login",
          description: "As a user, I want to log in, So that I can access my data.",
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
  });
});
