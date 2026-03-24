import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPlatform } from "../helpers/mock-platform.js";

vi.mock("chalk");

vi.mock("../../src/utils/config.js", () => ({
  readConfig: vi.fn(),
}));

vi.mock("../../src/platform/registry.js", () => ({
  getPlatform: vi.fn(),
  isPlatformId: vi.fn(),
  getFullTierPlatformNames: vi.fn(
    () => "Claude Code, OpenAI Codex, OpenCode, GitHub Copilot CLI, Cursor"
  ),
}));

vi.mock("../../src/run/ralph-process.js", () => ({
  validateBashAvailable: vi.fn(),
  validateRalphLoop: vi.fn(),
  validateGitRepo: vi.fn(),
  spawnRalphLoop: vi.fn(),
}));

vi.mock("../../src/run/run-dashboard.js", () => ({
  startRunDashboard: vi.fn(),
}));

vi.mock("../../src/platform/cursor-runtime-checks.js", () => ({
  validateCursorRuntime: vi.fn(),
}));

vi.mock("../../src/watch/frame-writer.js", () => ({
  getDashboardTerminalSupport: vi.fn(() => ({ supported: true })),
}));

describe("runCommand", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  beforeEach(async () => {
    const { getDashboardTerminalSupport } = await import("../../src/watch/frame-writer.js");
    vi.mocked(getDashboardTerminalSupport).mockReturnValue({ supported: true });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  describe("validation", () => {
    it("fails when project is not initialized", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      vi.mocked(readConfig).mockResolvedValue(null);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("not initialized");
    });

    it("fails when --driver specifies an unknown platform", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId } = await import("../../src/platform/registry.js");
      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(isPlatformId).mockReturnValue(false);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        driver: "unknown",
        interval: "2000",
        dashboard: true,
      });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("Unknown platform");
    });

    it("fails when platform is instructions-only", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId, getPlatform } = await import("../../src/platform/registry.js");
      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "windsurf",
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(
        mockPlatform({ id: "windsurf", displayName: "Windsurf", tier: "instructions-only" })
      );

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        driver: "windsurf",
        interval: "2000",
        dashboard: true,
      });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("full-tier");
    });

    it.each([
      { id: "copilot", displayName: "GitHub Copilot CLI" },
      { id: "cursor", displayName: "Cursor" },
    ])("accepts $id as a full-tier experimental platform", async ({ id, displayName }) => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId, getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
      const { validateCursorRuntime } = await import("../../src/platform/cursor-runtime-checks.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: id,
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(
        mockPlatform({
          id,
          displayName,
          tier: "full",
          experimental: true,
        })
      );
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(validateCursorRuntime).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        driver: id,
        interval: "2000",
        dashboard: true,
      });

      expect(process.exitCode).toBeUndefined();
      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", id, {
        inheritStdio: false,
        reviewMode: "off",
      });
      if (id === "cursor") {
        expect(validateCursorRuntime).toHaveBeenCalledWith("/test/project");
      }
    });

    it("accepts opencode as a full-tier platform", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId, getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
      const { validateCursorRuntime } = await import("../../src/platform/cursor-runtime-checks.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "opencode",
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(
        mockPlatform({ id: "opencode", displayName: "OpenCode", tier: "full" })
      );
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(validateCursorRuntime).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        driver: "opencode",
        interval: "2000",
        dashboard: true,
      });

      expect(process.exitCode).toBeUndefined();
      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "opencode", {
        inheritStdio: false,
        reviewMode: "off",
      });
      expect(validateCursorRuntime).not.toHaveBeenCalled();
    });

    it("fails when Cursor runtime preflight fails", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId, getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { validateCursorRuntime } = await import("../../src/platform/cursor-runtime-checks.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "cursor",
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(
        mockPlatform({ id: "cursor", displayName: "Cursor", tier: "full", experimental: true })
      );
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(validateCursorRuntime).mockRejectedValue(
        new Error("cursor-agent is not authenticated")
      );

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        driver: "cursor",
        interval: "2000",
        dashboard: true,
      });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("cursor-agent");
      expect(errorOutput).toContain("authenticated");
    });

    it("fails when interval is below 500ms", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "100",
        dashboard: true,
      });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("500");
    });

    it("fails when interval is not a number", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "abc",
        dashboard: true,
      });

      expect(process.exitCode).toBe(1);
    });

    it("fails when bash is not available", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable } = await import("../../src/run/ralph-process.js");
      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockRejectedValue(new Error("bash not found"));

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("bash");
    });

    it("fails when ralph_loop.sh is missing", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop } =
        await import("../../src/run/ralph-process.js");
      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockRejectedValue(new Error("ralph_loop.sh not found"));

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("ralph_loop.sh");
    });
  });

  describe("platform resolution", () => {
    it("uses --driver override when provided", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId, getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(mockPlatform({ id: "codex", tier: "full" }));
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        driver: "codex",
        interval: "2000",
        dashboard: true,
      });

      expect(isPlatformId).toHaveBeenCalledWith("codex");
      expect(getPlatform).toHaveBeenCalledWith("codex");
    });

    it("defaults to claude-code when no --driver and no config platform", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(getPlatform).toHaveBeenCalledWith("claude-code");
    });

    it("uses config platform when no --driver override", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(getPlatform).toHaveBeenCalledWith("claude-code");
    });
  });

  describe("execution modes", () => {
    it("falls back to headless mode when the dashboard terminal is unsupported", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
      const { getDashboardTerminalSupport } = await import("../../src/watch/frame-writer.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(getDashboardTerminalSupport).mockReturnValue({
        supported: false,
        reason: "Dashboard requires an interactive terminal with cursor support.",
      });

      const onExitCb: Array<(code: number | null) => void> = [];
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn((cb) => onExitCb.push(cb)),
      } as never);

      const { runCommand } = await import("../../src/commands/run.js");
      const promise = runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
      });

      await new Promise((r) => setTimeout(r, 50));
      for (const cb of onExitCb) cb(0);
      await promise;

      expect(startRunDashboard).not.toHaveBeenCalled();
      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: true,
        reviewMode: "off",
      });
      expect(consoleSpy.mock.calls.map((call) => call[0]).join("\n")).toContain(
        "interactive terminal"
      );
    });

    it("starts dashboard when dashboard is true", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(startRunDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          projectDir: "/test/project",
          interval: 2000,
        })
      );
      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: false,
        reviewMode: "off",
      });
    });

    it("runs headless when dashboard is false", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);

      const onExitCb: Array<(code: number | null) => void> = [];
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn((cb) => onExitCb.push(cb)),
      } as never);

      const { runCommand } = await import("../../src/commands/run.js");
      const promise = runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: false,
      });

      // Wait for async validation chain to complete before triggering exit
      await new Promise((r) => setTimeout(r, 50));
      for (const cb of onExitCb) cb(0);
      await promise;

      expect(startRunDashboard).not.toHaveBeenCalled();
      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: true,
        reviewMode: "off",
      });
    });

    it("propagates Ralph non-zero exit code in headless mode", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);

      const onExitCb: Array<(code: number | null) => void> = [];
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn((cb) => onExitCb.push(cb)),
      } as never);

      const { runCommand } = await import("../../src/commands/run.js");
      const promise = runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: false,
      });

      await new Promise((r) => setTimeout(r, 50));
      for (const cb of onExitCb) cb(7);
      await promise;

      expect(process.exitCode).toBe(7);
    });

    it("propagates Ralph non-zero exit code after dashboard mode stops", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);

      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockImplementation(async ({ ralph }) => {
        ralph.state = "stopped";
        ralph.exitCode = 9;
      });

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(process.exitCode).toBe(9);
    });

    it("does not set exit code when dashboard session detaches", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);

      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockImplementation(async ({ ralph }) => {
        ralph.state = "detached";
        ralph.exitCode = 9;
      });

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({ projectDir: "/test/project", interval: "2000", dashboard: true });

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe("review mode", () => {
    it("passes reviewMode enhanced when --review is set without value", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
        review: true,
      });

      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: false,
        reviewMode: "enhanced",
      });
    });

    it("passes reviewMode enhanced when --review enhanced is set", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
        review: "enhanced",
      });

      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: false,
        reviewMode: "enhanced",
      });
    });

    it("passes reviewMode ultimate when --review ultimate is set", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
        review: "ultimate",
      });

      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: false,
        reviewMode: "ultimate",
      });
    });

    it("passes reviewMode off when --no-review is set", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
        review: false,
      });

      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: false,
        reviewMode: "off",
      });
    });

    it("errors when --review is used with a non-claude-code driver", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId, getPlatform } = await import("../../src/platform/registry.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "codex",
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(
        mockPlatform({ id: "codex", displayName: "OpenAI Codex", tier: "full" })
      );

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
        review: true,
      });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("Claude Code");
    });

    it("errors when --review ultimate is used with a non-claude-code driver", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { isPlatformId, getPlatform } = await import("../../src/platform/registry.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "codex",
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(
        mockPlatform({ id: "codex", displayName: "OpenAI Codex", tier: "full" })
      );

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
        review: "ultimate",
      });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("Claude Code");
    });

    it("errors when --review is set with an invalid mode", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
        review: "invalid",
      });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("Unknown review mode");
    });

    it("defaults to no review mode when review flag is not provided", async () => {
      const { readConfig } = await import("../../src/utils/config.js");
      const { getPlatform } = await import("../../src/platform/registry.js");
      const { validateBashAvailable, validateRalphLoop, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");

      vi.mocked(readConfig).mockResolvedValue({
        name: "test",
        description: "",
        createdAt: "2026-02-28",
        platform: "claude-code",
      });
      vi.mocked(getPlatform).mockReturnValue(mockPlatform());
      vi.mocked(validateBashAvailable).mockResolvedValue(undefined);
      vi.mocked(validateRalphLoop).mockResolvedValue(undefined);
      vi.mocked(spawnRalphLoop).mockReturnValue({
        child: { pid: 123 },
        state: "running",
        exitCode: null,
        kill: vi.fn(),
        detach: vi.fn(),
        onExit: vi.fn(),
      } as never);
      vi.mocked(startRunDashboard).mockResolvedValue(undefined);

      const { runCommand } = await import("../../src/commands/run.js");
      await runCommand({
        projectDir: "/test/project",
        interval: "2000",
        dashboard: true,
      });

      expect(spawnRalphLoop).toHaveBeenCalledWith("/test/project", "claude-code", {
        inheritStdio: false,
        reviewMode: "off",
      });
    });
  });
});
