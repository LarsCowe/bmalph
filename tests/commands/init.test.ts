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

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
  installProject: vi.fn(),
  mergeClaudeMd: vi.fn(),
}));

vi.mock("../../src/utils/config.js", () => ({
  writeConfig: vi.fn(),
}));

describe("init command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("exits early when already initialized", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(true);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("already initialized"),
    );
    const { installProject } = await import("../../src/installer.js");
    expect(installProject).not.toHaveBeenCalled();
  });

  it("installs and writes config with CLI options", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", level: "2" });

    expect(installProject).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "my-proj",
        description: "A project",
        level: 2,
      }),
    );
    expect(mergeClaudeMd).toHaveBeenCalled();
  });

  it("displays installed directories and workflow info", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", level: "2" });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("_bmad/");
    expect(output).toContain(".ralph/");
    expect(output).toContain(".claude/commands/");
    expect(output).toContain("/bmalph");
  });

  it("prompts user when options missing", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    const { writeConfig } = await import("../../src/utils/config.js");
    const inquirer = await import("inquirer");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);
    vi.mocked(inquirer.default.prompt).mockResolvedValue({
      name: "prompted-name",
      description: "prompted-desc",
      level: 3,
    });

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({});

    expect(inquirer.default.prompt).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "prompted-name",
        description: "prompted-desc",
        level: 3,
      }),
    );
  });
});
