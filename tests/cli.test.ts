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

  it("registers init, upgrade, doctor commands (not implement, reset, status)", () => {
    const { stdout } = runCli(["--help"]);
    const commandsSection = stdout.split("Commands:")[1] ?? "";
    expect(commandsSection).toContain("init");
    expect(commandsSection).toContain("upgrade");
    expect(commandsSection).toContain("doctor");
    expect(commandsSection).toContain("help");
    // These commands are slash commands only, not CLI
    expect(commandsSection).not.toContain("implement");
    expect(commandsSection).not.toContain("reset");
    expect(commandsSection).not.toContain("status");
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

  it("doctor command has help", () => {
    const { stdout, exitCode } = runCli(["doctor", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("doctor");
  });

  it("upgrade command has help", () => {
    const { stdout, exitCode } = runCli(["upgrade", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("upgrade");
  });

  it("version matches package.json format", () => {
    const { stdout } = runCli(["--version"]);
    const version = stdout.trim();
    // Should be semver format: major.minor.patch
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    // Should not be 0.8.4 (the old hardcoded version)
    expect(version).not.toBe("0.8.4");
  });

  it("description mentions Ralph", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout.toLowerCase()).toContain("ralph");
  });

  it("accepts --no-color flag", () => {
    const { stdout } = runCli(["--help"]);
    expect(stdout).toContain("--no-color");
  });

  it("--no-color flag disables colored output", () => {
    // Without --no-color, output may contain ANSI escape codes (in TTY)
    // With --no-color, output should never contain ANSI codes
    const { stdout } = runCli(["--no-color", "--help"]);
    // ANSI escape codes start with ESC[ (hex 1b, dec 27)
    // eslint-disable-next-line no-control-regex
    expect(stdout).not.toMatch(/\x1b\[/);
    // eslint-disable-next-line no-control-regex
    expect(stdout).not.toMatch(/\u001b\[/);
  });
});
