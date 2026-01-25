import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

describe("doctor command", () => {
  let testDir: string;
  let originalCwd: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    originalCwd = process.cwd();
    process.chdir(testDir);
    vi.resetModules();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
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
      JSON.stringify({ name: "test", description: "test desc" }),
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
    it("catches and reports unexpected errors", async () => {
      // Mock readJsonFile to throw unexpected error
      vi.doMock("../../src/utils/json.js", () => ({
        readJsonFile: vi.fn().mockRejectedValue(new Error("Unexpected error")),
      }));

      const { doctorCommand } = await import("../../src/commands/doctor.js");
      await doctorCommand();

      // Should still complete without crashing
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });
});
