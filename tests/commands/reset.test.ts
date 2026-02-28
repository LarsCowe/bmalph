import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk");

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
}));

vi.mock("../../src/reset.js", () => ({
  buildResetPlan: vi.fn(),
  executeResetPlan: vi.fn(),
  planToDryRunActions: vi.fn(),
}));

vi.mock("../../src/utils/dryrun.js", () => ({
  formatDryRunSummary: vi.fn(() => "[dry-run] summary"),
}));

vi.mock("../../src/platform/resolve.js", () => ({
  resolveProjectPlatform: vi.fn(() => ({
    id: "claude-code",
    displayName: "Claude Code",
    tier: "full",
    instructionsFile: "CLAUDE.md",
    commandDelivery: { kind: "directory", dir: ".claude/commands" },
    instructionsSectionMarker: "## BMAD-METHOD Integration",
    generateInstructionsSnippet: () => "",
    getDoctorChecks: () => [],
  })),
}));

import type { ResetPlan } from "../../src/reset.js";

const fullPlan: ResetPlan = {
  directories: ["_bmad", ".ralph", "bmalph"],
  commandFiles: [".claude/commands/bmalph.md"],
  instructionsCleanup: { path: "CLAUDE.md", sectionsToRemove: ["## BMAD-METHOD Integration"] },
  gitignoreLines: [".ralph/logs/", "_bmad-output/"],
  warnings: [{ path: "_bmad-output/", message: "user artifacts" }],
};

const emptyPlan: ResetPlan = {
  directories: [],
  commandFiles: [],
  instructionsCleanup: null,
  gitignoreLines: [],
  warnings: [],
};

describe("reset command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("shows not-initialized message when not initialized", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project" });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
  });

  it("shows nothing-to-reset when plan produces no actions", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { buildResetPlan, planToDryRunActions } = await import("../../src/reset.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(buildResetPlan).mockResolvedValue(emptyPlan);
    vi.mocked(planToDryRunActions).mockReturnValue([]);

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project" });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Nothing to reset"));
  });

  it("dry-run shows preview without executing", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { buildResetPlan, executeResetPlan, planToDryRunActions } =
      await import("../../src/reset.js");
    const { formatDryRunSummary } = await import("../../src/utils/dryrun.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(buildResetPlan).mockResolvedValue(fullPlan);
    vi.mocked(planToDryRunActions).mockReturnValue([{ type: "delete", path: "_bmad/" }]);
    vi.mocked(formatDryRunSummary).mockReturnValue("[dry-run] Would delete _bmad/");

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project", dryRun: true });

    expect(formatDryRunSummary).toHaveBeenCalled();
    expect(executeResetPlan).not.toHaveBeenCalled();
  });

  it("aborts when confirmation is declined", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { buildResetPlan, executeResetPlan, planToDryRunActions } =
      await import("../../src/reset.js");
    const { confirm } = await import("@inquirer/prompts");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(buildResetPlan).mockResolvedValue(fullPlan);
    vi.mocked(planToDryRunActions).mockReturnValue([{ type: "delete", path: "_bmad/" }]);
    vi.mocked(confirm).mockResolvedValue(false);

    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true as unknown as true;

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project" });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Aborted"));
    expect(executeResetPlan).not.toHaveBeenCalled();

    process.stdin.isTTY = originalIsTTY;
  });

  it("executes reset with --force", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { buildResetPlan, executeResetPlan, planToDryRunActions } =
      await import("../../src/reset.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(buildResetPlan).mockResolvedValue(fullPlan);
    vi.mocked(planToDryRunActions).mockReturnValue([{ type: "delete", path: "_bmad/" }]);
    vi.mocked(executeResetPlan).mockResolvedValue(undefined);

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project", force: true });

    expect(executeResetPlan).toHaveBeenCalledWith("/project", fullPlan);
  });

  it("shows summary after reset", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { buildResetPlan, executeResetPlan, planToDryRunActions } =
      await import("../../src/reset.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(buildResetPlan).mockResolvedValue(fullPlan);
    vi.mocked(planToDryRunActions).mockReturnValue([{ type: "delete", path: "_bmad/" }]);
    vi.mocked(executeResetPlan).mockResolvedValue(undefined);

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project", force: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Reset complete");
  });

  it("shows warnings about user artifacts", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { buildResetPlan, executeResetPlan, planToDryRunActions } =
      await import("../../src/reset.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(buildResetPlan).mockResolvedValue(fullPlan);
    vi.mocked(planToDryRunActions).mockReturnValue([{ type: "delete", path: "_bmad/" }]);
    vi.mocked(executeResetPlan).mockResolvedValue(undefined);

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project", force: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("_bmad-output/");
    expect(output).toContain("user artifacts");
  });

  it("throws in non-interactive mode without --force", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { buildResetPlan, planToDryRunActions } = await import("../../src/reset.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(buildResetPlan).mockResolvedValue(fullPlan);
    vi.mocked(planToDryRunActions).mockReturnValue([{ type: "delete", path: "_bmad/" }]);

    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false as unknown as true;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;

    const { resetCommand } = await import("../../src/commands/reset.js");
    await resetCommand({ projectDir: "/project" });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Non-interactive"));
    expect(process.exitCode).toBe(1);

    process.stdin.isTTY = originalIsTTY;
    errorSpy.mockRestore();
    process.exitCode = undefined;
  });
});
