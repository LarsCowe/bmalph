import { describe, it, expect, vi, beforeEach } from "vitest";

const { readdirMock, readFileMock, rmMock, existsMock, atomicWriteFileMock } = vi.hoisted(() => ({
  readdirMock: vi.fn(),
  readFileMock: vi.fn(),
  rmMock: vi.fn(),
  existsMock: vi.fn(),
  atomicWriteFileMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: readdirMock,
  readFile: readFileMock,
  rm: rmMock,
}));

vi.mock("../src/installer.js", () => ({
  getSlashCommandsDir: vi.fn(() => "/bundled/slash-commands"),
}));

vi.mock("../src/utils/file-system.js", async () => {
  const actual = await vi.importActual<typeof import("../src/utils/file-system.js")>(
    "../src/utils/file-system.js"
  );
  return {
    ...actual,
    exists: existsMock,
    atomicWriteFile: atomicWriteFileMock,
  };
});

import type { Platform } from "../src/platform/types.js";
import type { ResetPlan } from "../src/reset.js";

const mockClaudeCodePlatform: Platform = {
  id: "claude-code",
  displayName: "Claude Code",
  tier: "full",
  instructionsFile: "CLAUDE.md",
  commandDelivery: { kind: "directory", dir: ".claude/commands" },
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: () => "",
  getDoctorChecks: () => [],
};

const mockCodexPlatform: Platform = {
  id: "codex",
  displayName: "OpenAI Codex",
  tier: "full",
  instructionsFile: "AGENTS.md",
  commandDelivery: {
    kind: "skills",
    dir: ".agents/skills",
    frontmatterName: "command",
  },
  instructionsSectionMarker: "## BMAD-METHOD Integration",
  generateInstructionsSnippet: () => "",
  getDoctorChecks: () => [],
};

function enoent(): Error {
  return Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

describe("reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildResetPlan", () => {
    it("identifies existing directories for deletion", async () => {
      existsMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        return p.endsWith("/_bmad") || p.endsWith("/.ralph") || p.endsWith("/bmalph");
      });
      readdirMock.mockResolvedValue([]);
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.directories).toContain("_bmad");
      expect(plan.directories).toContain(".ralph");
      expect(plan.directories).toContain("bmalph");
    });

    it("skips non-existent directories", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockResolvedValue([]);
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.directories).toEqual([]);
    });

    it("finds bundled slash commands to delete", async () => {
      existsMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        return p.endsWith("/.claude/commands");
      });
      readdirMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        if (p.includes("slash-commands")) return ["bmalph.md", "analyst.md"];
        if (p.includes(".claude/commands")) return ["bmalph.md", "analyst.md"];
        return [];
      });
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.commandFiles).toContain(".claude/commands/bmalph.md");
      expect(plan.commandFiles).toContain(".claude/commands/analyst.md");
    });

    it("preserves user-created commands", async () => {
      existsMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        return p.endsWith("/.claude/commands");
      });
      readdirMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        if (p.includes("slash-commands")) return ["bmalph.md"];
        if (p.includes(".claude/commands")) return ["bmalph.md", "my-custom.md"];
        return [];
      });
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.commandFiles).toContain(".claude/commands/bmalph.md");
      expect(plan.commandFiles).not.toContain(".claude/commands/my-custom.md");
    });

    it("detects instructions file sections to remove", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockResolvedValue([]);
      readFileMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        if (p.endsWith("/CLAUDE.md")) {
          return "# Project\n\n## BMAD-METHOD Integration\n\nContent\n";
        }
        throw enoent();
      });

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.instructionsCleanup).not.toBeNull();
      expect(plan.instructionsCleanup!.path).toBe("CLAUDE.md");
      expect(plan.instructionsCleanup!.sectionsToRemove).toContain("## BMAD-METHOD Integration");
    });

    it("detects BMAD section for index platforms", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockResolvedValue([]);
      readFileMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        if (p.endsWith("/AGENTS.md")) {
          return "# Agents\n\n## BMAD-METHOD Integration\n\nContent\n";
        }
        throw enoent();
      });

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockCodexPlatform);

      expect(plan.instructionsCleanup).not.toBeNull();
      expect(plan.instructionsCleanup!.sectionsToRemove).toContain("## BMAD-METHOD Integration");
    });

    it("detects gitignore entries to remove", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockResolvedValue([]);
      readFileMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        if (p.endsWith("/.gitignore")) {
          return "node_modules/\n.ralph/logs/\n_bmad-output/\n.env\n";
        }
        throw enoent();
      });

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.gitignoreLines).toContain(".ralph/logs/");
      expect(plan.gitignoreLines).toContain("_bmad-output/");
    });

    it("warns about _bmad-output directory", async () => {
      existsMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        return p.endsWith("/_bmad-output");
      });
      readdirMock.mockResolvedValue([]);
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.warnings).toHaveLength(1);
      expect(plan.warnings[0].path).toBe("_bmad-output/");
    });

    it("finds bmad-* skill directories for skills platforms", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockImplementation(async (path: string) => {
        const p = path.replace(/\\/g, "/");
        if (p.includes(".agents/skills")) {
          return ["bmad-analyst", "bmad-create-prd", "my-custom-skill"];
        }
        return [];
      });
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockCodexPlatform);

      expect(plan.commandFiles).toContain(".agents/skills/bmad-analyst");
      expect(plan.commandFiles).toContain(".agents/skills/bmad-create-prd");
      expect(plan.commandFiles).not.toContain(".agents/skills/my-custom-skill");
    });

    it("skips skills cleanup for non-skills platforms", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockResolvedValue([]);
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      // Should not have any .agents/skills paths
      expect(plan.commandFiles.filter((f) => f.includes(".agents/skills"))).toEqual([]);
    });

    it("returns empty plan when nothing exists", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockResolvedValue([]);
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockClaudeCodePlatform);

      expect(plan.directories).toEqual([]);
      expect(plan.commandFiles).toEqual([]);
      expect(plan.instructionsCleanup).toBeNull();
      expect(plan.gitignoreLines).toEqual([]);
      expect(plan.warnings).toEqual([]);
    });

    it("handles ENOENT when .agents/skills directory does not exist", async () => {
      existsMock.mockResolvedValue(false);
      readdirMock.mockRejectedValue(enoent());
      readFileMock.mockRejectedValue(enoent());

      const { buildResetPlan } = await import("../src/reset.js");
      const plan = await buildResetPlan("/project", mockCodexPlatform);

      expect(plan.commandFiles).toEqual([]);
    });
  });

  describe("executeResetPlan", () => {
    it("deletes directories listed in plan", async () => {
      rmMock.mockResolvedValue(undefined);

      const { executeResetPlan } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: ["_bmad", ".ralph", "bmalph"],
        commandFiles: [],
        instructionsCleanup: null,
        gitignoreLines: [],
        warnings: [],
      };

      await executeResetPlan("/project", plan);

      expect(rmMock).toHaveBeenCalledWith(expect.stringMatching(/[/\\]_bmad$/), {
        recursive: true,
        force: true,
      });
      expect(rmMock).toHaveBeenCalledWith(expect.stringMatching(/[/\\]\.ralph$/), {
        recursive: true,
        force: true,
      });
      expect(rmMock).toHaveBeenCalledWith(expect.stringMatching(/[/\\]bmalph$/), {
        recursive: true,
        force: true,
      });
    });

    it("deletes command files listed in plan", async () => {
      rmMock.mockResolvedValue(undefined);

      const { executeResetPlan } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [".claude/commands/bmalph.md", ".claude/commands/analyst.md"],
        instructionsCleanup: null,
        gitignoreLines: [],
        warnings: [],
      };

      await executeResetPlan("/project", plan);

      expect(rmMock).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]\.claude[/\\]commands[/\\]bmalph\.md$/),
        { recursive: true, force: true }
      );
      expect(rmMock).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]\.claude[/\\]commands[/\\]analyst\.md$/),
        { recursive: true, force: true }
      );
    });

    it("removes sections from instructions file", async () => {
      rmMock.mockResolvedValue(undefined);
      readFileMock.mockResolvedValue(
        "# My Project\n\nUser content.\n\n## BMAD-METHOD Integration\n\nBMAD stuff\n\n## Other Section\n\nMore content\n"
      );
      atomicWriteFileMock.mockResolvedValue(undefined);

      const { executeResetPlan } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [],
        instructionsCleanup: {
          path: "CLAUDE.md",
          sectionsToRemove: ["## BMAD-METHOD Integration"],
        },
        gitignoreLines: [],
        warnings: [],
      };

      await executeResetPlan("/project", plan);

      expect(atomicWriteFileMock).toHaveBeenCalledWith(
        expect.stringMatching(/CLAUDE\.md$/),
        expect.stringContaining("# My Project")
      );
      const writtenContent = atomicWriteFileMock.mock.calls[0][1] as string;
      expect(writtenContent).not.toContain("BMAD-METHOD Integration");
      expect(writtenContent).toContain("## Other Section");
    });

    it("deletes empty instructions file after section removal", async () => {
      rmMock.mockResolvedValue(undefined);
      readFileMock.mockResolvedValue("## BMAD-METHOD Integration\n\nOnly BMAD content here\n");
      atomicWriteFileMock.mockResolvedValue(undefined);

      const { executeResetPlan } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [],
        instructionsCleanup: {
          path: "CLAUDE.md",
          sectionsToRemove: ["## BMAD-METHOD Integration"],
        },
        gitignoreLines: [],
        warnings: [],
      };

      await executeResetPlan("/project", plan);

      expect(rmMock).toHaveBeenCalledWith(expect.stringMatching(/CLAUDE\.md$/), { force: true });
      expect(atomicWriteFileMock).not.toHaveBeenCalled();
    });

    it("removes gitignore entries", async () => {
      rmMock.mockResolvedValue(undefined);
      readFileMock.mockResolvedValue("node_modules/\n.ralph/logs/\n_bmad-output/\n.env\n");
      atomicWriteFileMock.mockResolvedValue(undefined);

      const { executeResetPlan } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [],
        instructionsCleanup: null,
        gitignoreLines: [".ralph/logs/", "_bmad-output/"],
        warnings: [],
      };

      await executeResetPlan("/project", plan);

      expect(atomicWriteFileMock).toHaveBeenCalledWith(
        expect.stringMatching(/\.gitignore$/),
        expect.any(String)
      );
      const writtenContent = atomicWriteFileMock.mock.calls[0][1] as string;
      expect(writtenContent).toContain("node_modules/");
      expect(writtenContent).toContain(".env");
      expect(writtenContent).not.toContain(".ralph/logs/");
      expect(writtenContent).not.toContain("_bmad-output/");
    });

    it("handles missing files gracefully", async () => {
      rmMock.mockResolvedValue(undefined);
      readFileMock.mockRejectedValue(enoent());

      const { executeResetPlan } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: ["_bmad"],
        commandFiles: [".claude/commands/bmalph.md"],
        instructionsCleanup: {
          path: "CLAUDE.md",
          sectionsToRemove: ["## BMAD-METHOD Integration"],
        },
        gitignoreLines: [".ralph/logs/"],
        warnings: [],
      };

      // Should not throw
      await expect(executeResetPlan("/project", plan)).resolves.toBeUndefined();
    });
  });

  describe("planToDryRunActions", () => {
    it("converts directories to delete actions", async () => {
      const { planToDryRunActions } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: ["_bmad", ".ralph"],
        commandFiles: [],
        instructionsCleanup: null,
        gitignoreLines: [],
        warnings: [],
      };

      const actions = planToDryRunActions(plan);

      expect(actions).toContainEqual({ type: "delete", path: "_bmad/" });
      expect(actions).toContainEqual({ type: "delete", path: ".ralph/" });
    });

    it("converts command files to delete actions", async () => {
      const { planToDryRunActions } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [".claude/commands/bmalph.md"],
        instructionsCleanup: null,
        gitignoreLines: [],
        warnings: [],
      };

      const actions = planToDryRunActions(plan);

      expect(actions).toContainEqual({ type: "delete", path: ".claude/commands/bmalph.md" });
    });

    it("converts instructions cleanup to modify action", async () => {
      const { planToDryRunActions } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [],
        instructionsCleanup: {
          path: "CLAUDE.md",
          sectionsToRemove: ["## BMAD-METHOD Integration"],
        },
        gitignoreLines: [],
        warnings: [],
      };

      const actions = planToDryRunActions(plan);

      expect(actions).toContainEqual({ type: "modify", path: "CLAUDE.md" });
    });

    it("converts gitignore cleanup to modify action", async () => {
      const { planToDryRunActions } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [],
        instructionsCleanup: null,
        gitignoreLines: [".ralph/logs/"],
        warnings: [],
      };

      const actions = planToDryRunActions(plan);

      expect(actions).toContainEqual({ type: "modify", path: ".gitignore" });
    });

    it("converts warnings to warn actions", async () => {
      const { planToDryRunActions } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [],
        instructionsCleanup: null,
        gitignoreLines: [],
        warnings: [{ path: "_bmad-output/", message: "user artifacts" }],
      };

      const actions = planToDryRunActions(plan);

      expect(actions).toContainEqual({
        type: "warn",
        path: "_bmad-output/",
        reason: "user artifacts",
      });
    });

    it("returns empty array for empty plan", async () => {
      const { planToDryRunActions } = await import("../src/reset.js");
      const plan: ResetPlan = {
        directories: [],
        commandFiles: [],
        instructionsCleanup: null,
        gitignoreLines: [],
        warnings: [],
      };

      const actions = planToDryRunActions(plan);

      expect(actions).toEqual([]);
    });
  });

  describe("removeGitignoreLines", () => {
    it("removes specified lines from content", async () => {
      const { removeGitignoreLines } = await import("../src/reset.js");
      const content = "node_modules/\n.ralph/logs/\ndist/\n";
      const result = removeGitignoreLines(content, [".ralph/logs/"]);
      expect(result).toBe("node_modules/\ndist/\n");
    });

    it("preserves CRLF line endings when input uses CRLF", async () => {
      const { removeGitignoreLines } = await import("../src/reset.js");
      const content = "node_modules/\r\n.ralph/logs/\r\ndist/\r\n";
      const result = removeGitignoreLines(content, [".ralph/logs/"]);
      expect(result).toBe("node_modules/\r\ndist/\r\n");
    });

    it("uses LF when input uses LF", async () => {
      const { removeGitignoreLines } = await import("../src/reset.js");
      const content = "node_modules/\n.ralph/logs/\ndist/\n";
      const result = removeGitignoreLines(content, [".ralph/logs/"]);
      expect(result).not.toContain("\r");
    });
  });
});
