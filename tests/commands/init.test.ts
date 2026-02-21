import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk");

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
  hasExistingBmadDir: vi.fn().mockResolvedValue(false),
  installProject: vi.fn(),
  mergeInstructionsFile: vi.fn(),
  mergeClaudeMd: vi.fn(),
  previewInstall: vi.fn(),
  getBundledVersions: vi.fn(() => ({ bmadCommit: "test1234" })),
}));

vi.mock("../../src/utils/config.js", () => ({
  writeConfig: vi.fn(),
}));

vi.mock("../../src/platform/registry.js", () => ({
  isPlatformId: vi.fn((value: string) => {
    return ["claude-code", "codex", "cursor", "windsurf", "copilot", "aider"].includes(value);
  }),
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

vi.mock("../../src/platform/detect.js", () => ({
  detectPlatform: vi
    .fn()
    .mockResolvedValue({ detected: "claude-code", candidates: ["claude-code"] }),
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
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: process.cwd() });

    expect(installProject).toHaveBeenCalled();
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "my-proj",
        description: "A project",
        platform: "claude-code",
      })
    );
    expect(mergeInstructionsFile).toHaveBeenCalled();
  });

  it("displays installed directories and platform info", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: process.cwd() });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("_bmad/");
    expect(output).toContain(".ralph/");
    expect(output).toContain("Claude Code");
  });

  it("prompts user when options missing", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");
    const inquirer = await import("inquirer");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
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
    const { isInitialized, installProject, mergeInstructionsFile, previewInstall } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);
    vi.mocked(previewInstall).mockResolvedValue({
      wouldCreate: ["bmalph/state/", ".ralph/"],
      wouldModify: [".gitignore"],
      wouldSkip: [],
    });

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({
      name: "test",
      description: "test",
      dryRun: true,
      projectDir: process.cwd(),
    });

    expect(installProject).not.toHaveBeenCalled();
    expect(writeConfig).not.toHaveBeenCalled();
    expect(mergeInstructionsFile).not.toHaveBeenCalled();
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
    await initCommand({
      name: "test",
      description: "test",
      dryRun: true,
      projectDir: process.cwd(),
    });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("dry-run");
  });

  it("uses projectDir instead of process.cwd() when provided", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: "/custom/path" });

    expect(isInitialized).toHaveBeenCalledWith("/custom/path");
    expect(installProject).toHaveBeenCalledWith("/custom/path", expect.any(Object));
    expect(writeConfig).toHaveBeenCalledWith("/custom/path", expect.any(Object));
    expect(mergeInstructionsFile).toHaveBeenCalledWith("/custom/path", expect.any(Object));
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
    await initCommand({
      name: "a".repeat(101),
      description: "A project",
      projectDir: process.cwd(),
    });

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
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
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

  it("warns about partial installation when writeConfig fails after installProject", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockRejectedValue(new Error("disk full"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: process.cwd() });

    const errorOutput = errorSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(errorOutput.toLowerCase()).toContain("partial installation");
    expect(errorOutput).toContain("disk full");
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it("warns about partial installation when mergeInstructionsFile fails after installProject", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockRejectedValue(new Error("write failed"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "A project", projectDir: process.cwd() });

    const errorOutput = errorSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(errorOutput.toLowerCase()).toContain("partial installation");
    expect(errorOutput).toContain("write failed");
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it("shows migration message when existing _bmad dir detected", async () => {
    const { isInitialized, hasExistingBmadDir, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(hasExistingBmadDir).mockResolvedValue(true);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "Migrating", projectDir: process.cwd() });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Existing BMAD installation detected");
    expect(output).toContain("_bmad-output/");
  });

  it("does not show migration message for fresh install", async () => {
    const { isInitialized, hasExistingBmadDir, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(hasExistingBmadDir).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ name: "my-proj", description: "Fresh", projectDir: process.cwd() });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).not.toContain("Existing BMAD installation detected");
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

  it("passes explicit --platform flag to installer", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");
    const { getPlatform } = await import("../../src/platform/registry.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({
      name: "my-proj",
      description: "A project",
      platform: "codex",
      projectDir: process.cwd(),
    });

    expect(getPlatform).toHaveBeenCalledWith("codex");
    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ platform: "codex" })
    );
  });

  it("rejects unknown platform flag", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const { isPlatformId } = await import("../../src/platform/registry.js");
    vi.mocked(isPlatformId).mockReturnValue(false);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({
      name: "my-proj",
      description: "A project",
      platform: "unknown-tool",
      projectDir: process.cwd(),
    });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown platform"));
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it("shows interactive platform prompt when detection is ambiguous", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");
    const { detectPlatform } = await import("../../src/platform/detect.js");
    const inquirer = await import("inquirer");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    // No single platform detected — should trigger interactive prompt
    vi.mocked(detectPlatform).mockResolvedValue({
      detected: null,
      candidates: ["cursor", "windsurf"],
    });

    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true as unknown as true;

    // Mock prompt to return both name/description AND platform selection
    vi.mocked(inquirer.default.prompt)
      .mockResolvedValueOnce({ platformId: "cursor" })
      .mockResolvedValueOnce({ name: "my-proj", description: "A project" });

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ projectDir: process.cwd() });

    // Verify the platform prompt was shown
    const promptCalls = vi.mocked(inquirer.default.prompt).mock.calls;
    const platformPrompt = promptCalls.find((call) =>
      (call[0] as Array<{ name: string }>).some((q) => q.name === "platformId")
    );
    expect(platformPrompt).toBeDefined();

    expect(writeConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ platform: "cursor" })
    );

    process.stdin.isTTY = originalIsTTY;
  });

  it("defaults to claude-code in non-interactive mode when detection is ambiguous", async () => {
    const { isInitialized, installProject, mergeInstructionsFile } =
      await import("../../src/installer.js");
    const { writeConfig } = await import("../../src/utils/config.js");
    const { detectPlatform } = await import("../../src/platform/detect.js");
    const { getPlatform } = await import("../../src/platform/registry.js");

    vi.mocked(isInitialized).mockResolvedValue(false);
    vi.mocked(installProject).mockResolvedValue(undefined);
    vi.mocked(mergeInstructionsFile).mockResolvedValue(undefined);
    vi.mocked(writeConfig).mockResolvedValue(undefined);

    vi.mocked(detectPlatform).mockResolvedValue({
      detected: null,
      candidates: [],
    });

    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false as unknown as true;

    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({
      name: "ci-project",
      description: "CI build",
      projectDir: process.cwd(),
    });

    expect(getPlatform).toHaveBeenCalledWith("claude-code");

    process.stdin.isTTY = originalIsTTY;
  });
});
