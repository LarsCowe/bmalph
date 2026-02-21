import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk");

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
  copyBundledAssets: vi.fn(),
  mergeInstructionsFile: vi.fn(),
  mergeClaudeMd: vi.fn(),
  previewUpgrade: vi.fn(),
  getBundledVersions: vi.fn(),
}));

vi.mock("../../src/utils/config.js", () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
}));

vi.mock("../../src/platform/registry.js", () => ({
  getPlatform: vi.fn((id: string) => ({
    id,
    displayName: id === "claude-code" ? "Claude Code" : id === "codex" ? "OpenAI Codex" : id,
    tier: id === "claude-code" || id === "codex" ? "full" : "instructions-only",
    instructionsFile: id === "claude-code" ? "CLAUDE.md" : "AGENTS.md",
    commandDelivery:
      id === "claude-code"
        ? { kind: "directory", dir: ".claude/commands" }
        : id === "codex"
          ? { kind: "inline" }
          : { kind: "none" },
    instructionsSectionMarker: "## BMAD-METHOD Integration",
    generateInstructionsSnippet: () => "## BMAD-METHOD Integration\n\nSnippet content",
    getDoctorChecks: () => [],
  })),
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
      await upgradeCommand({ projectDir: process.cwd() });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
    });

    it("suggests running init first", async () => {
      const { isInitialized } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(false);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ projectDir: process.cwd() });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("bmalph init"));
    });

    it("does not call copyBundledAssets", async () => {
      const { isInitialized, copyBundledAssets } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(false);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ projectDir: process.cwd() });

      expect(copyBundledAssets).not.toHaveBeenCalled();
    });
  });

  describe("when initialized", () => {
    it("calls copyBundledAssets with platform", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/", ".ralph/ralph_loop.sh"],
      });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(copyBundledAssets).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
    });

    it("calls mergeInstructionsFile", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(mergeInstructionsFile).toHaveBeenCalled();
    });

    it("displays upgrading message", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Upgrading"));
    });

    it("displays updated paths", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/", ".ralph/ralph_loop.sh", ".claude/commands/"],
      });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_bmad/");
      expect(output).toContain(".ralph/ralph_loop.sh");
      expect(output).toContain(".claude/commands/");
    });

    it("displays preserved paths", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

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
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Upgrade complete"));
    });

    it("updates upstreamVersions in config after upgrade", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile, getBundledVersions } =
        await import("../../src/installer.js");
      const { readConfig, writeConfig } = await import("../../src/utils/config.js");

      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({ updatedPaths: ["_bmad/"] });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
      vi.mocked(getBundledVersions).mockReturnValue({
        bmadCommit: "abc12345",
      });
      vi.mocked(readConfig).mockResolvedValue({
        name: "test-project",
        description: "A test project",
        createdAt: "2024-01-01T00:00:00.000Z",
        upstreamVersions: { bmadCommit: "old11111" },
      });
      vi.mocked(writeConfig).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(writeConfig).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          upstreamVersions: { bmadCommit: "abc12345" },
        })
      );
    });

    it("preserves existing config fields when updating upstreamVersions", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile, getBundledVersions } =
        await import("../../src/installer.js");
      const { readConfig, writeConfig } = await import("../../src/utils/config.js");

      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({ updatedPaths: ["_bmad/"] });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
      vi.mocked(getBundledVersions).mockReturnValue({
        bmadCommit: "abc12345",
      });
      vi.mocked(readConfig).mockResolvedValue({
        name: "my-app",
        description: "My application",
        createdAt: "2025-06-15T10:30:00.000Z",
        upstreamVersions: { bmadCommit: "old11111" },
      });
      vi.mocked(writeConfig).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(writeConfig).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: "my-app",
          description: "My application",
          createdAt: "2025-06-15T10:30:00.000Z",
        })
      );
    });

    it("skips config update when config cannot be read", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      const { readConfig, writeConfig } = await import("../../src/utils/config.js");

      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({ updatedPaths: ["_bmad/"] });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
      vi.mocked(readConfig).mockResolvedValue(null);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(writeConfig).not.toHaveBeenCalled();
    });
  });

  describe("platform resolution from config", () => {
    it("uses platform from config when available", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");

      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({ updatedPaths: ["_bmad/"] });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
      vi.mocked(readConfig).mockResolvedValue({
        name: "codex-project",
        description: "A codex project",
        createdAt: "2025-06-15T10:30:00.000Z",
        platform: "codex",
      });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(getPlatform).toHaveBeenCalledWith("codex");
    });

    it("defaults to claude-code when config has no platform", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");

      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({ updatedPaths: ["_bmad/"] });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
      vi.mocked(readConfig).mockResolvedValue({
        name: "legacy-project",
        description: "A legacy project",
        createdAt: "2025-01-01T00:00:00.000Z",
      });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(getPlatform).toHaveBeenCalledWith("claude-code");
    });
  });

  describe("projectDir option", () => {
    it("uses projectDir instead of process.cwd() when provided", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({
        updatedPaths: ["_bmad/"],
      });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ projectDir: "/custom/path", force: true });

      expect(isInitialized).toHaveBeenCalledWith("/custom/path");
      expect(copyBundledAssets).toHaveBeenCalledWith("/custom/path", expect.any(Object));
      expect(mergeInstructionsFile).toHaveBeenCalledWith("/custom/path", expect.any(Object));
    });
  });

  describe("error handling", () => {
    it("catches and displays errors", async () => {
      const { isInitialized, copyBundledAssets } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockRejectedValue(new Error("Copy failed"));

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Copy failed"));
    });

    it("sets exitCode to 1 on error", async () => {
      const { isInitialized, copyBundledAssets } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockRejectedValue(new Error("Copy failed"));

      process.exitCode = undefined;

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(process.exitCode).toBe(1);
    });
  });

  describe("force option", () => {
    let originalIsTTY: boolean | undefined;

    beforeEach(() => {
      originalIsTTY = process.stdin.isTTY;
      process.stdin.isTTY = true as unknown as true;
    });

    afterEach(() => {
      process.stdin.isTTY = originalIsTTY as unknown as true;
    });

    it("shows confirmation prompt without --force", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      const inquirer = await import("inquirer");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({ updatedPaths: ["_bmad/"] });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
      vi.mocked(inquirer.default.prompt).mockResolvedValue({ confirm: true });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ projectDir: process.cwd() });

      expect(inquirer.default.prompt).toHaveBeenCalled();
    });

    it("skips prompt with --force", async () => {
      const { isInitialized, copyBundledAssets, mergeInstructionsFile } =
        await import("../../src/installer.js");
      const inquirer = await import("inquirer");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(copyBundledAssets).mockResolvedValue({ updatedPaths: ["_bmad/"] });
      vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ force: true, projectDir: process.cwd() });

      expect(inquirer.default.prompt).not.toHaveBeenCalled();
    });

    it("aborts when user declines confirmation", async () => {
      const { isInitialized, copyBundledAssets } = await import("../../src/installer.js");
      const inquirer = await import("inquirer");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(inquirer.default.prompt).mockResolvedValue({ confirm: false });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ projectDir: process.cwd() });

      expect(copyBundledAssets).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Aborted"));
    });
  });

  describe("dry-run mode", () => {
    it("does not call copyBundledAssets in dry-run mode", async () => {
      const { isInitialized, copyBundledAssets, previewUpgrade } =
        await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(previewUpgrade).mockResolvedValue({
        wouldUpdate: ["_bmad/", ".ralph/ralph_loop.sh"],
        wouldCreate: [],
        wouldPreserve: [],
      });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ dryRun: true, projectDir: process.cwd() });

      expect(copyBundledAssets).not.toHaveBeenCalled();
    });

    it("shows preview of changes in dry-run mode", async () => {
      const { isInitialized, previewUpgrade } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(true);
      vi.mocked(previewUpgrade).mockResolvedValue({
        wouldUpdate: ["_bmad/", ".ralph/ralph_loop.sh"],
        wouldCreate: [],
        wouldPreserve: [],
      });

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ dryRun: true, projectDir: process.cwd() });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("dry-run");
    });

    it("still requires initialization in dry-run mode", async () => {
      const { isInitialized, previewUpgrade } = await import("../../src/installer.js");
      vi.mocked(isInitialized).mockResolvedValue(false);

      const { upgradeCommand } = await import("../../src/commands/upgrade.js");
      await upgradeCommand({ dryRun: true, projectDir: process.cwd() });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
      expect(previewUpgrade).not.toHaveBeenCalled();
    });
  });
});
