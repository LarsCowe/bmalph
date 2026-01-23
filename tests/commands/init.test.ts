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
  scaffoldProject: vi.fn(),
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
      expect.stringContaining("already initialized")
    );
    const { scaffoldProject } = await import("../../src/installer.js");
    expect(scaffoldProject).not.toHaveBeenCalled();
  });

  it("scaffolds and writes config with CLI options", async () => {
    const { isInitialized, scaffoldProject, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(scaffoldProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", level: "2" });

    expect(scaffoldProject).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "my-proj",
        description: "A project",
        level: 2,
      })
    );
    expect(mergeClaudeMd).toHaveBeenCalled();
  });

  it("displays workflow roadmap with all phases", async () => {
    const { isInitialized, scaffoldProject, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(scaffoldProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", level: "2" });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Phase 1");
    expect(output).toContain("Analysis");
    expect(output).toContain("Phase 2");
    expect(output).toContain("Planning");
    expect(output).toContain("Phase 3");
    expect(output).toContain("Design");
    expect(output).toContain("Phase 4");
    expect(output).toContain("Implementation");
    expect(output).toContain("bmalph start");
    expect(output).toContain("bmalph start -p 4");
  });

  it("prompts user when options missing", async () => {
    const { isInitialized, scaffoldProject, mergeClaudeMd } = await import(
      "../../src/installer.js"
    );
    const { writeConfig } = await import("../../src/utils/config.js");
    const inquirer = await import("inquirer");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(scaffoldProject).mockResolvedValue(undefined);
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
      })
    );
  });
});
