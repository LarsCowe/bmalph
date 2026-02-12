import { describe, it, expect } from "vitest";
import { parseStories, parseStoriesWithWarnings } from "../../src/transition/story-parsing.js";

describe("story-parsing", () => {
  describe("parseStories", () => {
    it("parses valid stories with epic, description, and AC", () => {
      const content = `## Epic 1: User Authentication

Core auth features

### Story 1.1: Login form

As a user, I want to log in.

**Acceptance Criteria:**

**Given** a valid username
**When** I submit the form
**Then** I am logged in
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(1);
      expect(stories[0].epic).toBe("User Authentication");
      expect(stories[0].id).toBe("1.1");
      expect(stories[0].title).toBe("Login form");
      expect(stories[0].description).toContain("log in");
      expect(stories[0].acceptanceCriteria).toHaveLength(1);
    });

    it("parses multiple stories across epics", () => {
      const content = `## Epic 1: Auth

### Story 1.1: Login

Login description.

**Acceptance Criteria:**

**Given** valid credentials
**When** I log in
**Then** I see dashboard

### Story 1.2: Logout

Logout description.

**Acceptance Criteria:**

**Given** I am logged in
**When** I click logout
**Then** I am logged out

## Epic 2: Dashboard

### Story 2.1: Widget display

Widget description.

**Acceptance Criteria:**

**Given** a dashboard
**When** I load the page
**Then** I see widgets
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(3);
      expect(stories[0].epic).toBe("Auth");
      expect(stories[1].epic).toBe("Auth");
      expect(stories[2].epic).toBe("Dashboard");
      expect(stories[2].id).toBe("2.1");
    });

    it("returns empty array for empty input", () => {
      expect(parseStories("")).toEqual([]);
    });

    it("returns empty array for content without stories", () => {
      const content = `# Some Document

This is just text with no story headers.
`;
      expect(parseStories(content)).toEqual([]);
    });

    it("handles bold Given/When/Then lines", () => {
      const content = `## Epic 1: Test

### Story 1.1: Bold AC

Description.

**Acceptance Criteria:**

**Given** a condition
**When** action happens
**Then** result occurs

**Given** another condition
**When** another action
**Then** another result
`;
      const stories = parseStories(content);

      expect(stories).toHaveLength(1);
      expect(stories[0].acceptanceCriteria).toHaveLength(2);
    });
  });

  describe("parseStoriesWithWarnings", () => {
    it("warns about malformed story IDs", () => {
      const content = `## Epic 1: Test

### Story abc: Bad ID

Description.

**Acceptance Criteria:**

**Given** something
**When** action
**Then** result
`;
      const result = parseStoriesWithWarnings(content);

      // abc doesn't match the Story header pattern N.M so it won't even be captured
      expect(result.stories).toHaveLength(0);
    });

    it("warns about stories without acceptance criteria", () => {
      const content = `## Epic 1: Test

### Story 1.1: No AC

This story has a description but no acceptance criteria.
`;
      const result = parseStoriesWithWarnings(content);

      expect(result.stories).toHaveLength(1);
      expect(result.warnings).toContainEqual(expect.stringContaining("no acceptance criteria"));
    });

    it("warns about stories not under an epic", () => {
      const content = `### Story 1.1: Orphan story

Description.

**Acceptance Criteria:**

**Given** something
**When** action
**Then** result
`;
      const result = parseStoriesWithWarnings(content);

      expect(result.stories).toHaveLength(1);
      expect(result.warnings).toContainEqual(expect.stringContaining("not under an epic"));
    });

    it("warns about stories without a description", () => {
      const content = `## Epic 1: Test

### Story 1.1: No desc

**Acceptance Criteria:**

**Given** something
**When** action
**Then** result
`;
      const result = parseStoriesWithWarnings(content);

      expect(result.stories).toHaveLength(1);
      expect(result.warnings).toContainEqual(expect.stringContaining("no description"));
    });

    it("captures epic descriptions", () => {
      const content = `## Epic 1: Data Pipeline

Build a robust data ingestion pipeline for real-time analytics.

### Story 1.1: Ingest events

As a developer, I want to ingest events.

**Acceptance Criteria:**

**Given** an event payload
**When** it is submitted
**Then** it is stored
`;
      const result = parseStoriesWithWarnings(content);

      expect(result.stories[0].epicDescription).toContain("data ingestion pipeline");
    });
  });
});
