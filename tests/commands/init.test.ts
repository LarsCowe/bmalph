import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk");

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
  installProject: vi.fn(),
  mergeClaudeMd: vi.fn(),
  previewInstall: vi.fn(),
  getBundledVersions: vi.fn(() => ({ bmadCommit: "test1234", ralphCommit: "test5678" })),
}));

vi.mock("../../src/utils/config.js", () => ({
  writeConfig: vi.fn(),
}));

describe("init command", () => {
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

  it("exits early when already initialized", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(true);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ projectDir: process.cwd() });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("already initialized"));
    const { installProject } = await import("../../src/installer.js");
    expect(installProject).not.toHaveBeenCalled();
  });

  it("suggests upgrade command when already initialized", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(true);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ projectDir: process.cwd() });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("bmalph upgrade");
    expect(output).not.toContain("reset");
  });

  it("installs and writes config with CLI options", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: process.cwd() });

    expect(installProject).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "my-proj",
        description: "A project",
      })
    );
    expect(mergeClaudeMd).toHaveBeenCalled();
  });

  it("displays installed directories and workflow info", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: process.cwd() });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("_bmad/");
    expect(output).toContain(".ralph/");
    expect(output).toContain(".claude/commands/");
    expect(output).toContain("/bmalph");
  });

  it("prompts user when options missing", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");
    const inquirer = await import("inquirer");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);
    vi.mocked(inquirer.default.prompt).mockResolvedValue({
      name: "prompted-name",
      description: "prompted-desc",
    });

    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true as unknown as true;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ projectDir: process.cwd() });

    expect(inquirer.default.prompt).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "prompted-name",
        description: "prompted-desc",
      })
    );

    process.stdin.isTTY = originalIsTTY;
  });

  it("dry-run does not install files", async () => {
    const { isInitialized, installProject, mergeClaudeMd, previewInstall } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);
    vi.mocked(previewInstall).mockResolvedValue({
      wouldCreate: ["bmalph/state/", ".ralph/"],
      wouldModify: [".gitignore"],
      wouldSkip: [],
    });

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "test", description: "test", dryRun: true, projectDir: process.cwd() });

    expect(installProject).not.toHaveBeenCalled();
    expect(writeConfig).not.toHaveBeenCalled();
    expect(mergeClaudeMd).not.toHaveBeenCalled();
  });

  it("dry-run shows preview of changes", async () => {
    const { isInitialized, previewInstall } = await import("../../src/installer.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(previewInstall).mockResolvedValue({
      wouldCreate: ["bmalph/state/", ".ralph/specs/"],
      wouldModify: [".gitignore"],
      wouldSkip: [],
    });

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "test", description: "test", dryRun: true, projectDir: process.cwd() });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("dry-run");
  });

  it("uses projectDir instead of process.cwd() when provided", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: "/custom/path" });

    expect(isInitialized).toHaveBeenCalledWith("/custom/path");
    expect(installProject).toHaveBeenCalledWith("/custom/path");
    expect(writeConfig).toHaveBeenCalledWith("/custom/path", expect.any(Object));
    expect(mergeClaudeMd).toHaveBeenCalledWith("/custom/path");
  });

  it("rejects invalid project names with reserved Windows name", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "CON", description: "A project", projectDir: process.cwd() });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("reserved"));
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it("rejects project names with invalid filesystem characters", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my/project", description: "A project", projectDir: process.cwd() });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("invalid character"));
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it("rejects project names that are too long", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "a".repeat(101), description: "A project", projectDir: process.cwd() });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("100 characters"));
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it("throws in non-interactive mode without --name and --description", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false as unknown as true;
    process.exitCode = undefined;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ projectDir: process.cwd() });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Non-interactive"));
    expect(process.exitCode).toBe(1);

    process.stdin.isTTY = originalIsTTY;
    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it("succeeds in non-interactive mode with --name and --description", async () => {
    const { isInitialized, installProject, mergeClaudeMd } = await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeClaudeMd).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false as unknown as true;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "ci-project", description: "CI build", projectDir: process.cwd() });

    expect(installProject).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: "ci-project" })
    );

    process.stdin.isTTY = originalIsTTY;
  });

  it("rejects empty project names", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true as unknown as true;
    process.exitCode = undefined;

    const inquirer = await import("inquirer");
    vi.mocked(inquirer.default.prompt).mockResolvedValue({ name: "", description: "A project" });

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "", description: "A project", projectDir: process.cwd() });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("empty"));
    expect(process.exitCode).toBe(1);

    process.stdin.isTTY = originalIsTTY;
    errorSpy.mockRestore();
    process.exitCode = undefined;
  });
});
