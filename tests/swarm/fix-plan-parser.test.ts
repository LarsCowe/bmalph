import { describe, it, expect } from "vitest";
import { parseFixPlanWithEpics, generateWorkerFixPlan } from "../../src/swarm/fix-plan-parser.js";

const MULTI_EPIC_PLAN = `# Ralph Fix Plan

## Stories to Implement

### Auth
> Goal: Secure user authentication

- [ ] Story 1.1: Login form
  > As a user, I want to log in
  > AC: Given valid creds, When submit, Then logged in
  > Spec: specs/planning-artifacts/stories.md#story-1-1
- [ ] Story 1.2: Logout button
  > As a user, I want to log out
  > AC: Given logged in, When click logout, Then session ended
  > Spec: specs/planning-artifacts/stories.md#story-1-2

### Search
> Goal: Full-text search

- [ ] Story 2.1: Search bar
  > As a user, I want to search content
  > AC: Given text input, When submit, Then results shown
  > Spec: specs/planning-artifacts/stories.md#story-2-1
- [x] Story 2.2: Search filters
  > As a user, I want to filter results
  > AC: Given results, When apply filter, Then filtered results shown
  > Spec: specs/planning-artifacts/stories.md#story-2-2

### Notifications
> Goal: Real-time notifications

- [ ] Story 3.1: Push notifications
  > As a user, I want push notifications
  > AC: Given event, When triggered, Then notification received
  > Spec: specs/planning-artifacts/stories.md#story-3-1

## Completed

## Notes
- Follow TDD methodology (red-green-refactor)
- One story per Ralph loop iteration
- Update this file after completing each story
`;

const SINGLE_EPIC_PLAN = `# Ralph Fix Plan

## Stories to Implement

### Auth
> Goal: Secure user authentication

- [ ] Story 1.1: Login form
  > As a user, I want to log in
  > Spec: specs/planning-artifacts/stories.md#story-1-1

## Completed

## Notes
- Follow TDD methodology (red-green-refactor)
`;

const ALL_COMPLETED_PLAN = `# Ralph Fix Plan

## Stories to Implement

### Auth

- [x] Story 1.1: Login form

### Search

- [x] Story 2.1: Search bar

## Completed

## Notes
- Follow TDD methodology (red-green-refactor)
`;

const ORPHANED_STORIES_PLAN = `# Ralph Fix Plan

## Stories to Implement

- [ ] Story 1.1: Login form
  > As a user, I want to log in
- [ ] Story 1.2: Logout button
  > As a user, I want to log out

### Auth
> Goal: Secure user authentication

- [ ] Story 2.1: Dashboard
  > As a user, I want a dashboard

## Completed
`;

describe("fix-plan-parser", () => {
  describe("parseFixPlanWithEpics", () => {
    it("extracts epic groups with headings, goals, and stories", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);

      expect(groups).toHaveLength(3);
      expect(groups[0]!.epicHeading).toBe("### Auth");
      expect(groups[0]!.epicGoal).toBe("Secure user authentication");
      expect(groups[0]!.stories).toHaveLength(2);
      expect(groups[0]!.stories[0]!.id).toBe("1.1");
      expect(groups[0]!.stories[0]!.completed).toBe(false);
      expect(groups[0]!.stories[1]!.id).toBe("1.2");
    });

    it("preserves completed status", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);
      const searchGroup = groups[1]!;

      expect(searchGroup.epicHeading).toBe("### Search");
      expect(searchGroup.stories[1]!.id).toBe("2.2");
      expect(searchGroup.stories[1]!.completed).toBe(true);
    });

    it("preserves raw markdown blocks including detail lines", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);
      const authBlock = groups[0]!.rawBlock;

      expect(authBlock).toContain("### Auth");
      expect(authBlock).toContain("> Goal: Secure user authentication");
      expect(authBlock).toContain("- [ ] Story 1.1: Login form");
      expect(authBlock).toContain("  > As a user, I want to log in");
      expect(authBlock).toContain("  > AC: Given valid creds, When submit, Then logged in");
      expect(authBlock).toContain("  > Spec: specs/planning-artifacts/stories.md#story-1-1");
      expect(authBlock).toContain("- [ ] Story 1.2: Logout button");
    });

    it("handles single-epic plan", () => {
      const groups = parseFixPlanWithEpics(SINGLE_EPIC_PLAN);

      expect(groups).toHaveLength(1);
      expect(groups[0]!.epicHeading).toBe("### Auth");
      expect(groups[0]!.stories).toHaveLength(1);
    });

    it("handles all-completed stories", () => {
      const groups = parseFixPlanWithEpics(ALL_COMPLETED_PLAN);

      expect(groups).toHaveLength(2);
      expect(groups[0]!.stories[0]!.completed).toBe(true);
      expect(groups[1]!.stories[0]!.completed).toBe(true);
    });

    it("returns empty array for empty plan", () => {
      const groups = parseFixPlanWithEpics("# Ralph Fix Plan\n\n## Stories to Implement\n");

      expect(groups).toHaveLength(0);
    });

    it("collects orphaned stories before any heading into a synthetic group", () => {
      const groups = parseFixPlanWithEpics(ORPHANED_STORIES_PLAN);

      expect(groups).toHaveLength(2);
      // First group should be the synthetic "Ungrouped" group
      expect(groups[0]!.epicHeading).toMatch(/ungrouped/i);
      expect(groups[0]!.epicGoal).toBeNull();
      expect(groups[0]!.stories).toHaveLength(2);
      expect(groups[0]!.stories[0]!.id).toBe("1.1");
      // Second group is the real epic
      expect(groups[1]!.epicHeading).toBe("### Auth");
      expect(groups[1]!.stories).toHaveLength(1);
    });

    it("extracts story titles", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);

      expect(groups[0]!.stories[0]!.title).toBe("Login form");
      expect(groups[2]!.stories[0]!.title).toBe("Push notifications");
    });

    it("handles epic heading without goal line", () => {
      const groups = parseFixPlanWithEpics(ALL_COMPLETED_PLAN);

      expect(groups[0]!.epicHeading).toBe("### Auth");
      expect(groups[0]!.epicGoal).toBeNull();
    });

    it("does not include content after ## Completed in any rawBlock", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);

      for (const group of groups) {
        expect(group.rawBlock).not.toContain("## Completed");
        expect(group.rawBlock).not.toContain("## Notes");
        expect(group.rawBlock).not.toContain("Follow TDD");
      }
    });
  });

  describe("generateWorkerFixPlan", () => {
    it("generates valid fix plan from epic groups", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);
      const plan = generateWorkerFixPlan([groups[0]!]);

      expect(plan).toContain("# Ralph Fix Plan");
      expect(plan).toContain("## Stories to Implement");
      expect(plan).toContain("### Auth");
      expect(plan).toContain("- [ ] Story 1.1: Login form");
      expect(plan).toContain("## Completed");
      expect(plan).toContain("## Notes");
    });

    it("concatenates multiple epic groups", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);
      const plan = generateWorkerFixPlan([groups[0]!, groups[2]!]);

      expect(plan).toContain("### Auth");
      expect(plan).toContain("### Notifications");
      expect(plan).not.toContain("### Search");
    });

    it("preserves raw block content verbatim", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);
      const plan = generateWorkerFixPlan([groups[0]!]);

      // Detail lines should be preserved
      expect(plan).toContain("  > As a user, I want to log in");
      expect(plan).toContain("  > AC: Given valid creds, When submit, Then logged in");
      expect(plan).toContain("  > Spec: specs/planning-artifacts/stories.md#story-1-1");
    });

    it("returns empty plan when given no groups", () => {
      const plan = generateWorkerFixPlan([]);

      expect(plan).toContain("# Ralph Fix Plan");
      expect(plan).toContain("## Stories to Implement");
      expect(plan).toContain("## Completed");
    });

    it("preserves completed checkbox state", () => {
      const groups = parseFixPlanWithEpics(MULTI_EPIC_PLAN);
      const searchGroup = groups[1]!;
      const plan = generateWorkerFixPlan([searchGroup]);

      expect(plan).toContain("- [x] Story 2.2: Search filters");
    });
  });
});
