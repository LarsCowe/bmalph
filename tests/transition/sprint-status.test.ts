import { describe, it, expect } from "vitest";
import { parseSprintStatus } from "../../src/transition/sprint-status.js";

describe("sprint-status", () => {
  describe("parseSprintStatus", () => {
    it("parses canonical development_status story entries and ignores epic metadata", () => {
      const content = `generated: 2026-03-07
project: Example
project_key: EX
tracking_system: file-system
story_location: stories

development_status:
  epic-1: backlog
  1-1-user-authentication: done
  1-2-account-management: ready-for-dev
  1-3-plant-data-model: backlog
  epic-1-retrospective: optional

  epic-2: backlog
  2-1-billing-api: in-progress
  2-2-billing-review: review
`;

      const result = parseSprintStatus(content);

      expect(result.valid).toBe(true);
      expect(result.storyStatusById.get("1.1")).toBe("done");
      expect(result.storyStatusById.get("1.2")).toBe("ready-for-dev");
      expect(result.storyStatusById.get("1.3")).toBe("backlog");
      expect(result.storyStatusById.get("2.1")).toBe("in-progress");
      expect(result.storyStatusById.get("2.2")).toBe("review");
      expect(result.storyStatusById.has("epic-1")).toBe(false);
      expect(result.warnings).toEqual([]);
    });

    it("keeps drafted as a valid legacy story status", () => {
      const content = `development_status:
  3-1-payment-sync: drafted
`;

      const result = parseSprintStatus(content);

      expect(result.valid).toBe(true);
      expect(result.storyStatusById.get("3.1")).toBe("drafted");
    });

    it("warns on invalid story statuses and malformed keys", () => {
      const content = `development_status:
  1-1-login: ship-it
  malformed-story-key: done
`;

      const result = parseSprintStatus(content);

      expect(result.valid).toBe(false);
      expect(result.storyStatusById.size).toBe(0);
      expect(result.warnings).toContainEqual(expect.stringMatching(/ship-it/i));
      expect(result.warnings).toContainEqual(expect.stringMatching(/malformed-story-key/i));
    });

    it("keeps valid story statuses when epic metadata is invalid", () => {
      const content = `development_status:
  epic-1: review
  1-1-login: done
  epic-1-retrospective: optional
`;

      const result = parseSprintStatus(content);

      expect(result.valid).toBe(true);
      expect(result.storyStatusById.get("1.1")).toBe("done");
      expect(result.warnings).toContainEqual(expect.stringMatching(/epic-1/i));
    });

    it("warns when development_status is missing", () => {
      const result = parseSprintStatus("generated: 2026-03-07");

      expect(result.valid).toBe(false);
      expect(result.storyStatusById.size).toBe(0);
      expect(result.warnings).toContainEqual(expect.stringMatching(/development_status/i));
    });
  });
});
