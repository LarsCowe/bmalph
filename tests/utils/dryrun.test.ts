import { describe, it, expect } from "vitest";
import { formatDryRunSummary, type DryRunAction } from "../../src/utils/dryrun.js";

describe("dryrun", () => {
  describe("formatDryRunSummary", () => {
    it("formats empty actions list", () => {
      const summary = formatDryRunSummary([]);
      expect(summary).toContain("No changes");
    });

    it("groups actions by type", () => {
      const actions: DryRunAction[] = [
        { type: "create", path: "bmalph/state/" },
        { type: "create", path: ".ralph/specs/" },
        { type: "modify", path: ".gitignore" },
      ];
      const summary = formatDryRunSummary(actions);
      expect(summary).toContain("Would create:");
      expect(summary).toContain("bmalph/state/");
      expect(summary).toContain(".ralph/specs/");
      expect(summary).toContain("Would modify:");
      expect(summary).toContain(".gitignore");
    });

    it("includes skip section when skipped actions exist", () => {
      const actions: DryRunAction[] = [
        { type: "skip", path: "CLAUDE.md", reason: "already integrated" },
      ];
      const summary = formatDryRunSummary(actions);
      expect(summary).toContain("Would skip:");
      expect(summary).toContain("CLAUDE.md");
      expect(summary).toContain("already integrated");
    });

    it("includes delete section when delete actions exist", () => {
      const actions: DryRunAction[] = [
        { type: "delete", path: "_bmad/" },
        { type: "delete", path: ".ralph/" },
      ];
      const summary = formatDryRunSummary(actions);
      expect(summary).toContain("Would delete:");
      expect(summary).toContain("_bmad/");
      expect(summary).toContain(".ralph/");
    });

    it("includes warnings section when warn actions exist", () => {
      const actions: DryRunAction[] = [
        { type: "warn", path: "_bmad-output/", reason: "user artifacts" },
      ];
      const summary = formatDryRunSummary(actions);
      expect(summary).toContain("Warning");
      expect(summary).toContain("_bmad-output/");
      expect(summary).toContain("user artifacts");
    });

    it("ends with no-changes message", () => {
      const actions: DryRunAction[] = [{ type: "create", path: "test/" }];
      const summary = formatDryRunSummary(actions);
      expect(summary).toContain("No changes made");
    });
  });
});
