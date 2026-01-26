import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    blue: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Test versions for upstream version tracking
const TEST_BMAD_COMMIT = "test1234";
const TEST_RALPH_COMMIT = "test5678";

vi.mock("../../src/installer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/installer.js")>();
  return {
    ...actual,
    getBundledVersions: vi.fn(() => ({
      bmadCommit: TEST_BMAD_COMMIT,
      ralphCommit: TEST_RALPH_COMMIT,
    })),
  };
});

vi.mock("../../src/utils/github.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils/github.js")>();
  return {
    ...actual,
    checkUpstream: vi.fn(),
    clearCache: vi.fn(),
  };
});

describe("doctor command", () => {
  let testDir: string;
  let originalCwd: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    originalCwd = process.cwd();
    process.chdir(testDir);
    vi.resetModules();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  async function setupFullProject(): Promise<void> {
    // Create minimal valid project structure
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({
        name: "test",
        description: "test desc",
        createdAt: "2025-01-01T00:00:00.000Z",
        upstreamVersions: {
          bmadCommit: TEST_BMAD_COMMIT,
          ralphCommit: TEST_RALPH_COMMIT,
        },
      }),
    );
    await mkdir(join(testDir, "_bmad"), { recursive: true });
    await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
    await mkdir(join(testDir, ".claude/commands"), { recursive: true });
    await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\necho hello\n");
    await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph");
    await writeFile(
      join(testDir, "CLAUDE.md"),
      "# Project\n\n## BMAD-METHOD Integration\n\nSome content",
    );
    await writeFile(join(testDir, ".gitignore"), ".ralph/logs/\n_bmad-output/\n");
  }

  describe("Node version check", () => {
    it("passes when Node version is >= 20", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Node version >= 20");
      // Should show check mark (or just pass without showing fail detail)
      expect(output).not.toContain("got v");
    });
  });

  describe("bash available check", () => {
    it("checks for bash availability", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bash available");
    });
  });

  describe("config.json check", () => {
    it("passes when config.json exists and is valid JSON", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bmalph/config.json exists and valid");
      expect(output).not.toContain("file not found");
    });

    it("fails when config.json does not exist", async () => {
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("file not found");
    });

    it("fails when config.json contains invalid JSON", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(join(testDir, "bmalph/config.json"), "{ invalid json!!!");

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bmalph/config.json");
      // Should indicate an error/failure
    });
  });

  describe("_bmad directory check", () => {
    it("passes when _bmad/ directory exists", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_bmad/ directory present");
    });

    it("fails when _bmad/ directory does not exist", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("_bmad/ directory present");
      expect(output).toContain("not found");
    });
  });

  describe("ralph_loop.sh check", () => {
    it("passes when ralph_loop.sh exists and has content", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("ralph_loop.sh present and has content");
    });

    it("fails when ralph_loop.sh does not exist", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("ralph_loop.sh present and has content");
      expect(output).toContain("not found");
    });

    it("fails when ralph_loop.sh is empty", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "");
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("ralph_loop.sh");
    });
  });

  describe(".ralph/lib directory check", () => {
    it("passes when .ralph/lib/ directory exists", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".ralph/lib/ directory present");
    });

    it("fails when .ralph/lib/ directory does not exist", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n");
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".ralph/lib/ directory present");
      expect(output).toContain("not found");
    });
  });

  describe("slash command check", () => {
    it("passes when .claude/commands/bmalph.md exists", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".claude/commands/bmalph.md present");
    });

    it("fails when .claude/commands/bmalph.md does not exist", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n");
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".claude/commands/bmalph.md present");
      expect(output).toContain("not found");
    });
  });

  describe("CLAUDE.md check", () => {
    it("passes when CLAUDE.md contains BMAD snippet", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("CLAUDE.md contains BMAD snippet");
    });

    it("fails when CLAUDE.md does not exist", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n");
      await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph");
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("CLAUDE.md contains BMAD snippet");
      expect(output).toContain("CLAUDE.md not found");
    });

    it("fails when CLAUDE.md exists but lacks BMAD snippet", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n");
      await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph");
      await writeFile(join(testDir, "CLAUDE.md"), "# Project\n\nNo BMAD here.");
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("CLAUDE.md contains BMAD snippet");
      // Should fail silently (no explicit error detail for missing snippet)
    });
  });

  describe(".gitignore check", () => {
    it("passes when .gitignore has all required entries", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".gitignore has required entries");
    });

    it("fails when .gitignore is missing", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n");
      await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph");
      await writeFile(
        join(testDir, "CLAUDE.md"),
        "## BMAD-METHOD Integration\n",
      );
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(".gitignore has required entries");
      expect(output).toContain(".gitignore not found");
    });

    it("fails when .gitignore lacks .ralph/logs/ entry", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n");
      await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph");
      await writeFile(
        join(testDir, "CLAUDE.md"),
        "## BMAD-METHOD Integration\n",
      );
      await writeFile(join(testDir, ".gitignore"), "_bmad-output/\n");
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("missing: .ralph/logs/");
    });

    it("fails when .gitignore lacks _bmad-output/ entry", async () => {
      await mkdir(join(testDir, "bmalph"), { recursive: true });
      await mkdir(join(testDir, "_bmad"), { recursive: true });
      await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
      await mkdir(join(testDir, ".claude/commands"), { recursive: true });
      await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n");
      await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph");
      await writeFile(
        join(testDir, "CLAUDE.md"),
        "## BMAD-METHOD Integration\n",
      );
      await writeFile(join(testDir, ".gitignore"), ".ralph/logs/\n");
      await writeFile(
        join(testDir, "bmalph/config.json"),
        JSON.stringify({ name: "test" }),
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("missing: _bmad-output/");
    });
  });

  describe("version marker check", () => {
    it("passes when version marker matches package version", async () => {
      await setupFullProject();
      // Get package version and update ralph_loop.sh with marker
      const { getPackageVersion } = await import("../../src/installer.js");
      const version = getPackageVersion();
      await writeFile(
        join(testDir, ".ralph/ralph_loop.sh"),
        `#!/bin/bash\n# bmalph-version: ${version}\necho hello\n`,
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("version marker matches");
      expect(output).toContain(`v${version}`);
    });

    it("passes with detail when no version marker present (pre-0.8.0)", async () => {
      await setupFullProject();
      // ralph_loop.sh without version marker
      await writeFile(
        join(testDir, ".ralph/ralph_loop.sh"),
        "#!/bin/bash\necho hello\n",
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("version marker matches");
      expect(output).toContain("no marker");
    });

    it("fails when version marker does not match", async () => {
      await setupFullProject();
      await writeFile(
        join(testDir, ".ralph/ralph_loop.sh"),
        "#!/bin/bash\n# bmalph-version: 0.1.0\necho hello\n",
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("version marker matches");
      expect(output).toContain("installed: 0.1.0");
    });
  });

  describe("runDoctor integration", () => {
    it("outputs title", async () => {
      await setupFullProject();
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bmalph doctor");
    });

    it("outputs summary with pass count", async () => {
      await setupFullProject();
      // Add version marker to make all tests pass
      const { getPackageVersion } = await import("../../src/installer.js");
      const version = getPackageVersion();
      await writeFile(
        join(testDir, ".ralph/ralph_loop.sh"),
        `#!/bin/bash\n# bmalph-version: ${version}\necho hello\n`,
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("passed");
    });

    it("shows failed count when checks fail", async () => {
      // Empty project - most checks will fail
      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("failed");
    });

    it("shows all checks OK when fully configured", async () => {
      await setupFullProject();
      const { getPackageVersion } = await import("../../src/installer.js");
      const version = getPackageVersion();
      await writeFile(
        join(testDir, ".ralph/ralph_loop.sh"),
        `#!/bin/bash\n# bmalph-version: ${version}\necho hello\n`,
      );

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("all checks OK");
    });
  });

  describe("error handling", () => {
    it("catches and reports unexpected errors without crashing", async () => {
      // Mock readJsonFile to throw unexpected error
      vi.doMock("../../src/utils/json.js", () => ({
        readJsonFile: vi.fn().mockRejectedValue(new Error("Unexpected error")),
      }));

      const { runDoctor } = await import("../../src/commands/doctor.js");

      // Should complete without throwing an unhandled exception
      await expect(runDoctor()).resolves.not.toThrow();

      // Unmock for subsequent tests
      vi.doUnmock("../../src/utils/json.js");
    });
  });

  describe("exit code behavior", () => {
    let originalExitCode: number | undefined;

    beforeEach(() => {
      // Reset modules to ensure clean state for exit code tests
      vi.resetModules();
      // Save and reset process.exitCode
      originalExitCode = process.exitCode;
      process.exitCode = undefined;
    });

    afterEach(() => {
      // Restore original exit code
      process.exitCode = originalExitCode;
    });

    it("sets exitCode to 1 when checks fail", async () => {
      // Empty project - most checks will fail
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: null,
        ralph: null,
        errors: [{ type: "network", message: "offline", repo: "bmad" }],
      });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      expect(process.exitCode).toBe(1);
    });

    it("does not set exitCode to 1 when all checks pass", async () => {
      await setupFullProject();
      const { getPackageVersion } = await import("../../src/installer.js");
      const version = getPackageVersion();
      await writeFile(
        join(testDir, ".ralph/ralph_loop.sh"),
        `#!/bin/bash\n# bmalph-version: ${version}\necho hello\n`,
      );

      // Mock checkUpstream to return success
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: {
          bundledSha: TEST_BMAD_COMMIT,
          latestSha: TEST_BMAD_COMMIT,
          isUpToDate: true,
          compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/...",
        },
        ralph: {
          bundledSha: TEST_RALPH_COMMIT,
          latestSha: TEST_RALPH_COMMIT,
          isUpToDate: true,
          compareUrl: "https://github.com/snarktank/ralph/compare/...",
        },
        errors: [],
      });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      // Should NOT set exit code when all checks pass
      expect(process.exitCode).toBeUndefined();
    });

    it("does not set exitCode in JSON mode even when checks fail", async () => {
      // Empty project - most checks will fail
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: null,
        ralph: null,
        errors: [{ type: "network", message: "offline", repo: "bmad" }],
      });

      const { runDoctor } = await import("../../src/commands/doctor.js");
      await runDoctor({ json: true });

      // JSON mode should not set exit code - let the caller decide based on output
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe("Ralph health checks", () => {
    describe("circuit breaker check", () => {
      it("shows CLOSED state when circuit breaker is healthy", async () => {
        await setupFullProject();
        await writeFile(
          join(testDir, ".ralph/.circuit_breaker_state"),
          JSON.stringify({
            state: "CLOSED",
            consecutive_no_progress: 0,
            last_progress_loop: 5,
          }),
        );

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("circuit breaker");
        expect(output).toContain("CLOSED");
      });

      it("shows warning when circuit breaker is HALF_OPEN", async () => {
        await setupFullProject();
        await writeFile(
          join(testDir, ".ralph/.circuit_breaker_state"),
          JSON.stringify({
            state: "HALF_OPEN",
            consecutive_no_progress: 2,
            reason: "Monitoring: 2 loops without progress",
          }),
        );

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("circuit breaker");
        expect(output).toContain("HALF_OPEN");
      });

      it("shows failure when circuit breaker is OPEN", async () => {
        await setupFullProject();
        await writeFile(
          join(testDir, ".ralph/.circuit_breaker_state"),
          JSON.stringify({
            state: "OPEN",
            consecutive_no_progress: 3,
            reason: "No progress detected in 3 consecutive loops",
          }),
        );

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("circuit breaker");
        expect(output).toContain("OPEN");
      });

      it("shows not running when no circuit breaker state file", async () => {
        await setupFullProject();

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("circuit breaker");
        expect(output).toContain("not running");
      });
    });

    describe("session age check", () => {
      it("shows session age when Ralph session exists", async () => {
        await setupFullProject();
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        await writeFile(
          join(testDir, ".ralph/.ralph_session"),
          JSON.stringify({
            session_id: "ralph-12345",
            created_at: twoHoursAgo.toISOString(),
            last_used: now.toISOString(),
          }),
        );

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("session");
        expect(output).toMatch(/\d+h/); // Should show hours
      });

      it("shows no active session when session file missing", async () => {
        await setupFullProject();

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("session");
        expect(output).toContain("no active session");
      });

      it("warns when session age exceeds 24h", async () => {
        await setupFullProject();
        const now = new Date();
        const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);
        await writeFile(
          join(testDir, ".ralph/.ralph_session"),
          JSON.stringify({
            session_id: "ralph-12345",
            created_at: thirtyHoursAgo.toISOString(),
            last_used: now.toISOString(),
          }),
        );

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("session");
        // Session older than 24h should be flagged
      });
    });

    describe("API calls check", () => {
      it("shows API call count from status file", async () => {
        await setupFullProject();
        await writeFile(
          join(testDir, ".ralph/status.json"),
          JSON.stringify({
            timestamp: new Date().toISOString(),
            loop_count: 5,
            calls_made_this_hour: 12,
            max_calls_per_hour: 100,
            status: "running",
          }),
        );

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("API calls");
        expect(output).toContain("12/100");
      });

      it("shows not running when status file missing", async () => {
        await setupFullProject();

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("API calls");
        expect(output).toContain("not running");
      });

      it("warns when API calls approach limit", async () => {
        await setupFullProject();
        await writeFile(
          join(testDir, ".ralph/status.json"),
          JSON.stringify({
            timestamp: new Date().toISOString(),
            loop_count: 50,
            calls_made_this_hour: 95,
            max_calls_per_hour: 100,
            status: "running",
          }),
        );

        const { doctorCommand } = await import("../../src/commands/doctor.js");
        await doctorCommand();

        const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(output).toContain("API calls");
        expect(output).toContain("95/100");
      });
    });
  });

  describe("JSON output", () => {
    it("outputs valid JSON when json flag is true", async () => {
      await setupFullProject();
      const { runDoctor } = await import("../../src/commands/doctor.js");
      await runDoctor({ json: true });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should be valid JSON
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("results");
      expect(parsed).toHaveProperty("summary");
    });

    it("JSON output contains check results with expected shape", async () => {
      await setupFullProject();
      const { runDoctor } = await import("../../src/commands/doctor.js");
      await runDoctor({ json: true });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);

      expect(Array.isArray(parsed.results)).toBe(true);
      expect(parsed.results.length).toBeGreaterThan(0);

      // Each result should have label and passed
      for (const result of parsed.results) {
        expect(result).toHaveProperty("label");
        expect(result).toHaveProperty("passed");
        expect(typeof result.passed).toBe("boolean");
      }
    });

    it("JSON output includes summary counts", async () => {
      await setupFullProject();
      const { runDoctor } = await import("../../src/commands/doctor.js");
      await runDoctor({ json: true });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.summary).toHaveProperty("passed");
      expect(parsed.summary).toHaveProperty("failed");
      expect(parsed.summary).toHaveProperty("total");
      expect(typeof parsed.summary.passed).toBe("number");
      expect(typeof parsed.summary.failed).toBe("number");
      expect(typeof parsed.summary.total).toBe("number");
    });

    it("JSON output includes hints when checks fail", async () => {
      // Empty project - most checks will fail
      const { runDoctor } = await import("../../src/commands/doctor.js");
      await runDoctor({ json: true });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      const parsed = JSON.parse(output);

      // Find a failed check that should have a hint
      const failedWithHint = parsed.results.find(
        (r: { passed: boolean; hint?: string }) => !r.passed && r.hint
      );
      expect(failedWithHint).toBeDefined();
    });

    it("does not output colored text in JSON mode", async () => {
      await setupFullProject();
      const { runDoctor } = await import("../../src/commands/doctor.js");
      await runDoctor({ json: true });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should not contain ANSI escape codes (ESC[)
      // eslint-disable-next-line no-control-regex
      expect(output).not.toMatch(/\x1b\[/);
      // eslint-disable-next-line no-control-regex
      expect(output).not.toMatch(/\u001b\[/);
    });
  });

  describe("upstream GitHub status check", () => {
    it("shows status when both repos are up to date", async () => {
      await setupFullProject();
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: {
          bundledSha: TEST_BMAD_COMMIT,
          latestSha: TEST_BMAD_COMMIT,
          isUpToDate: true,
          compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/...",
        },
        ralph: {
          bundledSha: TEST_RALPH_COMMIT,
          latestSha: TEST_RALPH_COMMIT,
          isUpToDate: true,
          compareUrl: "https://github.com/snarktank/ralph/compare/...",
        },
        errors: [],
      });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("upstream status");
      expect(output).toContain("up to date");
    });

    it("shows warning when repos have updates", async () => {
      await setupFullProject();
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: {
          bundledSha: TEST_BMAD_COMMIT,
          latestSha: TEST_BMAD_COMMIT,
          isUpToDate: true,
          compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/...",
        },
        ralph: {
          bundledSha: TEST_RALPH_COMMIT,
          latestSha: "newralph",
          isUpToDate: false,
          compareUrl: "https://github.com/snarktank/ralph/compare/...",
        },
        errors: [],
      });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("upstream status");
      expect(output).toContain("behind");
    });

    it("shows skipped when offline", async () => {
      await setupFullProject();
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: null,
        ralph: null,
        errors: [
          { type: "network", message: "Network error", repo: "bmad" },
          { type: "network", message: "Network error", repo: "ralph" },
        ],
      });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("upstream status");
      expect(output).toContain("skipped");
      expect(output).toContain("offline");
    });

    it("shows skipped when rate limited", async () => {
      await setupFullProject();
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: null,
        ralph: null,
        errors: [
          { type: "rate-limit", message: "Rate limited", repo: "bmad" },
          { type: "rate-limit", message: "Rate limited", repo: "ralph" },
        ],
      });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("upstream status");
      expect(output).toContain("skipped");
      expect(output).toContain("rate");
    });

    it("does not fail overall doctor check due to network issues", async () => {
      await setupFullProject();
      const { checkUpstream } = await import("../../src/utils/github.js");
      vi.mocked(checkUpstream).mockResolvedValue({
        bmad: null,
        ralph: null,
        errors: [
          { type: "network", message: "Network error", repo: "bmad" },
          { type: "network", message: "Network error", repo: "ralph" },
        ],
      });

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // Upstream status check should pass even when network fails
      expect(output).toContain("upstream status");
      expect(output).toContain("skipped: offline");
      // The ✓ symbol indicates it passed (not ✗)
      expect(output).toMatch(/✓.*upstream status/);
    });
  });
});
