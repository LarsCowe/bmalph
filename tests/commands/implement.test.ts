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
    bold: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
  },
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
  })),
}));

vi.mock("../../src/transition.js", () => ({
  runTransition: vi.fn(),
}));

describe("implement command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    testDir = join(tmpdir(), `bmalph-impl-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    await mkdir(join(testDir, ".ralph"), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows cleanup
    }
  });

  it("errors when not initialized", async () => {
    // Remove config to simulate uninitialized
    const { implementCommand } = await import("../../src/commands/implement.js");
    await rm(join(testDir, "bmalph/config.json"), { force: true });
    await implementCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("not initialized"),
    );
  });

  it("errors when ralph_loop.sh is missing", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));

    const { implementCommand } = await import("../../src/commands/implement.js");
    await implementCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Ralph loop script not found"),
    );
  });

  it("runs transition and spawns ralph loop", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));
    await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\necho ok");

    const { runTransition } = await import("../../src/transition.js");
    vi.mocked(runTransition).mockResolvedValue({ storiesCount: 5 });

    const { implementCommand } = await import("../../src/commands/implement.js");
    await implementCommand();

    expect(runTransition).toHaveBeenCalledWith(testDir);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("5 stories");

    const { spawn } = await import("child_process");
    expect(spawn).toHaveBeenCalledWith(
      "bash",
      [join(testDir, ".ralph/ralph_loop.sh")],
      expect.objectContaining({ cwd: testDir, stdio: "inherit" }),
    );
  });

  it("shows error when transition fails", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));
    await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "#!/bin/bash\necho ok");

    const { runTransition } = await import("../../src/transition.js");
    vi.mocked(runTransition).mockRejectedValue(new Error("No BMAD artifacts found"));

    const { implementCommand } = await import("../../src/commands/implement.js");
    await implementCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No BMAD artifacts found"),
    );

    const { spawn } = await import("child_process");
    expect(spawn).not.toHaveBeenCalled();
  });
});
