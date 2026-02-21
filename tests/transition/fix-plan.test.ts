import { describe, it, expect } from "vitest";
import {
  generateFixPlan,
  hasFixPlanProgress,
  parseFixPlan,
  detectOrphanedCompletedStories,
  detectRenumberedStories,
  mergeFixPlanProgress,
} from "../../src/transition/fix-plan.js";
import type { Story, FixPlanItemWithTitle } from "../../src/transition/types.js";

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    epic: "Auth",
    epicDescription: "Authentication features",
    id: "1.1",
    title: "Login form",
    description: "As a user, I want to log in.",
    acceptanceCriteria: ["Given valid creds, When submit, Then logged in"],
    ...overrides,
  };
}

describe("fix-plan", () => {
  describe("generateFixPlan", () => {
    it("generates markdown with story checkboxes", () => {
      const stories = [makeStory()];
      const plan = generateFixPlan(stories);

      expect(plan).toContain("# Ralph Fix Plan");
      expect(plan).toContain("- [ ] Story 1.1: Login form");
    });

    it("groups stories under epic headings", () => {
      const stories = [
        makeStory({ id: "1.1", title: "Login" }),
        makeStory({ id: "1.2", title: "Logout" }),
        makeStory({ id: "2.1", title: "Dashboard", epic: "UI", epicDescription: "UI features" }),
      ];
      const plan = generateFixPlan(stories);

      expect(plan).toContain("### Auth");
      expect(plan).toContain("### UI");
      expect(plan).toContain("- [ ] Story 1.1: Login");
      expect(plan).toContain("- [ ] Story 2.1: Dashboard");
    });

    it("includes epic goal description", () => {
      const stories = [makeStory({ epicDescription: "Secure user authentication" })];
      const plan = generateFixPlan(stories);

      expect(plan).toContain("> Goal: Secure user authentication");
    });

    it("includes acceptance criteria", () => {
      const stories = [makeStory({ acceptanceCriteria: ["Given X, When Y, Then Z"] })];
      const plan = generateFixPlan(stories);

      expect(plan).toContain("> AC: Given X, When Y, Then Z");
    });

    it("includes spec link with anchor", () => {
      const stories = [makeStory({ id: "2.3" })];
      const plan = generateFixPlan(stories);

      expect(plan).toContain("Spec: specs/planning-artifacts/stories.md#story-2-3");
    });

    it("uses custom stories filename in spec links", () => {
      const stories = [makeStory({ id: "2.3" })];
      const plan = generateFixPlan(stories, "epics-and-stories.md");

      expect(plan).toContain("Spec: specs/planning-artifacts/epics-and-stories.md#story-2-3");
      expect(plan).not.toContain("planning-artifacts/stories.md#story");
    });

    it("defaults to stories.md when no filename provided", () => {
      const stories = [makeStory({ id: "1.1" })];
      const plan = generateFixPlan(stories);

      expect(plan).toContain("Spec: specs/planning-artifacts/stories.md#story-1-1");
    });

    it("uses custom filename for all stories in plan", () => {
      const stories = [
        makeStory({ id: "1.1", title: "Login" }),
        makeStory({ id: "1.2", title: "Logout" }),
      ];
      const plan = generateFixPlan(stories, "epics-and-stories.md");

      expect(plan).toContain("specs/planning-artifacts/epics-and-stories.md#story-1-1");
      expect(plan).toContain("specs/planning-artifacts/epics-and-stories.md#story-1-2");
    });

    it("returns plan with standard sections for empty input", () => {
      const plan = generateFixPlan([]);

      expect(plan).toContain("# Ralph Fix Plan");
      expect(plan).toContain("## Completed");
      expect(plan).toContain("## Notes");
    });
  });

  describe("hasFixPlanProgress", () => {
    it("returns true when completed items exist", () => {
      const content = "- [x] Story 1.1: Login\n- [ ] Story 1.2: Logout";
      expect(hasFixPlanProgress(content)).toBe(true);
    });

    it("returns false when no completed items", () => {
      const content = "- [ ] Story 1.1: Login\n- [ ] Story 1.2: Logout";
      expect(hasFixPlanProgress(content)).toBe(false);
    });

    it("returns false for empty input", () => {
      expect(hasFixPlanProgress("")).toBe(false);
    });

    it("handles uppercase X", () => {
      const content = "- [X] Story 1.1: Login";
      expect(hasFixPlanProgress(content)).toBe(true);
    });
  });

  describe("parseFixPlan", () => {
    it("parses uncompleted and completed items", () => {
      const content = `- [x] Story 1.1: Login form
- [ ] Story 1.2: Logout
- [x] Story 2.1: Dashboard`;

      const items = parseFixPlan(content);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ id: "1.1", completed: true, title: "Login form" });
      expect(items[1]).toEqual({ id: "1.2", completed: false, title: "Logout" });
      expect(items[2]).toEqual({ id: "2.1", completed: true, title: "Dashboard" });
    });

    it("returns empty array for empty input", () => {
      expect(parseFixPlan("")).toEqual([]);
    });

    it("returns empty array for content without story items", () => {
      expect(parseFixPlan("Some random text\nNo stories here")).toEqual([]);
    });

    it("handles indented items", () => {
      const content = "  - [x] Story 1.1: Indented item";
      const items = parseFixPlan(content);

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe("1.1");
    });
  });

  describe("detectOrphanedCompletedStories", () => {
    it("warns about completed stories not in new output", () => {
      const existing: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: true, title: "Login" },
        { id: "1.2", completed: false, title: "Logout" },
      ];
      const newIds = new Set(["1.2"]);

      const warnings = detectOrphanedCompletedStories(existing, newIds);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("1.1");
      expect(warnings[0]).toContain("Login");
    });

    it("returns no warnings when all completed stories exist in new output", () => {
      const existing: FixPlanItemWithTitle[] = [{ id: "1.1", completed: true, title: "Login" }];
      const newIds = new Set(["1.1", "1.2"]);

      expect(detectOrphanedCompletedStories(existing, newIds)).toHaveLength(0);
    });

    it("ignores uncompleted stories missing from new output", () => {
      const existing: FixPlanItemWithTitle[] = [{ id: "1.1", completed: false, title: "Login" }];
      const newIds = new Set<string>();

      expect(detectOrphanedCompletedStories(existing, newIds)).toHaveLength(0);
    });

    it("returns no warnings for empty input", () => {
      expect(detectOrphanedCompletedStories([], new Set())).toEqual([]);
    });
  });

  describe("detectRenumberedStories", () => {
    it("warns when a completed story title appears under a different ID", () => {
      const existing: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: true, title: "Login form" },
      ];
      const newStories = [makeStory({ id: "2.1", title: "Login form" })];

      const warnings = detectRenumberedStories(existing, newStories);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("renumbered");
      expect(warnings[0]).toContain("1.1");
      expect(warnings[0]).toContain("2.1");
    });

    it("returns no warnings when IDs match", () => {
      const existing: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: true, title: "Login form" },
      ];
      const newStories = [makeStory({ id: "1.1", title: "Login form" })];

      expect(detectRenumberedStories(existing, newStories)).toHaveLength(0);
    });

    it("ignores uncompleted stories", () => {
      const existing: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: false, title: "Login form" },
      ];
      const newStories = [makeStory({ id: "2.1", title: "Login form" })];

      expect(detectRenumberedStories(existing, newStories)).toHaveLength(0);
    });

    it("matches titles case-insensitively", () => {
      const existing: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: true, title: "LOGIN FORM" },
      ];
      const newStories = [makeStory({ id: "2.1", title: "login form" })];

      const warnings = detectRenumberedStories(existing, newStories);
      expect(warnings).toHaveLength(1);
    });

    it("returns no warnings for empty input", () => {
      expect(detectRenumberedStories([], [])).toEqual([]);
    });
  });

  describe("mergeFixPlanProgress", () => {
    it("marks completed story IDs with [x]", () => {
      const plan = "- [ ] Story 1.1: Login\n- [ ] Story 1.2: Logout";
      const completed = new Set(["1.1"]);

      const merged = mergeFixPlanProgress(plan, completed);

      expect(merged).toContain("- [x] Story 1.1: Login");
      expect(merged).toContain("- [ ] Story 1.2: Logout");
    });

    it("preserves already-completed items not in completed set", () => {
      const plan = "- [ ] Story 1.1: Login\n- [ ] Story 1.2: Logout";
      const completed = new Set(["1.1", "1.2"]);

      const merged = mergeFixPlanProgress(plan, completed);

      expect(merged).toContain("- [x] Story 1.1: Login");
      expect(merged).toContain("- [x] Story 1.2: Logout");
    });

    it("returns plan unchanged when no completions", () => {
      const plan = "- [ ] Story 1.1: Login";
      const completed = new Set<string>();

      expect(mergeFixPlanProgress(plan, completed)).toBe(plan);
    });

    it("returns plan unchanged for empty input", () => {
      expect(mergeFixPlanProgress("", new Set())).toBe("");
    });
  });
});
