import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseStories, generateFixPlan, generatePrompt, runTransition } from "../src/transition.js";

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
      });
      expect(stories[1]).toEqual({
        epic: "User Authentication",
        id: "1.2",
        title: "User Login",
        description: expect.stringContaining("registered user"),
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
    });
  });

  describe("generateFixPlan", () => {
    it("generates markdown with stories grouped by epic", () => {
      const stories = [
        { epic: "Auth", id: "1.1", title: "Login", description: "" },
        { epic: "Auth", id: "1.2", title: "Register", description: "" },
        { epic: "Dashboard", id: "2.1", title: "View Stats", description: "" },
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
        { epic: "E1", id: "1.1", title: "T1", description: "" },
      ]);

      expect(plan).toContain("## Completed");
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
