import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockResolveBashCommand, mockRunBashCommand, mockDetectBashVersion } = vi.hoisted(() => ({
  mockResolveBashCommand: vi.fn(),
  mockRunBashCommand: vi.fn(),
  mockDetectBashVersion: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("../../src/utils/json.js", () => ({
  readJsonFile: vi.fn(),
}));

vi.mock("../../src/utils/errors.js", () => ({
  isEnoent: vi.fn(
    (err: unknown) =>
      err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
  ),
  formatError: vi.fn((err: unknown) => (err instanceof Error ? err.message : String(err))),
}));

vi.mock("../../src/utils/constants.js", () => ({
  CONFIG_FILE: "bmalph/config.json",
}));

vi.mock("../../src/run/ralph-process.js", () => ({
  resolveBashCommand: mockResolveBashCommand,
  runBashCommand: mockRunBashCommand,
  detectBashVersion: mockDetectBashVersion,
}));

import { readFile, stat } from "node:fs/promises";
import { readJsonFile } from "../../src/utils/json.js";
import {
  resolveBashCommand,
  runBashCommand,
  detectBashVersion,
} from "../../src/run/ralph-process.js";
import {
  checkNodeVersion,
  checkBash,
  checkJq,
  checkGitRepo,
  checkBmadDir,
  checkRalphLoop,
  checkRalphLib,
  checkConfig,
  checkDir,
  checkFileHasContent,
  checkCommandAvailable,
} from "../../src/commands/doctor-checks.js";

const mockReadFile = vi.mocked(readFile);
const mockStat = vi.mocked(stat);
const mockReadJsonFile = vi.mocked(readJsonFile);
const mockedResolveBashCommand = vi.mocked(resolveBashCommand);
const mockedRunBashCommand = vi.mocked(runBashCommand);
const mockedDetectBashVersion = vi.mocked(detectBashVersion);

function enoentError(): NodeJS.ErrnoException {
  const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
  err.code = "ENOENT";
  return err;
}

function permissionError(): NodeJS.ErrnoException {
  const err = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
  err.code = "EACCES";
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkNodeVersion", () => {
  it("passes when Node version is 20 or higher", async () => {
    const result = await checkNodeVersion("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("includes the current Node version in detail", async () => {
    const result = await checkNodeVersion("/projects/webapp");

    expect(result.detail).toContain(process.versions.node);
  });

  it("uses a descriptive label", async () => {
    const result = await checkNodeVersion("/projects/webapp");

    expect(result.label).toBe("Node version >= 20");
  });

  it("does not include a hint when passing", async () => {
    const result = await checkNodeVersion("/projects/webapp");

    expect(result.hint).toBeUndefined();
  });
});

describe("checkCommandAvailable", () => {
  it("returns true for a command that exists on the system", async () => {
    const result = await checkCommandAvailable("node");

    expect(result).toBe(true);
  });

  it("returns false for a nonexistent command", async () => {
    const result = await checkCommandAvailable("nonexistent-command-xyz-12345");

    expect(result).toBe(false);
  });
});

describe("checkBash", () => {
  it("uses the label 'bash available'", async () => {
    const result = await checkBash("/projects/webapp");

    expect(result.label).toBe("bash available");
  });

  it("passes when a compatible bash executable resolves", async () => {
    mockedResolveBashCommand.mockResolvedValue("C:\\Program Files\\Git\\bin\\bash.exe");
    mockedDetectBashVersion.mockResolvedValue("5.2.37");

    const result = await checkBash("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("includes bash version in detail when available", async () => {
    mockedResolveBashCommand.mockResolvedValue("/usr/bin/bash");
    mockedDetectBashVersion.mockResolvedValue("5.2.37");

    const result = await checkBash("/projects/webapp");

    expect(result.passed).toBe(true);
    expect(result.detail).toBe("v5.2.37");
    expect(result.hint).toBeUndefined();
  });

  it("includes hint when bash version is below 4", async () => {
    mockedResolveBashCommand.mockResolvedValue("/bin/bash");
    mockedDetectBashVersion.mockResolvedValue("3.2.57");

    const result = await checkBash("/projects/webapp");

    expect(result.passed).toBe(true);
    expect(result.detail).toBe("v3.2.57");
    expect(result.hint).toContain("Bash 4+");
  });

  it("passes with no detail when version detection fails", async () => {
    mockedResolveBashCommand.mockResolvedValue("/usr/bin/bash");
    mockedDetectBashVersion.mockResolvedValue(undefined);

    const result = await checkBash("/projects/webapp");

    expect(result.passed).toBe(true);
    expect(result.detail).toBeUndefined();
    expect(result.hint).toBeUndefined();
  });

  it("fails on Windows when only incompatible bash shims are available", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      mockedResolveBashCommand.mockRejectedValue(
        new Error("bash is not available. Install Git Bash to run Ralph on Windows.")
      );

      const result = await checkBash("/projects/webapp");

      expect(result.passed).toBe(false);
      expect(result.detail).toContain("Git Bash");
      expect(result.hint).toContain("Git Bash");
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
});

describe("checkJq", () => {
  it("uses the label 'jq available'", async () => {
    mockedRunBashCommand.mockResolvedValue({ exitCode: 0, stdout: "/usr/bin/jq\n", stderr: "" });
    const result = await checkJq("/projects/webapp");

    expect(result.label).toBe("jq available");
  });

  it("passes when bash can resolve jq", async () => {
    mockedRunBashCommand.mockResolvedValue({ exitCode: 0, stdout: "/usr/bin/jq\n", stderr: "" });

    const result = await checkJq("/projects/webapp");

    expect(result.passed).toBe(true);
    expect(result.hint).toBeUndefined();
  });

  it("fails when bash cannot see jq on Windows", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      mockedRunBashCommand.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "" });

      const result = await checkJq("/projects/webapp");

      expect(result.passed).toBe(false);
      expect(result.detail).toBe("jq not found in bash PATH");
      expect(result.hint).toContain("jq");
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
});

describe("checkDir", () => {
  it("passes when the path is a directory", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);

    const result = await checkDir("/projects/webapp/_bmad", "directory present");

    expect(result.passed).toBe(true);
  });

  it("fails when the path is a file instead of a directory", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => false } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);

    const result = await checkDir("/projects/webapp/_bmad", "directory present");

    expect(result.passed).toBe(false);
  });

  it("fails with 'not found' detail when directory does not exist", async () => {
    mockStat.mockRejectedValue(enoentError());

    const result = await checkDir(
      "/projects/webapp/_bmad",
      "directory present",
      "Run: bmalph init"
    );

    expect(result.detail).toBe("not found");
  });

  it("includes the hint when directory is not found", async () => {
    mockStat.mockRejectedValue(enoentError());

    const result = await checkDir(
      "/projects/webapp/_bmad",
      "directory present",
      "Run: bmalph init"
    );

    expect(result.hint).toBe("Run: bmalph init");
  });

  it("reports the error message for non-ENOENT errors", async () => {
    mockStat.mockRejectedValue(permissionError());

    const result = await checkDir(
      "/projects/webapp/_bmad",
      "directory present",
      "Run: bmalph init"
    );

    expect(result.detail).toContain("error:");
  });
});

describe("checkBmadDir", () => {
  it("passes when _bmad directory exists", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);

    const result = await checkBmadDir("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("fails when _bmad directory is missing", async () => {
    mockStat.mockRejectedValue(enoentError());

    const result = await checkBmadDir("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("has hint directing to bmalph init", async () => {
    mockStat.mockRejectedValue(enoentError());

    const result = await checkBmadDir("/projects/webapp");

    expect(result.hint).toBe("Run: bmalph init");
  });
});

describe("checkRalphLoop", () => {
  it("passes when ralph_loop.sh exists and has content", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\necho 'Ralph loop running'\n");

    const result = await checkRalphLoop("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("fails when ralph_loop.sh is empty", async () => {
    mockReadFile.mockResolvedValue("   \n  ");

    const result = await checkRalphLoop("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("fails when ralph_loop.sh does not exist", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkRalphLoop("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("suggests running bmalph upgrade when missing", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkRalphLoop("/projects/webapp");

    expect(result.hint).toBe("Run: bmalph upgrade");
  });
});

describe("checkRalphLib", () => {
  it("passes when .ralph/lib directory exists", async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);

    const result = await checkRalphLib("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("fails when .ralph/lib directory is missing", async () => {
    mockStat.mockRejectedValue(enoentError());

    const result = await checkRalphLib("/projects/webapp");

    expect(result.passed).toBe(false);
  });
});

describe("checkFileHasContent", () => {
  it("passes when the file has meaningful content", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\nset -euo pipefail\n");

    const result = await checkFileHasContent(
      "/projects/webapp/.ralph/ralph_loop.sh",
      "script present"
    );

    expect(result.passed).toBe(true);
  });

  it("fails when the file is empty", async () => {
    mockReadFile.mockResolvedValue("");

    const result = await checkFileHasContent(
      "/projects/webapp/.ralph/ralph_loop.sh",
      "script present"
    );

    expect(result.passed).toBe(false);
  });

  it("fails when the file contains only whitespace", async () => {
    mockReadFile.mockResolvedValue("   \n\t  \n  ");

    const result = await checkFileHasContent(
      "/projects/webapp/.ralph/ralph_loop.sh",
      "script present"
    );

    expect(result.passed).toBe(false);
  });

  it("fails with 'not found' when the file does not exist", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkFileHasContent(
      "/projects/webapp/.ralph/ralph_loop.sh",
      "script present",
      "Run: bmalph upgrade"
    );

    expect(result.detail).toBe("not found");
  });

  it("includes the hint when file is not found", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkFileHasContent(
      "/projects/webapp/.ralph/ralph_loop.sh",
      "script present",
      "Run: bmalph upgrade"
    );

    expect(result.hint).toBe("Run: bmalph upgrade");
  });

  it("reports error detail for non-ENOENT errors", async () => {
    mockReadFile.mockRejectedValue(permissionError());

    const result = await checkFileHasContent(
      "/projects/webapp/.ralph/ralph_loop.sh",
      "script present"
    );

    expect(result.detail).toContain("error:");
  });
});

describe("checkConfig", () => {
  it("passes when config file exists and contains valid JSON", async () => {
    mockReadJsonFile.mockResolvedValue({
      name: "my-saas-app",
      createdAt: "2025-06-15T10:30:00.000Z",
    });

    const result = await checkConfig("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("fails when config file does not exist", async () => {
    mockReadJsonFile.mockResolvedValue(null);

    const result = await checkConfig("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("shows 'file not found' detail when config is missing", async () => {
    mockReadJsonFile.mockResolvedValue(null);

    const result = await checkConfig("/projects/webapp");

    expect(result.detail).toBe("file not found");
  });

  it("includes init hint when config is missing", async () => {
    mockReadJsonFile.mockResolvedValue(null);

    const result = await checkConfig("/projects/webapp");

    expect(result.hint).toBe("Run: bmalph init");
  });

  it("fails when config file contains invalid JSON", async () => {
    mockReadJsonFile.mockRejectedValue(new Error("Invalid JSON in bmalph/config.json"));

    const result = await checkConfig("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("includes the parse error message in detail", async () => {
    mockReadJsonFile.mockRejectedValue(new Error("Invalid JSON in bmalph/config.json"));

    const result = await checkConfig("/projects/webapp");

    expect(result.detail).toBe("Invalid JSON in bmalph/config.json");
  });
});

describe("checkGitRepo", () => {
  it("passes when directory is a git repo with commits", async () => {
    mockedRunBashCommand.mockResolvedValue({ exitCode: 0, stdout: "main\n", stderr: "" });

    const result = await checkGitRepo("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("uses the label 'git repository with commits'", async () => {
    mockedRunBashCommand.mockResolvedValue({ exitCode: 0, stdout: "main\n", stderr: "" });

    const result = await checkGitRepo("/projects/webapp");

    expect(result.label).toBe("git repository with commits");
  });

  it("includes branch name in detail on success", async () => {
    mockedRunBashCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "feature/auth\n", stderr: "" });

    const result = await checkGitRepo("/projects/webapp");

    expect(result.detail).toBe("branch: feature/auth");
  });

  it("fails when directory is not a git repo", async () => {
    mockedRunBashCommand.mockResolvedValue({ exitCode: 128, stdout: "", stderr: "" });

    const result = await checkGitRepo("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("includes git init hint when not a git repo", async () => {
    mockedRunBashCommand.mockResolvedValue({ exitCode: 128, stdout: "", stderr: "" });

    const result = await checkGitRepo("/projects/webapp");

    expect(result.hint).toContain("git init");
  });

  it("fails when git repo has no commits", async () => {
    mockedRunBashCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 128, stdout: "", stderr: "" });

    const result = await checkGitRepo("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("includes commit hint when repo has no commits", async () => {
    mockedRunBashCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 128, stdout: "", stderr: "" });

    const result = await checkGitRepo("/projects/webapp");

    expect(result.hint).toContain("commit");
  });
});
