import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TransitionResult } from "../../src/transition/types.js";
import { mockPlatform } from "../helpers/mock-platform.js";

vi.mock("chalk");

const mockExists = vi.fn();
vi.mock("../../src/utils/file-system.js", () => ({
  exists: mockExists,
}));

vi.mock("../../src/transition/orchestration.js", () => ({
  runTransition: vi.fn(),
}));

vi.mock("../../src/platform/resolve.js", () => ({
  resolveProjectPlatform: vi.fn(),
}));

function mockTransitionResult(overrides?: Partial<TransitionResult>): TransitionResult {
  return {
    storiesCount: 3,
    warnings: [],
    fixPlanPreserved: false,
    generatedFiles: [],
    ...overrides,
  };
}

describe("implement command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    // Default: fix_plan does not exist (first run)
    mockExists.mockResolvedValue(false);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;
  });

  describe("happy path", () => {
    it("prints story count on successful transition", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult({ storiesCount: 5 }));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("5 stories");
    });
  });

  describe("preflight issues", () => {
    it("prints preflight error with red cross icon", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(
        mockTransitionResult({
          preflightIssues: [{ id: "missing-prd", severity: "error", message: "No PRD found" }],
        })
      );

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("\u2717");
      expect(output).toContain("No PRD found");
    });

    it("prints preflight warning with yellow bang icon", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(
        mockTransitionResult({
          preflightIssues: [{ id: "no-tests", severity: "warning", message: "No test strategy" }],
        })
      );

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("!");
      expect(output).toContain("No test strategy");
    });

    it("prints preflight info with dim i icon", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(
        mockTransitionResult({
          preflightIssues: [
            { id: "optional-hint", severity: "info", message: "Consider adding UX spec" },
          ],
        })
      );

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("i");
      expect(output).toContain("Consider adding UX spec");
    });

    it("prints suggestion when issue has one", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(
        mockTransitionResult({
          preflightIssues: [
            {
              id: "missing-prd",
              severity: "error",
              message: "No PRD found",
              suggestion: "Run /create-prd first",
            },
          ],
        })
      );

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Run /create-prd first");
    });

    it("omits suggestion line when issue has none", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(
        mockTransitionResult({
          preflightIssues: [{ id: "missing-prd", severity: "error", message: "No PRD found" }],
        })
      );

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      // Should have the issue message line and an empty line after, but no suggestion
      const calls = consoleSpy.mock.calls.map((c) => c[0]);
      const issueLineIdx = calls.findIndex(
        (line) => typeof line === "string" && line.includes("No PRD found")
      );
      expect(issueLineIdx).toBeGreaterThanOrEqual(0);
      // Next line after the issue should not contain suggestion text
      const nextLine = calls[issueLineIdx + 1];
      expect(nextLine).not.toContain("/create-prd");
    });
  });

  describe("warnings", () => {
    it("prints warnings and warning count", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(
        mockTransitionResult({ warnings: ["Missing tests"] })
      );

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Missing tests");
      expect(output).toContain("1 warning(s)");
    });

    it("skips warning section when no warnings", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult({ warnings: [] }));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).not.toContain("warning(s)");
    });
  });

  describe("fix plan preserved", () => {
    it("shows progress preserved when fixPlanPreserved is true", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult({ fixPlanPreserved: true }));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("progress preserved");
    });

    it("omits preserved note when fixPlanPreserved is false", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult({ fixPlanPreserved: false }));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).not.toContain("preserved");
    });
  });

  describe("platform tier branching", () => {
    it("shows driver command for full-tier platform", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(
        mockPlatform({ id: "claude-code", tier: "full" })
      );
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult());

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bmalph run");
    });

    it("shows requires full-tier message for instructions-only platform", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(
        mockPlatform({ id: "cursor", displayName: "Cursor", tier: "instructions-only" })
      );
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult());

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("full-tier platform");
      expect(output).toContain("Cursor");
    });
  });

  describe("generated files summary", () => {
    it("displays generated files with action icons", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(
        mockTransitionResult({
          generatedFiles: [
            { path: ".ralph/@fix_plan.md", action: "created" },
            { path: ".ralph/PROMPT.md", action: "updated" },
            { path: ".ralph/specs/", action: "updated" },
          ],
        })
      );

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Generated files");
      expect(output).toContain("+ .ralph/@fix_plan.md");
      expect(output).toContain("~ .ralph/PROMPT.md");
      expect(output).toContain("~ .ralph/specs/");
    });

    it("skips generated files section when list is empty", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult({ generatedFiles: [] }));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).not.toContain("Generated files");
    });
  });

  describe("re-run protection", () => {
    it("blocks re-run when fix_plan exists and --force not set", async () => {
      mockExists.mockResolvedValue(true); // fix_plan exists
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      expect(process.exitCode).toBe(1);
      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("already been run");
      expect(output).toContain("--force");
    });

    it("--force bypasses re-run guard", async () => {
      mockExists.mockResolvedValue(true); // fix_plan exists
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult());

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project", force: true });

      expect(process.exitCode).toBeUndefined();
      expect(runTransition).toHaveBeenCalled();
    });

    it("first run proceeds normally when fix_plan does not exist", async () => {
      // mockExists already defaults to false in beforeEach
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockResolvedValue(mockTransitionResult());

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      expect(process.exitCode).toBeUndefined();
      expect(runTransition).toHaveBeenCalled();
    });
  });

  describe("re-run detection error discrimination", () => {
    it("re-throws non-ENOENT errors from exists check", async () => {
      mockExists.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("EACCES");
    });
  });

  describe("error handling", () => {
    it("sets exitCode 1 when runTransition throws", async () => {
      const { runTransition } = await import("../../src/transition/orchestration.js");
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockResolvedValue(mockPlatform());
      vi.mocked(runTransition).mockRejectedValue(new Error("Transition failed"));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("Transition failed");
    });

    it("sets exitCode 1 when resolveProjectPlatform throws", async () => {
      const { resolveProjectPlatform } = await import("../../src/platform/resolve.js");
      vi.mocked(resolveProjectPlatform).mockRejectedValue(new Error("No config found"));

      const { implementCommand } = await import("../../src/commands/implement.js");
      await implementCommand({ projectDir: "/test/project" });

      expect(process.exitCode).toBe(1);
      const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(errorOutput).toContain("No config found");
    });
  });
});
