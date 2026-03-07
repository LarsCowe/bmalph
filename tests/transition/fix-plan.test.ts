import { describe, it, expect } from "vitest";
import {
  generateFixPlan,
  hasFixPlanProgress,
  parseFixPlan,
  detectOrphanedCompletedStories,
  detectRenumberedStories,
  mergeFixPlanProgress,
  buildCompletedTitleMap,
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
    sourceFile: "",
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

    it("uses the resolved planning_artifacts specs directory in spec links", () => {
      const stories = [makeStory({ id: "1.1", sourceFile: "epics/epic-1.md" })];
      const plan = generateFixPlan(stories, undefined, "planning_artifacts");

      expect(plan).toContain("Spec: specs/planning_artifacts/epics/epic-1.md#story-1-1");
      expect(plan).not.toContain("specs/planning-artifacts/epics/epic-1.md#story-1-1");
    });

    it("uses the specs root when planning artifacts come from docs/planning", () => {
      const stories = [makeStory({ id: "1.1", sourceFile: "epics/epic-1.md" })];
      const plan = generateFixPlan(stories, undefined, "");

      expect(plan).toContain("Spec: specs/epics/epic-1.md#story-1-1");
      expect(plan).not.toContain("specs/planning-artifacts/epics/epic-1.md#story-1-1");
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

    it("preserves completion via title match when IDs change", () => {
      const plan = "- [ ] Story 2.1: Login form\n- [ ] Story 2.2: Dashboard";
      const completedIds = new Set<string>(); // old ID 1.1 is not in new plan
      const titleMap = new Map([
        ["2.1", "Login form"],
        ["2.2", "Dashboard"],
      ]);
      const completedTitles = new Map([["login form", "1.1"]]);

      const merged = mergeFixPlanProgress(plan, completedIds, titleMap, completedTitles);

      expect(merged).toContain("- [x] Story 2.1: Login form");
      expect(merged).toContain("- [ ] Story 2.2: Dashboard");
    });

    it("prefers ID match over title match", () => {
      const plan = "- [ ] Story 1.1: Login form\n- [ ] Story 1.2: Logout";
      const completedIds = new Set(["1.1"]);
      const titleMap = new Map([
        ["1.1", "Login form"],
        ["1.2", "Logout"],
      ]);
      const completedTitles = new Map<string, string>();

      const merged = mergeFixPlanProgress(plan, completedIds, titleMap, completedTitles);

      expect(merged).toContain("- [x] Story 1.1: Login form");
      expect(merged).toContain("- [ ] Story 1.2: Logout");
    });

    it("handles title match case-insensitively", () => {
      const plan = "- [ ] Story 2.1: LOGIN FORM";
      const completedIds = new Set<string>();
      const titleMap = new Map([["2.1", "LOGIN FORM"]]);
      const completedTitles = new Map([["login form", "1.1"]]);

      const merged = mergeFixPlanProgress(plan, completedIds, titleMap, completedTitles);

      expect(merged).toContain("- [x] Story 2.1: LOGIN FORM");
    });

    it("works without optional title parameters (backwards compatible)", () => {
      const plan = "- [ ] Story 1.1: Login\n- [ ] Story 1.2: Logout";
      const completed = new Set(["1.1"]);

      const merged = mergeFixPlanProgress(plan, completed);

      expect(merged).toContain("- [x] Story 1.1: Login");
      expect(merged).toContain("- [ ] Story 1.2: Logout");
    });
  });

  describe("buildCompletedTitleMap", () => {
    it("builds map from completed items with titles", () => {
      const items: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: true, title: "Login form" },
        { id: "1.2", completed: false, title: "Logout" },
        { id: "2.1", completed: true, title: "Dashboard" },
      ];

      const map = buildCompletedTitleMap(items);

      expect(map.get("login form")).toBe("1.1");
      expect(map.get("dashboard")).toBe("2.1");
      expect(map.has("logout")).toBe(false);
    });

    it("returns empty map for no completed items", () => {
      const items: FixPlanItemWithTitle[] = [{ id: "1.1", completed: false, title: "Login" }];

      const map = buildCompletedTitleMap(items);
      expect(map.size).toBe(0);
    });

    it("skips items without titles", () => {
      const items: FixPlanItemWithTitle[] = [{ id: "1.1", completed: true }];

      const map = buildCompletedTitleMap(items);
      expect(map.size).toBe(0);
    });
  });

  describe("detectRenumberedStories", () => {
    it("does not warn for stories that were auto-preserved via title match", () => {
      const existing: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: true, title: "Login form" },
      ];
      const newStories = [makeStory({ id: "2.1", title: "Login form" })];
      const preservedIds = new Set(["2.1"]);

      const warnings = detectRenumberedStories(existing, newStories, preservedIds);

      expect(warnings).toHaveLength(0);
    });

    it("still warns for renumbered stories not auto-preserved", () => {
      const existing: FixPlanItemWithTitle[] = [
        { id: "1.1", completed: true, title: "Login form" },
      ];
      const newStories = [makeStory({ id: "2.1", title: "Login form" })];

      const warnings = detectRenumberedStories(existing, newStories);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("renumbered");
    });
  });
});
