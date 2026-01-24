import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
  },
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
  copyBundledAssets: vi.fn(),
  mergeClaudeMd: vi.fn(),
}));

describe("upgrade command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("exits early when not initialized", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const { upgradeCommand } = await import("../../src/commands/upgrade.js");
    await upgradeCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("not initialized"),
    );
    const { copyBundledAssets } = await import("../../src/installer.js");
    expect(copyBundledAssets).not.toHaveBeenCalled();
  });

  it("calls copyBundledAssets with cwd", async () => {
    const { isInitialized, copyBundledAssets } = await import(
      "../../src/installer.js"
    );
    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(copyBundledAssets).mockResolvedValue({
      updatedPaths: ["_bmad/", ".ralph/ralph_loop.sh"],
    });

    const { upgradeCommand } = await import("../../src/commands/upgrade.js");
    await upgradeCommand();

    expect(copyBundledAssets).toHaveBeenCalledWith(process.cwd());
  });

  it("calls mergeClaudeMd after copying", async () => {
    const { isInitialized, copyBundledAssets, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(copyBundledAssets).mockResolvedValue({
      updatedPaths: ["_bmad/"],
    });
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

    const { upgradeCommand } = await import("../../src/commands/upgrade.js");
    await upgradeCommand();

    expect(mergeClaudeMd).toHaveBeenCalledWith(process.cwd());
  });

  it("displays updated paths in output", async () => {
    const { isInitialized, copyBundledAssets, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(copyBundledAssets).mockResolvedValue({
      updatedPaths: [
        "_bmad/",
        ".ralph/ralph_loop.sh",
        ".ralph/lib/",
        ".ralph/PROMPT.md",
        ".ralph/@AGENT.md",
        ".claude/commands/bmalph.md",
      ],
    });
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

    const { upgradeCommand } = await import("../../src/commands/upgrade.js");
    await upgradeCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("_bmad/");
    expect(output).toContain(".ralph/ralph_loop.sh");
    expect(output).toContain(".claude/commands/bmalph.md");
  });

  it("displays preserved paths in output", async () => {
    const { isInitialized, copyBundledAssets, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(copyBundledAssets).mockResolvedValue({
      updatedPaths: ["_bmad/"],
    });
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);

    const { upgradeCommand } = await import("../../src/commands/upgrade.js");
    await upgradeCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("bmalph/config.json");
    expect(output).toContain(".ralph/logs/");
    expect(output).toContain(".ralph/@fix_plan.md");
  });
});
