import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { join } from "path";

const CLI_PATH = join(__dirname, "..", "bin", "bmalph.js");

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], {
      encoding: "utf-8",
      timeout: 10000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: error.status ?? 1,
    };
  }
}

describe("CLI entry point", () => {
  it("outputs version with --version", () => {
    const { stdout, exitCode } = runCli(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("outputs help with --help", () => {
    const { stdout, exitCode } = runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("bmalph");
    expect(stdout).toContain("BMAD-METHOD");
  });

  it("shows error for unknown command", () => {
    const { stderr, exitCode } = runCli(["nonexistent-command"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("unknown command");
  });

  it("registers init command", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("init");
  });

  it("registers implement command", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("implement");
  });

  it("registers reset command", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("reset");
  });

  it("registers upgrade command", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("upgrade");
  });

  it("registers status command", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("status");
  });

  it("registers doctor command", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("doctor");
  });

  it("accepts --verbose flag", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("--verbose");
  });

  it("init accepts name and description options", () => {
    const { stdout } = runCli(["init", "--help"]);
    expect(stdout).toContain("--name");
    expect(stdout).toContain("--description");
  });
});
