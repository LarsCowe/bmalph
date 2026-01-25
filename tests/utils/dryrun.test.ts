import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logDryRunAction, formatDryRunSummary, type DryRunAction } from "../../src/utils/dryrun.js";

describe("dryrun", () => {
  describe("logDryRunAction", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("logs create action with path", () => {
      logDryRunAction({ type: "create", path: "bmalph/state/" });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("create"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("bmalph/state/"));
    });

    it("logs modify action with path", () => {
      logDryRunAction({ type: "modify", path: ".gitignore" });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("modify"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(".gitignore"));
    });

    it("logs skip action with reason", () => {
      logDryRunAction({ type: "skip", path: "CLAUDE.md", reason: "already exists" });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("skip"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("already exists"));
    });
  });

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

    it("ends with no-changes message", () => {
      const actions: DryRunAction[] = [{ type: "create", path: "test/" }];
      const summary = formatDryRunSummary(actions);
      expect(summary).toContain("No changes made");
    });
  });
});
