import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

describe("doctorCommand", () => {
  let testDir: string;
  let originalCwd: () => string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    originalCwd = process.cwd;
    process.cwd = () => testDir;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    consoleLogSpy.mockRestore();
    vi.resetModules();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  async function setupValidProject() {
    // config
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ name: "test", description: "", level: 2, createdAt: "2025-01-01T00:00:00.000Z" })
    );
    // _bmad
    await mkdir(join(testDir, "_bmad/bmm/agents"), { recursive: true });
    // .ralph
    await mkdir(join(testDir, ".ralph/lib"), { recursive: true });
    await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\n# bmalph-version: 0.7.0\necho hello");
    await writeFile(join(testDir, ".ralph/lib/circuit_breaker.sh"), "#!/bin/bash");
    // .claude/commands
    await mkdir(join(testDir, ".claude/commands"), { recursive: true });
    await writeFile(join(testDir, ".claude/commands/bmalph.md"), "# bmalph slash command");
    // CLAUDE.md
    await writeFile(join(testDir, "CLAUDE.md"), "# Project\n\n## BMAD-METHOD Integration\n");
    // .gitignore
    await writeFile(join(testDir, ".gitignore"), ".ralph/logs/\n_bmad-output/\n");
  }

  it("shows all checks passing for a valid project", async () => {
    await setupValidProject();
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("config.json");
    expect(output).toContain("_bmad/");
    expect(output).toContain("ralph_loop.sh");
  });

  it("reports missing config.json", async () => {
    await setupValidProject();
    await rm(join(testDir, "bmalph/config.json"));
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("config.json");
  });

  it("reports missing _bmad directory", async () => {
    await setupValidProject();
    await rm(join(testDir, "_bmad"), { recursive: true });
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("_bmad/");
  });

  it("reports missing ralph_loop.sh", async () => {
    await setupValidProject();
    await rm(join(testDir, ".ralph/ralph_loop.sh"));
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("ralph_loop.sh");
  });

  it("reports missing .ralph/lib/", async () => {
    await setupValidProject();
    await rm(join(testDir, ".ralph/lib"), { recursive: true });
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("lib/");
  });

  it("reports missing slash command", async () => {
    await setupValidProject();
    await rm(join(testDir, ".claude/commands/bmalph.md"));
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("bmalph.md");
  });

  it("reports missing BMAD snippet in CLAUDE.md", async () => {
    await setupValidProject();
    await writeFile(join(testDir, "CLAUDE.md"), "# Project\n\nNo BMAD here\n");
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("CLAUDE.md");
  });

  it("reports missing .gitignore entries", async () => {
    await setupValidProject();
    await writeFile(join(testDir, ".gitignore"), "node_modules/\n");
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain(".gitignore");
  });

  it("shows summary with pass/fail counts", async () => {
    await setupValidProject();
    const { doctorCommand } = await import("../../src/commands/doctor.js");
    await doctorCommand();

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toMatch(/\d+ passed/);
  });
});
