import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPlatform } from "../helpers/mock-platform.js";

vi.mock("chalk");

vi.mock("../../src/utils/config.js", () => ({
  readConfig: vi.fn(),
}));

vi.mock("../../src/platform/registry.js", () => ({
  getPlatform: vi.fn(),
  isPlatformId: vi.fn(),
}));

vi.mock("../../src/run/ralph-process.js", () => ({
  validateBashAvailable: vi.fn(),
  validateRalphLoop: vi.fn(),
  spawnRalphLoop: vi.fn(),
}));

vi.mock("../../src/run/run-dashboard.js", () => ({
  startRunDashboard: vi.fn(),
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
        platform: "cursor",
      });
      vi.mocked(isPlatformId).mockReturnValue(true);
      vi.mocked(getPlatform).mockReturnValue(
        mockPlatform({ id: "cursor", displayName: "Cursor", tier: "instructions-only" })
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
      expect(errorOutput).toContain("full-tier");
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
      });
    });
  });
});
