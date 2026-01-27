import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
  copyBundledAssets: vi.fn(),
  mergeClaudeMd: vi.fn(),
  previewUpgrade: vi.fn(),
}));

describe("upgrade command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  describe("when not initialized", () => {
    it("shows error message when not initialized", async () => {
      const { isInitialized } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(false);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
    });

    it("suggests running init first", async () => {
      const { isInitialized } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(false);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("bmalph init"));
    });

    it("does not call copyBundledAssets", async () => {
      const { isInitialized, copyBundledAssets } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(false);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(copyBundledAssets).not.toHaveBeenCalled();
    });
  });

  describe("when initialized", () => {
    it("calls copyBundledAssets", async () => {
      const { isInitialized, copyBundledAssets, mergeClaudeMd } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/", ".ralph/ralph_loop.sh"],
      });
      vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(copyBundledAssets).toHaveBeenCalled();
    });

    it("calls mergeClaudeMd", async () => {
      const { isInitialized, copyBundledAssets, mergeClaudeMd } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(mergeClaudeMd).toHaveBeenCalled();
    });

    it("displays upgrading message", async () => {
      const { isInitialized, copyBundledAssets, mergeClaudeMd } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Upgrading"));
    });

    it("displays updated paths", async () => {
      const { isInitialized, copyBundledAssets, mergeClaudeMd } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/", ".ralph/ralph_loop.sh", ".claude/commands/"],
      });
      vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_bmad/");
      expect(output).toContain(".ralph/ralph_loop.sh");
      expect(output).toContain(".claude/commands/");
    });

    it("displays preserved paths", async () => {
      const { isInitialized, copyBundledAssets, mergeClaudeMd } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Preserved");
      expect(output).toContain("bmalph/config.json");
      expect(output).toContain("bmalph/state/");
      expect(output).toContain(".ralph/logs/");
      expect(output).toContain(".ralph/@fix_plan.md");
      expect(output).toContain(".ralph/docs/");
      expect(output).toContain(".ralph/specs/");
    });

    it("displays completion message", async () => {
      const { isInitialized, copyBundledAssets, mergeClaudeMd } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Upgrade complete"));
    });
  });

  describe("error handling", () => {
    it("catches and displays errors", async () => {
      const { isInitialized, copyBundledAssets } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockRejectedValue(new Error("Copy failed"));

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Copy failed"));
    });

    it("sets exitCode to 1 on error", async () => {
      const { isInitialized, copyBundledAssets } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockRejectedValue(new Error("Copy failed"));

      process.exitCode = undefined;

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({});

      expect(process.exitCode).toBe(1);
    });
  });

  describe("dry-run mode", () => {
    it("does not call copyBundledAssets in dry-run mode", async () => {
      const { isInitialized, copyBundledAssets, previewUpgrade } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(previewUpgrade).mockResolvedValue({
        wouldUpdate: ["_bmad/", ".ralph/ralph_loop.sh"],
      });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ dryRun: true });

      expect(copyBundledAssets).not.toHaveBeenCalled();
    });

    it("shows preview of changes in dry-run mode", async () => {
      const { isInitialized, previewUpgrade } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(previewUpgrade).mockResolvedValue({
        wouldUpdate: ["_bmad/", ".ralph/ralph_loop.sh"],
      });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ dryRun: true });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("dry-run");
    });

    it("still requires initialization in dry-run mode", async () => {
      const { isInitialized, previewUpgrade } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(false);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ dryRun: true });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
      expect(previewUpgrade).not.toHaveBeenCalled();
    });
  });
});
