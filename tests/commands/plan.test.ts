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

describe("plan command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    testDir = join(tmpdir(), `bmalph-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    process.chdir(originalCwd);
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows cleanup
    }
  });

  it("errors when not initialized", async () => {
    const { planCommand } = await import("../../src/commands/plan.js");
    await planCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("not initialized"),
    );
  });

  it("shows phase 1 commands by default", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));

    const { planCommand } = await import("../../src/commands/plan.js");
    await planCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Phase 1");
    expect(output).toContain("Analysis");
    expect(output).toContain("BP");
    expect(output).toContain("CB");
  });

  it("shows phase 2 commands when specified", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));

    const { planCommand } = await import("../../src/commands/plan.js");
    await planCommand({ phase: "2" });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Phase 2");
    expect(output).toContain("Planning");
    expect(output).toContain("CP");
    expect(output).toContain("(required)");
  });

  it("shows phase 3 commands with required markers", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));

    const { planCommand } = await import("../../src/commands/plan.js");
    await planCommand({ phase: "3" });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Phase 3");
    expect(output).toContain("Solutioning");
    expect(output).toContain("CA");
    expect(output).toContain("CE");
    expect(output).toContain("IR");
  });

  it("rejects phase 4 (use implement instead)", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));

    const { planCommand } = await import("../../src/commands/plan.js");
    await planCommand({ phase: "4" });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Use 'bmalph implement'"),
    );
  });

  it("writes state with current phase", async () => {
    await writeFile(join(testDir, "bmalph/config.json"), JSON.stringify({ name: "test" }));

    const { planCommand } = await import("../../src/commands/plan.js");
    await planCommand({ phase: "2" });

    const { readState } = await import("../../src/utils/state.js");
    const state = await readState(testDir);
    expect(state?.currentPhase).toBe(2);
    expect(state?.status).toBe("planning");
  });
});
